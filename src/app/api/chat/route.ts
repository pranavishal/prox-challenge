/**
 * Chat API Route
 *
 * Handles chat requests from the frontend. Runs the Claude agent with tool use,
 * executes tool calls server-side, and streams the response back.
 *
 * Architecture note:
 * - Tool calls happen server-side (data access, no API keys exposed)
 * - Claude's text + artifact output streams directly to the client
 * - The agentic loop: Claude responds → tool calls → tool results → Claude continues
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { SYSTEM_PROMPT } from "@/agent/system-prompt";
import { ALL_TOOLS } from "@/agent/tools";
import { lookupDutyCycle } from "@/agent/tools/duty-cycle";
import { lookupPolarity } from "@/agent/tools/polarity";
import { recommendSettings } from "@/agent/tools/settings";
import { getTroubleshooting } from "@/agent/tools/troubleshooting";
import { lookupSpecs } from "@/agent/tools/specs";
import { getManualImages } from "@/agent/tools/manual-images";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Map tool names to their handler functions
const toolHandlers: Record<string, (input: any) => any> = {
  lookup_duty_cycle: (input) =>
    lookupDutyCycle(input.process, input.voltage, input.amperage),
  lookup_polarity: (input) => lookupPolarity(input.process),
  recommend_settings: (input) => recommendSettings(input),
  get_troubleshooting: (input) => getTroubleshooting(input),
  lookup_specs: (input) => lookupSpecs(input.category),
  get_manual_images: (input) => getManualImages(input.query),
};

export async function POST(req: NextRequest) {
  try {
    const { messages, imageData } = await req.json();

    // Build the message array — if an image was uploaded, attach it to the last user message
    const apiMessages = buildMessages(messages, imageData);

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runAgentLoop(apiMessages, controller);
        } catch (err) {
          const error = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}

/**
 * The agentic loop:
 * 1. Call Claude with current messages
 * 2. If Claude makes tool calls → execute them, append results, loop
 * 3. If Claude returns final text → stream it to client
 */
async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  controller: ReadableStreamDefaultController
) {
  const encode = (data: object) =>
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

  let currentMessages = [...messages];

  // Agentic loop — runs until Claude stops making tool calls
  while (true) {
    // Use streaming for the final text response, regular for tool-use passes
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALL_TOOLS as any,
      messages: currentMessages,
      stream: true,
    });

    let hasToolUse = false;
    const toolUseBlocks: Array<{ type: "tool_use"; id: string; name: string; input: any }> = [];
    let currentToolUse: { id: string; name: string; input: string } | null = null;
    let stopReason: string | null = null;

    // Process the stream
    for await (const event of response) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          hasToolUse = true;
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: "",
          };
          // Notify frontend that tool is being called
          controller.enqueue(
            encode({ type: "tool_call", tool: event.content_block.name })
          );
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          // Stream text directly to frontend
          controller.enqueue(encode({ type: "text", content: event.delta.text }));
        } else if (event.delta.type === "input_json_delta" && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolUse) {
          try {
            const parsedInput = JSON.parse(currentToolUse.input || "{}");
            toolUseBlocks.push({
              type: "tool_use",
              id: currentToolUse.id,
              name: currentToolUse.name,
              input: parsedInput,
            });
          } catch {
            // Malformed tool input — skip
          }
          currentToolUse = null;
        }
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason || null;
      }
    }

    // If no tool calls were made, we're done
    if (!hasToolUse || toolUseBlocks.length === 0) {
      break;
    }

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const handler = toolHandlers[toolUse.name];
      let result: any;

      if (handler) {
        try {
          result = handler(toolUse.input);
        } catch (err) {
          result = { error: `Tool execution failed: ${err instanceof Error ? err.message : "unknown"}` };
        }
      } else {
        result = { error: `Unknown tool: ${toolUse.name}` };
      }

      // Notify frontend of tool result — images get their own event type for inline rendering
      if (toolUse.name === "get_manual_images" && Array.isArray(result) && result.length > 0) {
        controller.enqueue(encode({ type: "images", images: result }));
      } else {
        controller.enqueue(encode({ type: "tool_result", tool: toolUse.name, result }));
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Append assistant message with tool uses and tool results to conversation
    currentMessages = [
      ...currentMessages,
      {
        role: "assistant",
        content: toolUseBlocks,
      },
      {
        role: "user",
        content: toolResults,
      },
    ];

    // Loop back — Claude will now use tool results to generate final response
  }

  // Signal stream end
  controller.enqueue(encode({ type: "done" }));
}

function buildMessages(
  messages: Array<{ role: string; content: string }>,
  imageData?: { base64: string; mediaType: string } | null
): Anthropic.MessageParam[] {
  return messages.map((msg, index) => {
    // If this is the last user message and we have image data, include the image
    if (
      msg.role === "user" &&
      index === messages.length - 1 &&
      imageData
    ) {
      return {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: imageData.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageData.base64,
            },
          },
          {
            type: "text" as const,
            text: msg.content,
          },
        ],
      };
    }
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  });
}
