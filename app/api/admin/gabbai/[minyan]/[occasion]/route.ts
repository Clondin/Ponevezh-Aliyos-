import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import {
  currentItems,
  currentMinyan,
  currentOccasion,
} from "@/lib/calendar/current";
import { getRepository } from "@/lib/storage/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ minyan: string; occasion: string }> }
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { minyan, occasion } = await params;
    const minyanRecord = currentMinyan(minyan);
    const occasionRecord = currentOccasion(occasion);
    const items = currentItems(minyan, occasion);
    if (!minyanRecord || !occasionRecord || !items.length) {
      throw new ApiError("not_found", "Minyan or occasion not found.", 404);
    }
    const repository = getRepository();
    const [statuses, allOrders, pledges, activeCheckouts] = await Promise.all([
      repository.statuses(items.map((item) => item.id)),
      repository.allOrders(),
      repository.pendingPledges(),
      repository.activeCheckouts(),
    ]);
    const orders = allOrders.filter((order) => order.status !== "refunded");
    const statusById = new Map(statuses.map((status) => [status.id, status]));
    const orderByItem = new Map(orders.map((order) => [order.kibbudId, order]));
    const pledgeByItem = new Map(
      pledges.flatMap((pledge) =>
        (pledge.kibbudIds?.length ? pledge.kibbudIds : [pledge.kibbudId]).map(
          (kibbudId) => [kibbudId, pledge] as const
        )
      )
    );
    const checkoutByItem = new Map(
      activeCheckouts.flatMap((checkout) =>
        (checkout.kibbudIds?.length ? checkout.kibbudIds : [checkout.kibbudId]).map(
          (kibbudId) => [kibbudId, checkout] as const
        )
      )
    );
    const rows = items.map((item) => {
      const state = statusById.get(item.id)?.state ?? "available";
      const owner = state === "sold"
        ? orderByItem.get(item.id)
        : pledgeByItem.get(item.id) ?? checkoutByItem.get(item.id);
      return {
        id: item.id,
        name: item.name,
        order: item.order,
        state,
        donorName: owner?.donorName ?? null,
        misheberachNames: owner?.misheberachNames ?? [],
      };
    });
    return Response.json({
      minyan: minyanRecord.slug,
      occasion: occasionRecord.slug,
      rows,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
