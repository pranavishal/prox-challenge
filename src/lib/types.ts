/**
 * Shared types used across the application.
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact;
  imagePreview?: string; // base64 data URL for display
  manualImages?: ManualImage[];
  toolsUsed?: string[];
}

export interface ManualImage {
  id: string;
  url: string;
  title: string;
  description: string;
}

export interface Artifact {
  id: string;
  type: string;
  title: string;
  code: string;
}

export interface ImageData {
  base64: string;
  mediaType: string;
  preview: string; // data URL for display
}
