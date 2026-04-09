/**
 * Duty Cycle Tool
 *
 * Provides exact duty cycle data for any process/voltage/amperage combination.
 * Backed by structured JSON — no hallucination risk on technical specs.
 *
 * When `amperage` is passed, `at_query` holds the effective duty cycle at that
 * current; top-level `weld_minutes` / `rest_minutes` stay the manual's rated row.
 */

import dutyCycleData from "../../../data/duty-cycle.json";

export type Process = "MIG" | "Flux-Cored" | "TIG" | "Stick";
export type Voltage = "120V" | "240V";

/** Effective limits at a specific queried amperage (per 10-minute window). */
export interface DutyCycleAtQuery {
  amperage: number;
  /** null = outside supported current range (see interpretation) */
  duty_cycle_pct: number | null;
  weld_minutes: number | null;
  rest_minutes: number | null;
}

export interface DutyCycleResult {
  process: Process;
  voltage: Voltage;
  /** Rated row from the manual (not necessarily the queried amperage). */
  rated_duty_cycle_pct: number;
  rated_amperage: number;
  /** Weld minutes at the rated point per 10-minute window. */
  weld_minutes: number;
  /** Rest minutes at the rated point per 10-minute window. */
  rest_minutes: number;
  continuous_amperage: number;
  current_range: { min: number; max: number };
  interpretation: string;
  /** Present when `amperage` was requested — use these for UI/artifacts at that current. */
  at_query?: DutyCycleAtQuery;
}

export function lookupDutyCycle(
  process: Process,
  voltage: Voltage,
  queryAmperage?: number
): DutyCycleResult | { error: string } {
  const processData =
    dutyCycleData.processes[process as keyof typeof dutyCycleData.processes];
  if (!processData) {
    return { error: `Unknown process: ${process}. Valid: MIG, Flux-Cored, TIG, Stick` };
  }

  const voltageData = processData[voltage as keyof typeof processData] as any;
  if (!voltageData) {
    return { error: `No data for ${process} at ${voltage}` };
  }

  const rated = voltageData.rated;
  const continuous = voltageData.continuous;
  const range = voltageData.current_range;

  let interpretation = "";
  let atQuery: DutyCycleAtQuery | undefined;

  if (typeof queryAmperage === "number" && Number.isFinite(queryAmperage)) {
    const q = queryAmperage;
    const baseAtQuery = (): DutyCycleAtQuery => ({
      amperage: q,
      duty_cycle_pct: null,
      weld_minutes: null,
      rest_minutes: null,
    });

    if (q > range.max) {
      interpretation = `⚠️ ${q}A exceeds the maximum ${range.max}A for ${process} on ${voltage}.`;
      atQuery = baseAtQuery();
    } else if (q < range.min) {
      interpretation = `⚠️ ${q}A is below the minimum ${range.min}A for ${process} on ${voltage} — duty cycle specs apply within the machine's current range.`;
      atQuery = baseAtQuery();
    } else if (q <= continuous.amperage) {
      interpretation = `At ${q}A you can weld continuously (100% duty cycle) — this is at or below the ${continuous.amperage}A continuous threshold.`;
      atQuery = {
        amperage: q,
        duty_cycle_pct: 100,
        weld_minutes: 10,
        rest_minutes: 0,
      };
    } else if (q === rated.amperage) {
      interpretation = `At ${q}A: ${rated.duty_cycle_pct}% duty cycle — ${rated.weld_minutes} minutes of welding per 10-minute window, with ${rated.rest_minutes} minutes rest.`;
      atQuery = {
        amperage: q,
        duty_cycle_pct: rated.duty_cycle_pct,
        weld_minutes: rated.weld_minutes,
        rest_minutes: rated.rest_minutes,
      };
    } else {
      // Linear interpolation: 100% at continuous.amperage down to rated% at rated.amperage
      const pct = Math.round(
        rated.duty_cycle_pct +
          ((rated.amperage - q) / (rated.amperage - continuous.amperage)) *
            (100 - rated.duty_cycle_pct)
      );
      const weldMins = (pct / 100) * 10;
      const restMins = 10 - weldMins;
      interpretation = `At ${q}A: approximately ${pct}% duty cycle — about ${weldMins.toFixed(1)} minutes of welding per 10-minute window, with ${restMins.toFixed(1)} minutes rest.`;
      atQuery = {
        amperage: q,
        duty_cycle_pct: pct,
        weld_minutes: Number(weldMins.toFixed(1)),
        rest_minutes: Number(restMins.toFixed(1)),
      };
    }
  } else {
    interpretation = `Rated: ${rated.duty_cycle_pct}% at ${rated.amperage}A (${rated.weld_minutes} min weld / ${rated.rest_minutes} min rest). Continuous: 100% at ${continuous.amperage}A or below.`;
  }

  const result: DutyCycleResult = {
    process,
    voltage,
    rated_duty_cycle_pct: rated.duty_cycle_pct,
    rated_amperage: rated.amperage,
    weld_minutes: rated.weld_minutes,
    rest_minutes: rated.rest_minutes,
    continuous_amperage: continuous.amperage,
    current_range: range,
    interpretation,
  };

  if (atQuery !== undefined) {
    result.at_query = atQuery;
  }

  return result;
}

// Tool definition in Anthropic SDK format
export const dutyCycleTool = {
  name: "lookup_duty_cycle",
  description:
    "Look up duty cycle for a welding process and input voltage. Optionally pass amperage for the effective duty cycle at that current. When amperage is provided, use the `at_query` object (duty_cycle_pct, weld_minutes, rest_minutes) for charts and numbers at that setting — those match the interpretation. Top-level weld_minutes/rest_minutes are only the manual's rated-point row, not the queried amperage.",
  input_schema: {
    type: "object" as const,
    properties: {
      process: {
        type: "string",
        enum: ["MIG", "Flux-Cored", "TIG", "Stick"],
        description: "The welding process",
      },
      voltage: {
        type: "string",
        enum: ["120V", "240V"],
        description: "Input voltage being used",
      },
      amperage: {
        type: "number",
        description:
          "Optional: specific output amperage. If set, response includes `at_query` with effective duty cycle and per-10-minute weld/rest minutes at that current.",
      },
    },
    required: ["process", "voltage"],
  },
};
