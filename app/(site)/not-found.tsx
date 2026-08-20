import Notice from "@/components/Notice";

export default function NotFound() {
  return (
    <Notice
      glyph="asterisk"
      title="Page not found"
      body="This page doesn't exist — the minyan, day, or kibbud may have been mistyped."
      primaryHref="/"
      primaryLabel="See all kibbudim"
      secondaryHref="/"
      secondaryLabel="Home"
    />
  );
}
