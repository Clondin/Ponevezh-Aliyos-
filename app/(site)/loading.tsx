export default function Loading() {
  return (
    <>
      <div className="band">
        <div className="container" style={{ padding: "40px 40px 60px" }}>
          <div className="skeleton" style={{ height: 11, width: 240, marginBottom: 52 }} />
          <div className="skeleton" style={{ height: 46, width: 320, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 56, width: 460 }} />
        </div>
      </div>
      <section className="container" style={{ padding: "56px 40px 96px" }}>
        <div className="skeleton" style={{ height: 10, width: 180, marginBottom: 22 }} />
        <div className="kibbud-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 158 }} />
          ))}
        </div>
      </section>
    </>
  );
}
