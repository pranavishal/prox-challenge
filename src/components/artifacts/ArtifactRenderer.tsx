"use client";

/**
 * ArtifactRenderer
 *
 * Renders Claude-generated React code in a sandboxed iframe.
 * The iframe loads /artifact-runtime.html which has React + Tailwind pre-loaded.
 * Communication is via postMessage.
 *
 * Loading states:
 * - `runtimeReady` false  → iframe hasn't initialised yet (first load only)
 * - `isRendering` true    → code has been sent, waiting for render-complete from iframe
 * - both clear            → component is live
 */

import { useEffect, useRef, useState } from "react";
import type { Artifact } from "@/lib/types";

interface Props {
  artifact: Artifact;
}

export function ArtifactRenderer({ artifact }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);

  // Listen for messages from the iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "runtime-ready") {
        setRuntimeReady(true);
      }
      if (event.data?.type === "render-complete") {
        setIsRendering(false);
      }
      if (event.data?.type === "resize" && event.data.height) {
        setIframeHeight(Math.max(200, Math.min(event.data.height + 32, 2000)));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send code to iframe once runtime is ready (first load)
  useEffect(() => {
    if (runtimeReady && iframeRef.current?.contentWindow && artifact.code) {
      setIsRendering(true);
      iframeRef.current.contentWindow.postMessage(
        { type: "render-artifact", code: artifact.code },
        "*"
      );
    }
  }, [runtimeReady]);

  // Re-send when artifact id changes (new question / different message selected)
  // OR when code goes from empty → populated (generation complete for current artifact)
  useEffect(() => {
    if (runtimeReady && iframeRef.current?.contentWindow && artifact.code) {
      setIsRendering(true);
      iframeRef.current.contentWindow.postMessage(
        { type: "render-artifact", code: artifact.code },
        "*"
      );
    }
  }, [artifact.id, artifact.code]);

  const isGenerating = artifact.code === "";
  const showLoader = !runtimeReady || isRendering || isGenerating;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-700 bg-zinc-800/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-zinc-400 font-medium ml-1">{artifact.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {(isGenerating || isRendering) && (
            <span className="text-xs text-orange-400 animate-pulse">
              {isGenerating ? "Generating…" : "Rendering…"}
            </span>
          )}
          <span className="text-xs text-zinc-600 uppercase tracking-wider">Interactive</span>
        </div>
      </div>

      {/* Iframe + loading overlay — stacked so old content stays visible until new is ready */}
      <div className="flex-1 bg-zinc-900 relative overflow-y-auto">
        <iframe
          ref={iframeRef}
          src="/artifact-runtime.html"
          sandbox="allow-scripts allow-same-origin"
          className="w-full border-0 bg-transparent"
          style={{ height: `${iframeHeight}px` }}
          title={artifact.title}
        />

        {/* Overlay — covers stale content while next artifact renders.
            Fades in immediately on transition, fades out once render-complete fires. */}
        {showLoader && (
          <div className="absolute inset-0 bg-zinc-900/90 flex flex-col items-center justify-center gap-3 transition-opacity duration-200">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">
              {!runtimeReady ? "Loading runtime…" : isGenerating ? "Generating artifact…" : "Rendering artifact…"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
