import Link from "next/link";

/**
 * The shared sold / reserved / expired notice. One layout, three copies.
 */
export default function Notice({
  glyph,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  glyph: "asterisk" | "hourglass";
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className="notice">
      <div className="notice__glyph" aria-hidden="true">
        {glyph === "hourglass" ? "⧖" : "✳"}
      </div>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="actions">
        <Link href={primaryHref} className="btn btn--fill">
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="btn btn--outline">
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}
