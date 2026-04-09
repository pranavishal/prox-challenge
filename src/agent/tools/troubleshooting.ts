/**
 * Troubleshooting Tool
 *
 * Graph-based troubleshooting lookup. Problems are nodes; causes and solutions are edges.
 * Returns structured data that the agent can use to generate interactive flowchart artifacts.
 */

import troubleshootingData from "../../../data/troubleshooting.json";

export interface TroubleshootingResult {
  matched_problems: ProblemNode[];
  total_matches: number;
}

export interface ProblemNode {
  id: string;
  label: string;
  process: string[];
  causes: CauseNode[];
}

export interface CauseNode {
  id: string;
  label: string;
  solutions: string[];
}

export function getTroubleshooting(params: {
  symptom: string;
  process?: string;
}): TroubleshootingResult {
  const { symptom, process } = params;
  const query = symptom.toLowerCase().trim();

  // Empty query matches every string via "".includes("") — would return the whole graph
  if (!query) {
    return { matched_problems: [], total_matches: 0 };
  }

  const matchedProblems: ProblemNode[] = [];

  for (const [, node] of Object.entries(troubleshootingData.nodes)) {
    const problemNode = node as any;

    // Match by keyword in label, id, or process
    const labelMatch = problemNode.label.toLowerCase().includes(query);
    const idMatch = problemNode.id.toLowerCase().replace(/_/g, " ").includes(query);

    // Also match common synonyms
    const synonymMatches = checkSynonyms(query, problemNode.id);

    // Filter by process if specified
    const processMatch =
      !process || problemNode.process.includes(process);

    if ((labelMatch || idMatch || synonymMatches) && processMatch) {
      // Resolve causes to full cause objects with solutions
      const resolvedCauses: CauseNode[] = problemNode.causes
        .map((causeId: string) => {
          const cause = (troubleshootingData.causes as any)[causeId];
          if (!cause) return null;
          return {
            id: causeId,
            label: cause.label,
            solutions: cause.solutions,
          };
        })
        .filter(Boolean);

      matchedProblems.push({
        id: problemNode.id,
        label: problemNode.label,
        process: problemNode.process,
        causes: resolvedCauses,
      });
    }
  }

  return {
    matched_problems: matchedProblems,
    total_matches: matchedProblems.length,
  };
}

function checkSynonyms(query: string, nodeId: string): boolean {
  const synonymMap: Record<string, string[]> = {
    birds_nest: ["tangle", "bird", "nest", "kink", "jam"],
    porosity: ["holes", "porous", "bubbles", "cavity", "cavities", "pit"],
    wire_not_feeding: ["not feed", "wont feed", "won't feed", "feed problem"],
    arc_not_stable: ["unstable", "erratic", "sputter", "sputtering"],
    burn_through: ["hole", "burn through", "melted through"],
    excess_penetration: ["too deep", "droops", "fallen through"],
    inadequate_penetration: ["not deep", "surface", "shallow", "not penetrating"],
    excessive_spatter: ["spatter", "messy", "splatter"],
    weld_not_adhering: ["not sticking", "gaps", "not adhering", "falling off"],
    weak_arc: ["weak", "no power", "low power"],
    crooked_bead: ["crooked", "wavy", "uneven", "wobbly"],
  };

  const synonyms = synonymMap[nodeId] || [];
  return synonyms.some((s) => query.includes(s));
}

export const troubleshootingTool = {
  name: "get_troubleshooting",
  description:
    "Look up troubleshooting information for a welding problem. Returns matching problems with all possible causes and their solutions, structured for generating a visual flowchart. Use when someone describes a welding problem, defect, or symptom.",
  input_schema: {
    type: "object" as const,
    properties: {
      symptom: {
        type: "string",
        description:
          "Description of the problem or symptom (e.g., 'porosity', 'wire not feeding', 'burn through', 'bird's nest', 'arc not stable')",
      },
      process: {
        type: "string",
        enum: ["MIG", "Flux-Cored", "TIG", "Stick"],
        description: "Optional: filter results by welding process",
      },
    },
    required: ["symptom"],
  },
};
