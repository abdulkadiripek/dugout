import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProviderName } from "@panosu/core";

export interface Config {
  models: { implement: Record<ProviderName, string>; review: Record<ProviderName, string> };
  verifyTimeoutMs: number;
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

export function loadConfig(file = join(homedir(), ".ajan-panosu", "config.json")): Config {
  const config: Config = {
    models: {
      implement: { codex: "gpt-6-astra", claude: "claude-sonnet-5-5", fake: "fake" },
      review: { codex: "gpt-6.1-sol", claude: "claude-sonnet-5-5", fake: "fake" },
    },
    verifyTimeoutMs: 600000,
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
    const value = root.verifyTimeoutMs;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ConfigError("verifyTimeoutMs must be a finite nonnegative number");
    }
    config.verifyTimeoutMs = value;
  }
  return config;
}
