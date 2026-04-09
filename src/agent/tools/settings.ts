/**
 * Settings Tool
 *
 * Recommends welding process and settings based on material, thickness, and context.
 * Also provides wire/tension/gas configuration details.
 */

import settingsData from "../../../data/settings.json";

export interface ProcessRecommendation {
  recommended_process: string;
  reason: string;
  shielding_gas: boolean;
  gas_type?: string;
  gas_flow_scfh?: string;
  wire_tension?: string;
  gun_angle?: string;
  ctwd?: string;
  skill_level: string;
  pros: string[];
  cons: string[];
  thickness_range: string;
  materials: string[];
}

// Gauge to inches (sheet metal standard gauges)
const GAUGE_TO_INCHES: Record<number, number> = {
  7: 0.179, 8: 0.164, 10: 0.135, 11: 0.12, 12: 0.105, 14: 0.075,
  16: 0.060, 18: 0.047, 20: 0.036, 22: 0.030, 24: 0.024, 26: 0.018,
};

// Parse a thickness string like "1/8 inch", "22 gauge", "3/16\"", "0.125" into inches
function parseThicknessInches(thickness: string): number | null {
  const t = thickness.toLowerCase().trim();

  // Gauge: "22 gauge", "22ga"
  const gaugeMatch = t.match(/(\d+)\s*(?:gauge|ga\b)/);
  if (gaugeMatch) {
    const g = parseInt(gaugeMatch[1]);
    return GAUGE_TO_INCHES[g] ?? null;
  }

  // Fraction: "1/8", "3/16", "1/4"
  const fracMatch = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);

  // Decimal: "0.125"
  const decMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|")?/);
  if (decMatch) return parseFloat(decMatch[1]);

  return null;
}

// Parse a thickness_range string like "22 gauge to 3/8\"" into [minInches, maxInches]
function parseThicknessRange(range: string): [number, number] | null {
  const parts = range.toLowerCase().split(/\s+to\s+/);
  if (parts.length !== 2) return null;
  const min = parseThicknessInches(parts[0]);
  const max = parseThicknessInches(parts[1]);
  if (min === null || max === null) return null;
  return [min, max];
}

export function recommendSettings(params: {
  material?: string;
  thickness?: string;
  have_gas?: boolean;
  skill_level?: string;
  environment?: "indoor" | "outdoor";
}): ProcessRecommendation[] {
  const scored: Array<{ score: number; result: ProcessRecommendation }> = [];
  const { material, thickness, have_gas, skill_level, environment } = params;

  const thicknessInches = thickness ? parseThicknessInches(thickness) : null;

  const processes = settingsData.process_selection;

  for (const [name, data] of Object.entries(processes)) {
    let score = 0;

    // Score based on gas availability
    if (have_gas === false && !data.shielding_gas) score += 3;
    if (have_gas === true && data.shielding_gas) score += 2;

    // Score based on environment
    if (environment === "outdoor" && (name === "Flux-Cored" || name === "Stick")) score += 2;
    if (environment === "indoor" && (name === "MIG" || name === "TIG")) score += 1;

    // Score based on skill level
    if (skill_level === "beginner" && (name === "MIG" || name === "Flux-Cored")) score += 2;
    if (skill_level === "advanced" && name === "TIG") score += 2;
    if (skill_level === "intermediate" && name === "Stick") score += 1;

    // Score based on thickness — +3 if in range, -2 if clearly out of range
    if (thicknessInches !== null) {
      const range = parseThicknessRange(data.thickness_range);
      if (range) {
        const [min, max] = range;
        if (thicknessInches >= min && thicknessInches <= max) {
          score += 3;
        } else if (thicknessInches < min * 0.8 || thicknessInches > max * 1.2) {
          score -= 2; // well outside range
        }
      }
    }

    // Score based on material
    if (material) {
      const mat = material.toLowerCase();
      if (mat.includes("aluminum") && name === "MIG") score += 3;
      if (mat.includes("aluminum") && name === "TIG") score += 4;
      if (mat.includes("stainless") && (name === "MIG" || name === "TIG")) score += 2;
      if ((mat.includes("steel") || mat.includes("iron")) && score < 2) score += 1;
    }

    const gasData = data.shielding_gas
      ? settingsData.shielding_gas_setup[name as keyof typeof settingsData.shielding_gas_setup]
      : null;

    scored.push({
      score,
      result: {
        recommended_process: name,
        reason: buildReason(name, params),
        shielding_gas: data.shielding_gas as boolean,
        gas_type: (gasData as any)?.gas,
        gas_flow_scfh: gasData
          ? `${(gasData as any).flow_rate_scfh.min}–${(gasData as any).flow_rate_scfh.max} SCFH`
          : undefined,
        wire_tension:
          name === "MIG"
            ? "3–5 (solid wire)"
            : name === "Flux-Cored"
            ? "2–3 (flux-cored wire)"
            : undefined,
        gun_angle:
          name === "MIG"
            ? "Push angle: 0–15° away from weld direction"
            : name === "Flux-Cored"
            ? "Drag angle: 0–15° toward weld direction"
            : undefined,
        ctwd: name === "MIG" || name === "Flux-Cored" ? "≤ 1/2 inch (12mm)" : undefined,
        skill_level: data.skill_level,
        pros: data.pros,
        cons: data.cons,
        thickness_range: data.thickness_range,
        materials: data.materials,
      },
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.result);
}

function buildReason(process: string, params: any): string {
  const reasons: Record<string, string> = {
    MIG: "MIG is the easiest to learn, produces clean welds with minimal spatter, and is ideal for indoor use on clean steel and aluminum.",
    "Flux-Cored":
      "Flux-Cored requires no shielding gas, works well outdoors and on rusty/dirty metal, and is very forgiving for beginners.",
    TIG: "TIG produces the highest quality, cleanest welds but requires significant skill and a separate foot pedal.",
    Stick:
      "Stick welding is highly portable, needs no gas, and works well on thicker materials and in outdoor/windy conditions.",
  };
  return reasons[process] || "";
}

export const settingsTool = {
  name: "recommend_settings",
  description:
    "Recommend welding process and settings based on material type, thickness, gas availability, skill level, and environment. Returns process recommendations with pros/cons, gas requirements, wire tension, and gun angles. Use when someone asks 'what process should I use' or 'what settings for X material at Y thickness'.",
  input_schema: {
    type: "object" as const,
    properties: {
      material: {
        type: "string",
        description: "Material to weld (e.g., mild steel, stainless steel, aluminum)",
      },
      thickness: {
        type: "string",
        description: "Material thickness (e.g., 1/8 inch, 22 gauge, 3/16 inch)",
      },
      have_gas: {
        type: "boolean",
        description: "Whether the user has shielding gas available",
      },
      skill_level: {
        type: "string",
        enum: ["beginner", "intermediate", "advanced"],
        description: "User's welding skill level",
      },
      environment: {
        type: "string",
        enum: ["indoor", "outdoor"],
        description: "Welding environment — outdoor conditions affect gas shielding",
      },
    },
    required: [],
  },
};
