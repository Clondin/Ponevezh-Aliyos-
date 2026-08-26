import Notice from "@/components/Notice";

export default function NotFound() {
  return (
    <Notice
      glyph="asterisk"
      title="Page not found"
      body="Check the link or choose another kibbud."
      primaryHref="/"
      primaryLabel="See all kibbudim"
      secondaryHref="/"
      secondaryLabel="Home"
    />
  );
}
