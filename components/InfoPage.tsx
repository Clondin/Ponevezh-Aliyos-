import type { ReactNode } from "react";

export default function InfoPage({ eyebrow, title, hebrew, children }: { eyebrow: string; title: string; hebrew: string; children: ReactNode }) {
  return <><div className="band"><div className="container container--narrow" style={{ padding: "52px 40px" }}><div className="eyebrow">{eyebrow}</div><div className="page-head"><div className="he he--left" lang="he">{hebrew}</div><h1>{title}</h1></div></div></div><article className="container container--narrow prose" style={{ padding: "52px 40px 96px" }}>{children}</article></>;
}
