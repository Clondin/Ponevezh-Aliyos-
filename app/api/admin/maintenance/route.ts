import { apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { drainAdmireSyncQueue } from "@/lib/admire/client";
import { reconcileBanquestTransactions } from "@/lib/banquest/reconcile";
import { getRepository } from "@/lib/storage/repository";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdmin(request);
    const repository = getRepository();
    let purged = 0;
    for (let index = 0; index < 5; index += 1) {
      const removed = await repository.purgeExpired(1000);
      purged += removed;
      if (removed < 1000) break;
    }

    const prunedAudit = await repository.pruneAuditRecords();

    let reconciliation:
      | Awaited<ReturnType<typeof reconcileBanquestTransactions>>
      | { error: string };
    try {
      reconciliation = await reconcileBanquestTransactions();
    } catch (error) {
      reconciliation = {
        error: error instanceof Error ? error.message : "Reconciliation failed",
      };
    }

    const [releasedStaleCheckouts, admire] = await Promise.all([
      repository.releaseStaleProcessingCheckouts(),
      drainAdmireSyncQueue(25),
    ]);
    return Response.json(
      { ok: true, purged, prunedAudit, releasedStaleCheckouts, reconciliation, admire },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
