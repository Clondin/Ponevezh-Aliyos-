import { PHOTOS, type PhotoKey } from "@/lib/photos";
import { withBasePath } from "@/lib/site-paths";

/**
 * A full-width photograph band, pre-cropped to 2.4:1. `slim` renders it as a
 * shallow ribbon for secondary pages; `priority` loads eagerly for bands that
 * sit above the fold.
 */
export default function PhotoBand({
  photo,
  he,
  caption,
  slim = false,
  priority = false,
}: {
  photo: PhotoKey;
  he?: string;
  caption?: string;
  slim?: boolean;
  priority?: boolean;
}) {
  const { key, alt } = PHOTOS[photo];
  const src = (width: number) => withBasePath(`/images/bands/${key}-${width}.webp`);
  return (
    <figure className={`photo-band${slim ? " photo-band--slim" : ""}`}>
      <img
        src={src(1440)}
        srcSet={`${src(720)} 720w, ${src(1440)} 1440w`}
        sizes="100vw"
        width={1440}
        height={600}
        alt={alt}
        {...(priority
          ? { fetchPriority: "high" as const }
          : { loading: "lazy" as const, decoding: "async" as const })}
      />
      {caption ? (
        <figcaption>
          {he ? <span lang="he">{he}</span> : null}
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
