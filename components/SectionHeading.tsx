/** Centered bilingual section heading: Hebrew in bronze over English in ink. */
export default function SectionHeading({
  he,
  children,
}: {
  he: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="he" lang="he">
        {he}
      </div>
      <h2>{children}</h2>
    </div>
  );
}
