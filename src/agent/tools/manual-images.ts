/**
 * Manual Images Tool
 *
 * Returns URLs of relevant manual page images based on what the user is asking about.
 * Images are served statically from /manual-images/ and pre-extracted from the PDFs.
 *
 * The catalog in data/manual-images.json maps keywords → page images so the agent
 * can surface the actual manual page rather than describing it in prose.
 */

import catalog from "../../../data/manual-images.json";

export interface ManualImageResult {
  id: string;
  file: string;
  url: string;
  title: string;
  description: string;
}

export function getManualImages(query: string): ManualImageResult[] {
  const q = query.toLowerCase();

  const scored = catalog.images.map((img) => {
    let score = 0;

    // Keyword match against the keywords array
    for (const keyword of img.keywords) {
      if (q.includes(keyword.toLowerCase())) {
        // Longer keyword matches score higher (more specific)
        score += keyword.length;
      }
    }

    // Also match against title and description for broader coverage
    const titleWords = img.title.toLowerCase().split(/\s+/);
    const descWords = img.description.toLowerCase().split(/\s+/);
    const queryWords = q.split(/\s+/);

    for (const qWord of queryWords) {
      if (qWord.length < 3) continue; // skip short words
      if (titleWords.some((w) => w.includes(qWord))) score += 3;
      if (descWords.some((w) => w.includes(qWord))) score += 1;
    }

    return { score, img };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ img }) => ({
      id: img.id,
      file: img.file,
      url: `/manual-images/${img.file}`,
      title: img.title,
      description: img.description,
    }));
}

export const manualImagesTool = {
  name: "get_manual_images",
  description:
    "Retrieve relevant images from the owner's manual to show the user. Use this when a question involves something visual — a diagram, schematic, setup photo, weld diagnosis example, or control panel. Returns image URLs and descriptions. Always call this alongside your text answer when the topic has a relevant manual image.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description:
          "What to find an image for. Be specific: e.g. 'MIG polarity cable setup', 'porosity weld defect', 'front panel controls', 'wire feed mechanism', 'TIG tungsten preparation', 'wiring schematic'.",
      },
    },
    required: ["query"],
  },
};
