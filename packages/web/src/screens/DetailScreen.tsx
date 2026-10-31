export function DetailScreen({ id }: { id: string }) {
  return (
    <section>
      <a className="back" href="#/">&larr; All tasks</a>
      <h1>Task detail</h1>
      <p className="mono">{id}</p>
    </section>
  );
}
