import { apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { getRepository } from "@/lib/storage/repository";

function csvCell(value: string | number): string {
  const raw = String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin(request);
    const orders = await getRepository().allOrders();
    const rows = [
      [
        "id",
        "kibbudId",
        "donorName",
        "email",
        "misheberachNames",
        "dedicationType",
        "dedicationName",
        "dedicationMessage",
        "publicRecognition",
        "recognitionName",
        "assignmentAcceptedAt",
        "amount",
        "method",
        "createdAt",
        "paymentId",
        "gatewayTransactionId",
        "gatewayReference",
      ],
      ...orders.map((order) => [
        order.id,
        order.kibbudId,
        order.donorName,
        order.email,
        order.misheberachNames.join("; "),
        order.dedicationType ?? "",
        order.dedicationName ?? "",
        order.dedicationMessage ?? "",
        order.publicRecognition ? "yes" : "no",
        order.recognitionName ?? "",
        order.assignmentAcceptedAt ?? "",
        order.amount,
        order.method,
        order.createdAt,
        order.paymentId ?? "",
        order.gatewayTransactionId ?? "",
        order.gatewayReference ?? "",
      ]),
    ];
    const csv = `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="ponevez-orders.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
