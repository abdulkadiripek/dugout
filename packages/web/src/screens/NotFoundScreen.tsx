export function NotFoundScreen({ hash }: { hash: string }) {
  return (
    <section>
      <h1>Page not found</h1>
      <p className="lede">Nothing lives at <span className="mono">{hash}</span>.</p>
      <a className="back" href="#/">&larr; Back to all tasks</a>
    </section>
  );
}
