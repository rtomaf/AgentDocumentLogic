export interface PluginConfig {
  openaiApiKey: string;
  stateDir: string;
  defaultTokenBudget: number;
  defaultOverlapTokens: number;
  maxRetries: number;
  reasoningEffort: "low" | "medium" | "high";
}

export const DEFAULT_CONFIG: Omit<PluginConfig, "openaiApiKey"> = {
  stateDir: "./state",
  defaultTokenBudget: 50000,
  defaultOverlapTokens: 500,
  maxRetries: 3,
  reasoningEffort: "medium",
};

export function resolveConfig(partial: Partial<PluginConfig> & { openaiApiKey: string }): PluginConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
  };
}
