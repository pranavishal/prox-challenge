"use client";

import { Badge } from "@/components/ui/badge";
import type { Message as MessageType } from "@/lib/types";
import { Wrench } from "lucide-react";

interface Props {
  message: MessageType;
  onSelectArtifact: (message: MessageType) => void;
  isSelected: boolean;
}

// Inline formatting: bold, code
function formatInline(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, j) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={j} className="bg-zinc-700 text-orange-300 px-1 py-0.5 rounded text-sm font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Detect a markdown table block — consecutive lines that start and end with |
function isTableRow(line: string) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorRow(line: string) {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
}

// Simple markdown-ish renderer — bold, inline code, tables, line breaks
function renderContent(text: string) {
  const lines = text.split("\n");
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection — collect all consecutive table lines
    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTableRow(lines[i]) || isSeparatorRow(lines[i]))) {
        tableLines.push(lines[i]);
        i++;
      }

      const nonSep = tableLines.filter((l) => !isSeparatorRow(l));
      if (nonSep.length >= 2) {
        const [headerRow, ...bodyRows] = nonSep;
        const headers = parseTableRow(headerRow);
        output.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-zinc-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-900">
                  {headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 text-left font-semibold text-zinc-300 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-zinc-800/40" : "bg-zinc-800/20"}>
                    {parseTableRow(row).map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    const formatted = formatInline(line);

    if (line.startsWith("## ")) {
      output.push(<h3 key={i} className="text-sm font-semibold text-zinc-200 mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      output.push(<h2 key={i} className="text-base font-bold text-white mt-3 mb-1">{line.slice(2)}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      output.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        output.push(
          <div key={i} className="flex gap-2 my-0.5">
            <span className="text-orange-400 font-mono text-sm flex-shrink-0">{match[1]}.</span>
            <span>{formatInline(match[2])}</span>
          </div>
        );
      }
    } else if (line === "") {
      output.push(<div key={i} className="h-2" />);
    } else {
      output.push(<div key={i}>{formatted}</div>);
    }

    i++;
  }

  return output;
}

export function Message({ message, onSelectArtifact, isSelected }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${isUser ? "bg-orange-500 text-white" : "bg-zinc-700 text-zinc-300"}`}
      >
        {isUser ? "You" : "V"}
      </div>

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Image preview if attached */}
        {message.imagePreview && (
          <img
            src={message.imagePreview}
            alt="Uploaded weld"
            className="rounded-lg max-w-[200px] max-h-[150px] object-cover border border-zinc-600"
          />
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? "bg-orange-500 text-white rounded-tr-sm"
              : "bg-zinc-800 text-zinc-200 rounded-tl-sm"
            }`}
        >
          {renderContent(message.content)}
        </div>

        {/* Tool use badges */}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.toolsUsed.map((tool) => (
              <Badge
                key={tool}
                variant="outline"
                className="text-xs border-zinc-600 text-zinc-400 flex items-center gap-1 h-5"
              >
                <Wrench size={9} />
                {tool.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}

        {/* Manual images gallery */}
        {message.manualImages && message.manualImages.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 w-full">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">From the manual</p>
            <div className="grid grid-cols-2 gap-2">
              {message.manualImages.map((img) => (
                <a
                  key={img.id}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-lg overflow-hidden border border-zinc-700 hover:border-orange-500/50 transition-all bg-zinc-900"
                >
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-28 object-cover object-top group-hover:opacity-90 transition-opacity"
                  />
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-zinc-300 group-hover:text-orange-300 transition-colors leading-tight line-clamp-2">
                      {img.title}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Artifact button */}
        {message.artifact && (
          <button
            onClick={() => onSelectArtifact(message)}
            className={`mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
              ${isSelected
                ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                : "bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-orange-500/50 hover:text-orange-300"
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-none" />
            {message.artifact.title}
          </button>
        )}
      </div>
    </div>
  );
}
