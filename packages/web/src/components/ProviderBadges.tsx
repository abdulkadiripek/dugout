export function ProviderBadges({ providers }: { providers: readonly string[] }) {
  if (providers.length === 0) return <b>none</b>;
  return (
    <b>
      {providers.map((p, i) => (
        <span key={`${p}-${i}`}>
          {i > 0 ? <span aria-hidden="true"> → </span> : null}
          {i > 0 ? <span className="sr-only"> then </span> : null}
          {p}
        </span>
      ))}
    </b>
  );
}
