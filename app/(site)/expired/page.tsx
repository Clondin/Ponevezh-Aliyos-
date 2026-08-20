import type { Metadata } from "next";
import Notice from "@/components/Notice";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Hold expired" };
export const dynamic = "force-dynamic";

export default async function ExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: itemId } = await searchParams;
  const item = getCatalog().items.find((i) => i.id === itemId);

  return (
    <Notice
      glyph="hourglass"
      title="Your hold has expired"
      body="The hold ran out and the kibbud has been released. If it is still available, you can take it again."
      primaryHref={item ? `/${item.minyan}/${item.occasion}` : "/"}
      primaryLabel="See the remaining kibbudim"
      secondaryHref={item ? `/${item.minyan}` : "/"}
      secondaryLabel="Other days"
    />
  );
}
