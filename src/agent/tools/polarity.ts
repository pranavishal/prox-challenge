/**
 * Polarity Tool
 *
 * Returns exact cable connection instructions for any welding process.
 * Polarity mistakes can damage welds and equipment — precision matters here.
 */

import polarityData from "../../../data/polarity.json";

export type Process = "MIG" | "Flux-Cored" | "TIG" | "Stick";

export interface PolarityResult {
  process: Process;
  polarity: string;
  polarity_full: string;
  ground_clamp: string;
  electrode_cable: string;
  shielding_gas: string;
  gas_flow_scfh: { min: number; max: number } | null;
  wire_feed_connected: boolean;
  steps: string[];
  notes: string;
  socket_layout: string;
}

export function lookupPolarity(process: Process): PolarityResult | { error: string } {
  const processData =
    polarityData.processes[process as keyof typeof polarityData.processes];

  if (!processData) {
    return {
      error: `Unknown process: ${process}. Valid options: MIG, Flux-Cored, TIG, Stick`,
    };
  }

  return {
    process,
    ...processData,
    socket_layout: polarityData.socket_layout.description,
  } as PolarityResult;
}

export const polarityTool = {
  name: "lookup_polarity",
  description:
    "Look up the exact cable polarity setup and connection steps for a welding process. Returns which cable goes in which socket (positive/negative), whether shielding gas is needed, and step-by-step connection instructions. Use this for any question about cable setup, polarity, socket connections, or 'which plug goes where'.",
  input_schema: {
    type: "object" as const,
    properties: {
      process: {
        type: "string",
        enum: ["MIG", "Flux-Cored", "TIG", "Stick"],
        description: "The welding process to get polarity setup for",
      },
    },
    required: ["process"],
  },
};
