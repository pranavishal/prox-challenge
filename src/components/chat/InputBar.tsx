"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Send, X } from "lucide-react";
import type { ImageData } from "@/lib/types";

interface Props {
  onSend: (text: string, image?: ImageData) => void;
  disabled: boolean;
}

export function InputBar({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<ImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    onSend(trimmed || "What do you see in this weld?", image ?? undefined);
    setText("");
    setImage(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      // Extract base64 data and media type
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      setImage({ base64, mediaType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="border-t border-zinc-700 bg-zinc-900 p-4">
      {/* Image preview */}
      {image && (
        <div className="relative inline-block mb-3">
          <img
            src={image.preview}
            alt="Upload preview"
            className="h-16 w-16 rounded-lg object-cover border border-zinc-600"
          />
          <button
            onClick={() => setImage(null)}
            className="absolute -top-1.5 -right-1.5 bg-zinc-700 rounded-full p-0.5 hover:bg-zinc-600 transition-colors"
          >
            <X size={12} className="text-zinc-300" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Image upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex-shrink-0 h-10 w-10 border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-orange-400"
          title="Upload weld photo for diagnosis"
        >
          <ImagePlus size={16} />
        </Button>

        {/* Text input */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about duty cycles, polarity, troubleshooting… or upload a weld photo"
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-10 max-h-32 resize-none bg-zinc-800 border-zinc-600 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-orange-500/50 focus-visible:border-orange-500/50"
        />

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !image)}
          size="icon"
          className="flex-shrink-0 h-10 w-10 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40"
        >
          <Send size={16} />
        </Button>
      </div>

      <p className="text-xs text-zinc-600 mt-2 text-center">
        Shift+Enter for new line · Upload a weld photo for visual diagnosis
      </p>
    </div>
  );
}
