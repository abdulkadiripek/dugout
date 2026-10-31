import { z } from "zod";

export const repoRelativePathSchema = z.string().min(1).refine(
  (path) => !path.startsWith("/") && !/^[a-z]:/i.test(path)
    && !path.includes("\\") && !path.split("/").includes(".."),
  "Must be a repo-relative path without absolute paths, '..' segments or backslashes",
);
