/**
 * Specs Tool
 *
 * Precise lookups against data/specs.json — max amperages, weldable materials,
 * wire sizes, power requirements, and general machine info.
 * Use this for any question about what the machine can or can't do.
 */

import specsData from "../../../data/specs.json";

export type SpecsCategory =
  | "product"
  | "MIG"
  | "TIG"
  | "Stick"
  | "Flux-Cored"
  | "power_requirements"
  | "all";

export function lookupSpecs(category: SpecsCategory) {
  if (category === "all") return specsData;

  // Flux-Cored shares MIG specs (same wire feed hardware)
  const key = category === "Flux-Cored" ? "MIG" : category;

  const data = specsData[key as keyof typeof specsData];
  if (!data) return { error: `Unknown category: ${category}` };

  return {
    category,
    ...(typeof data === "object" ? data : { value: data }),
  };
}

export const specsTool = {
  name: "lookup_specs",
  description:
    "Look up precise machine specifications: maximum amperage per process and voltage, weldable materials, wire sizes, wire speed range, power requirements, OCV, and general product info. Use this for questions like 'what's the max amperage for TIG on 240V?', 'can this weld aluminum?', 'what wire sizes does it support?', or 'what circuit do I need?'.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        enum: ["product", "MIG", "Flux-Cored", "TIG", "Stick", "power_requirements", "all"],
        description:
          "Which spec category to retrieve. Use 'all' for a full overview, or a specific process/category for targeted lookup.",
      },
    },
    required: ["category"],
  },
};
