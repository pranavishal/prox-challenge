"use client";

/**
 * ChatInterface
 *
 * Main component. Manages:
 * - Message history
 * - Streaming from the API
 * - Stream parsing (separating text from artifacts)
 * - Artifact panel state
 *
 * Layout: two-pane on desktop (chat | artifact), single pane on mobile
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Message } from "./Message";
import { InputBar } from "./InputBar";
import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { StreamParser } from "@/agent/stream-parser";
import type { Message as MessageType, Artifact, ImageData } from "@/lib/types";
import { Zap, ChevronRight } from "lucide-react";

// Suggested questions shown on empty state
const SUGGESTED_QUESTIONS = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "How do I set up polarity for TIG welding?",
  "I'm getting porosity in my flux-cored welds",
  "What process should I use for 1/8\" steel?",
  "How do I load a wire spool?",
  "My arc keeps cutting out — what's wrong?",
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingMsgIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, image?: ImageData) => {
      if (isStreaming) return;

      const userMsg: MessageType = {
        id: generateId(),
        role: "user",
        content: text,
        imagePreview: image?.preview,
      };

      const assistantMsgId = generateId();
      streamingMsgIdRef.current = assistantMsgId;

      const assistantMsg: MessageType = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        toolsUsed: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setActiveToolCalls([]);

      // Build conversation history for the API
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            imageData: image ? { base64: image.base64, mediaType: image.mediaType } : null,
          }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = new StreamParser();

        // Accumulated state for the current assistant message
        let textContent = "";
        let currentArtifact: Artifact | null = null;
        let artifactCode = "";
        let toolsUsed: string[] = [];
        let inArtifact = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === "text") {
                // Parse the text chunk for artifacts
                const parsed = parser.processChunk(event.content);

                for (const item of parsed) {
                  if (item.type === "text") {
                    textContent += item.content;
                  } else if (item.type === "artifact_start") {
                    inArtifact = true;
                    currentArtifact = {
                      id: generateId(),
                      type: item.artifactType,
                      title: item.title,
                      code: "",
                    };
                    artifactCode = "";
                    // Switch the panel immediately so it shows "Generating…" while
                    // Claude streams the code — don't wait for artifact_end
                    setSelectedArtifact(currentArtifact);
                  } else if (item.type === "artifact_content") {
                    artifactCode += item.content;
                  } else if (item.type === "artifact_end") {
                    inArtifact = false;
                    if (currentArtifact !== null) {
                      const updated: Artifact = { id: currentArtifact.id, type: currentArtifact.type, title: currentArtifact.title, code: artifactCode };
                      currentArtifact = updated;
                      setSelectedArtifact(updated);
                    }
                  }
                }

                // Update message with latest text and artifact
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: textContent,
                          artifact: currentArtifact?.code
                            ? { ...currentArtifact, code: artifactCode }
                            : undefined,
                          toolsUsed,
                        }
                      : m
                  )
                );
              } else if (event.type === "tool_call") {
                toolsUsed = [...new Set([...toolsUsed, event.tool])];
                setActiveToolCalls((prev) => [...new Set([...prev, event.tool])]);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, toolsUsed } : m
                  )
                );
              } else if (event.type === "tool_result") {
                setActiveToolCalls((prev) => prev.filter((t) => t !== event.tool));
              } else if (event.type === "images") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, manualImages: event.images }
                      : m
                  )
                );
              } else if (event.type === "done") {
                // Flush any remaining buffer
                const flushed = parser.flush();
                for (const item of flushed) {
                  if (item.type === "text") textContent += item.content;
                  else if (item.type === "artifact_content") artifactCode += item.content;
                  else if (item.type === "artifact_end") {
                    if (currentArtifact !== null) {
                      const updated2: Artifact = { id: currentArtifact.id, type: currentArtifact.type, title: currentArtifact.title, code: artifactCode };
                      currentArtifact = updated2;
                      setSelectedArtifact(updated2);
                    }
                  }
                }
                // Final update
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: textContent,
                          artifact: currentArtifact?.code
                            ? { ...currentArtifact, code: artifactCode }
                            : undefined,
                          toolsUsed,
                        }
                      : m
                  )
                );
              } else if (event.type === "error") {
                textContent += `\n\nError: ${event.error}`;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: textContent } : m
                  )
                );
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `Sorry, I ran into an error: ${errorText}` }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        setActiveToolCalls([]);
      }
    },
    [messages, isStreaming]
  );

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* LEFT PANE — Chat */}
      <div className="flex flex-col w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 border-r border-zinc-800">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-center w-8 h-8 bg-orange-500 rounded-lg">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Vulcan OmniPro 220</h1>
            <p className="text-xs text-zinc-500">Multiprocess Welder Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isStreaming ? "bg-orange-400 animate-pulse" : "bg-green-500"}`} />
            <span className="text-xs text-zinc-500">{isStreaming ? "Thinking…" : "Ready"}</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
          {messages.length === 0 ? (
            <EmptyState onSelect={(q) => sendMessage(q)} />
          ) : (
            messages.map((msg) => (
              <Message
                key={msg.id}
                message={msg}
                onSelectArtifact={(m) => m.artifact && setSelectedArtifact(m.artifact)}
                isSelected={!!msg.artifact && selectedArtifact?.id === msg.artifact.id}
              />
            ))
          )}

          {/* Tool call indicators */}
          {activeToolCalls.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              Looking up {activeToolCalls.join(", ").replace(/_/g, " ")}…
            </div>
          )}
        </div>

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </div>

      {/* RIGHT PANE — Artifact panel */}
      <div className="hidden lg:flex flex-1 flex-col bg-zinc-900">
        {selectedArtifact ? (
          <>
            {/* Stale indicator — shown when selected artifact isn't from the latest assistant message */}
            {(() => {
              const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
              const isStale =
                lastAssistant &&
                lastAssistant.artifact?.id !== selectedArtifact.id &&
                selectedArtifact.code !== ""; // suppress during generation
              return isStale ? (
                <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-800 border-b border-zinc-700 text-xs text-zinc-400">
                  <span>Showing artifact from a previous response</span>
                  {lastAssistant?.artifact && (
                    <button
                      onClick={() => lastAssistant.artifact && setSelectedArtifact(lastAssistant.artifact)}
                      className="text-orange-400 hover:text-orange-300 font-medium"
                    >
                      Jump to latest →
                    </button>
                  )}
                </div>
              ) : null;
            })()}
            <ArtifactRenderer artifact={selectedArtifact} />
          </>
        ) : (
          <ArtifactPlaceholder />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Zap size={28} className="text-orange-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">How can I help?</h2>
        <p className="text-sm text-zinc-500 max-w-xs">
          Ask about duty cycles, polarity, troubleshooting, or upload a photo of your weld for diagnosis.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="w-full text-left px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-600 text-sm text-zinc-300 hover:text-white transition-all flex items-center gap-2 group"
          >
            <ChevronRight size={14} className="text-zinc-600 group-hover:text-orange-400 flex-shrink-0" />
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function ArtifactPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-12 h-12 rounded-xl border border-zinc-700 flex items-center justify-center mb-4">
        <span className="text-2xl">⚡</span>
      </div>
      <h3 className="text-sm font-medium text-zinc-400 mb-2">Interactive artifacts appear here</h3>
      <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
        Ask about duty cycles, polarity setup, or troubleshooting — the assistant will generate
        interactive diagrams, calculators, and flowcharts.
      </p>
    </div>
  );
}
