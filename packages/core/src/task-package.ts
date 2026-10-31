import { z } from "zod";
import { parse } from "yaml";
import { repoRelativePathSchema } from "./path.js";

export const providerNameSchema = z.enum(["codex", "claude", "fake"]);
export type ProviderName = z.infer<typeof providerNameSchema>;

export const taskPackageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  goal: z.string().trim().min(1),
  files_to_read: z.array(repoRelativePathSchema),
  constraints: z.array(z.string()),
  acceptance: z.array(z.string()).min(1),
  verify: z.string().refine((value) => value.trim().length > 0, "verify must be non-empty"),
  max_retries: z.number().int().min(0).max(5).default(2),
  review: z.boolean().default(true),
  providers: z.array(providerNameSchema).default(["codex", "claude"]),
});

export type TaskPackage = z.infer<typeof taskPackageSchema>;

export function parseTaskPackage(markdown: string): TaskPackage {
  const match = /^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(markdown);
  if (!match || match.index !== 0) {
    throw new Error("Task package must start with YAML frontmatter enclosed by ---");
  }
  const data: unknown = parse(match[1] ?? "");
  return taskPackageSchema.parse(data);
}
