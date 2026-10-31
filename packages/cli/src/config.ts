import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderName } from "@dugout/core";

export interface Config {
  models: { implement: Record<ProviderName, string>; review: Record<ProviderName, string> };
  verifyTimeoutMs: number;
  claude: { allowedTools: string[] };
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

function object(value: unknown, key: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(`${key} must be an object`);
  }
  return value as Record<string, unknown>;
}

function timeout(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new ConfigError(`${key} must be an integer between 1 and 2147483647`);
  }
  return value;
}

export function loadConfig(file = join(homedir(), ".dugout", "config.json")): Config {
  const config: Config = {
    models: {
      implement: { codex: "gpt-6.1-sol", claude: "claude-sonnet-5-5", fake: "fake" },
      review: { codex: "gpt-6.1-sol", claude: "claude-sonnet-5-5", fake: "fake" },
    },
    verifyTimeoutMs: 600000,
    claude: { allowedTools: ["Write", "Edit", "Read"] },
  };
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return config;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ConfigError("config: invalid JSON");
  }
  const root = object(parsed, "config");
  if ("models" in root) {
    const models = object(root.models, "models");
    for (const provider of ["codex", "claude", "fake"] as const) {
      if (!(provider in models)) continue;
      const roles = object(models[provider], `models.${provider}`);
      for (const role of ["implement", "review"] as const) {
        if (!(role in roles)) continue;
        const value = roles[role];
        if (typeof value !== "string") throw new ConfigError(`models.${provider}.${role} must be a string`);
        config.models[role][provider] = value;
      }
    }
  }
  if ("verifyTimeoutMs" in root) {
    config.verifyTimeoutMs = timeout(root.verifyTimeoutMs, "verifyTimeoutMs");
  }
  if ("claude" in root) {
    const claude = object(root.claude, "claude");
    if ("allowedTools" in claude) {
      const tools = claude.allowedTools;
      if (!Array.isArray(tools) || tools.length === 0 || tools.some(tool => typeof tool !== "string" || tool === "")) {
        throw new ConfigError("claude.allowedTools must be a non-empty array of non-empty strings");
      }
      config.claude.allowedTools = tools as string[];
    }
  }
  if ("attemptTimeoutMs" in root) timeout(root.attemptTimeoutMs, "attemptTimeoutMs");
  return config;
}
