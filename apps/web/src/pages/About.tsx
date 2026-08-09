export default function About() {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold">About this template</h1>
      <p>
        This is the second route of the starter app, here to show that
        client-side routing works end to end (including the Hono SPA fallback on
        page refresh). Add a page by dropping a component into{' '}
        <code>src/pages/</code> and registering it in{' '}
        <code>src/routes.tsx</code>.
      </p>
    </section>
  );
}
