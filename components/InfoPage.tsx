import type { ReactNode } from "react";
import PhotoBand from "@/components/PhotoBand";
import type { PhotoKey } from "@/lib/photos";

export default function InfoPage({
  eyebrow,
  title,
  hebrew,
  photo,
  photoHe,
  photoCaption,
  children,
}: {
  eyebrow: string;
  title: string;
  hebrew: string;
  photo?: PhotoKey;
  photoHe?: string;
  photoCaption?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="band">
        <div className="container container--narrow" style={{ padding: "52px 40px" }}>
          <div className="eyebrow">{eyebrow}</div>
          <div className="page-head">
            <div className="he he--left" lang="he">
              {hebrew}
            </div>
            <h1>{title}</h1>
          </div>
        </div>
      </div>
      {photo ? (
        <PhotoBand photo={photo} he={photoHe} caption={photoCaption} slim priority />
      ) : null}
      <article
        className="container container--narrow prose"
        style={{ padding: "52px 40px 96px" }}
      >
        {children}
      </article>
    </>
  );
}
