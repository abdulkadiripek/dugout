import type { FakeOutcome, FakeScenarioSpec, ProviderName } from "@panosu/core";

export const scenarioNames = ["success", "fallback", "review-issues", "all-failed"] as const;

export function scenarioSpec(name: string, providers: ProviderName[]): FakeScenarioSpec {
  if (!scenarioNames.some((candidate) => candidate === name)) throw new Error(`Unknown scenario: ${name}`);
  const needsTwo = name === "fallback" || name === "all-failed";
  if (providers.length < (needsTwo ? 2 : 1)) throw new Error(`Scenario ${name} needs ${needsTwo ? 2 : 1} provider positions`);
  const spec: FakeScenarioSpec = { review: name === "review-issues" ? "changes_requested" : "approve" };
  providers.forEach((provider, index) => {
    const outcomes: FakeOutcome[] = needsTwo && index === 0 ? [{ exit: "rate_limit" }]
      : name === "all-failed" && index === 1 ? [{ exit: "auth" }]
        : Array.from({ length: 6 }, () => ({ exit: "ok" as const }));
    spec[provider] = [...(spec[provider] ?? []), ...outcomes];
  });
  return spec;
}
