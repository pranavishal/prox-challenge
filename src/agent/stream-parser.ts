/**
 * Stream Parser
 *
 * Parses Claude's streaming text output and separates:
 * 1. Regular text content → displayed in the chat bubble
 * 2. <artifact> XML blocks → extracted and sent to the artifact renderer
 *
 * Artifact format:
 *   <artifact type="react" title="My Title">
 *     export default function MyComponent() { ... }
 *   </artifact>
 *
 * This runs on the client side, processing each streamed chunk.
 */

export type ParsedChunk =
  | { type: "text"; content: string }
  | { type: "artifact_start"; artifactType: string; title: string }
  | { type: "artifact_content"; content: string }
  | { type: "artifact_end" };

export interface ParsedArtifact {
  id: string;
  type: string;
  title: string;
  code: string;
}

export class StreamParser {
  private buffer = "";
  private inArtifact = false;
  private artifactType = "";
  private artifactTitle = "";
  private artifactContent = "";

  /**
   * Process a new chunk from the stream.
   * Returns an array of parsed events to handle.
   */
  processChunk(chunk: string): ParsedChunk[] {
    this.buffer += chunk;
    const events: ParsedChunk[] = [];

    // Process until buffer is stable (no partial tags to wait on)
    let continueProcessing = true;
    while (continueProcessing) {
      continueProcessing = false;

      if (!this.inArtifact) {
        // Look for artifact opening tag
        const startTagMatch = this.buffer.match(
          /<artifact\s+type="([^"]+)"\s+title="([^"]+)">/
        );

        if (startTagMatch) {
          const tagIndex = this.buffer.indexOf(startTagMatch[0]);

          // Emit any text before the tag
          if (tagIndex > 0) {
            events.push({ type: "text", content: this.buffer.slice(0, tagIndex) });
          }

          this.inArtifact = true;
          this.artifactType = startTagMatch[1];
          this.artifactTitle = startTagMatch[2];
          this.artifactContent = "";
          this.buffer = this.buffer.slice(tagIndex + startTagMatch[0].length);

          events.push({
            type: "artifact_start",
            artifactType: this.artifactType,
            title: this.artifactTitle,
          });

          continueProcessing = true;
        } else if (!this.buffer.includes("<artifact")) {
          // No artifact tag coming — emit all as text
          if (this.buffer.length > 0) {
            events.push({ type: "text", content: this.buffer });
            this.buffer = "";
          }
        }
        // If buffer contains partial "<artifact" — wait for more chunks
      } else {
        // Inside an artifact — look for closing tag
        const endTagIndex = this.buffer.indexOf("</artifact>");

        if (endTagIndex !== -1) {
          // Emit artifact content
          const content = this.buffer.slice(0, endTagIndex);
          if (content) {
            events.push({ type: "artifact_content", content });
            this.artifactContent += content;
          }

          events.push({ type: "artifact_end" });
          this.inArtifact = false;
          this.buffer = this.buffer.slice(endTagIndex + "</artifact>".length);
          continueProcessing = true;
        } else {
          // Still inside artifact — accumulate content
          // Keep last 12 chars in buffer in case "</artifact>" is split across chunks
          const safeLen = Math.max(0, this.buffer.length - 12);
          if (safeLen > 0) {
            const content = this.buffer.slice(0, safeLen);
            events.push({ type: "artifact_content", content });
            this.artifactContent += content;
            this.buffer = this.buffer.slice(safeLen);
          }
        }
      }
    }

    return events;
  }

  /** Flush any remaining buffer content at stream end */
  flush(): ParsedChunk[] {
    const events: ParsedChunk[] = [];
    if (this.buffer.length > 0) {
      if (this.inArtifact) {
        events.push({ type: "artifact_content", content: this.buffer });
        this.artifactContent += this.buffer;
      } else {
        events.push({ type: "text", content: this.buffer });
      }
      this.buffer = "";
    }
    return events;
  }

  /** Get the complete artifact assembled so far */
  getCurrentArtifact(): Omit<ParsedArtifact, "id"> {
    return {
      type: this.artifactType,
      title: this.artifactTitle,
      code: this.artifactContent,
    };
  }
}
