export default function Loading() {
  return (
    <section className="admin-section">
      <div className="container">
        <div className="skeleton" style={{ height: 34, width: 320, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 15, width: 420, marginBottom: 32 }} />
        <div className="admin-grid" style={{ marginBottom: 48 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    </section>
  );
}
