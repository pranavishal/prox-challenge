/**
 * Tool Registry
 *
 * Single export point for all agent tools.
 * To add a new tool: create a file in this directory, export the tool definition
 * and handler function, then add both to the exports below.
 */

export { dutyCycleTool, lookupDutyCycle } from "./duty-cycle";
export { polarityTool, lookupPolarity } from "./polarity";
export { settingsTool, recommendSettings } from "./settings";
export { troubleshootingTool, getTroubleshooting } from "./troubleshooting";
export { specsTool, lookupSpecs } from "./specs";
export { manualImagesTool, getManualImages } from "./manual-images";

import { dutyCycleTool } from "./duty-cycle";
import { polarityTool } from "./polarity";
import { settingsTool } from "./settings";
import { troubleshootingTool } from "./troubleshooting";
import { specsTool } from "./specs";
import { manualImagesTool } from "./manual-images";

// All tool definitions for the Anthropic API
export const ALL_TOOLS = [dutyCycleTool, polarityTool, settingsTool, troubleshootingTool, specsTool, manualImagesTool];
