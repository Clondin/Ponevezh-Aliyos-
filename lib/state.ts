/**
 * UI-owned demo state layer. Reads the state fixture so every screen renders
 * with zero network calls. At integration, the functions here swap their
 * data source for GET /api/state/[minyan]/[occasion] — the shapes returned
 * already match contracts/api.md.
 */
import type { KibbudState, KibbudStatus, Order, Pledge } from "@/contracts/types";
import stateJson from "@/lib/fixtures/state-5787.json";

interface FixtureStatus {
  id: string;
  state: KibbudState;
  /** Demo shim — converted to an absolute expiresAt at read time. */
  expiresInMinutes?: number;
}

interface FixturePledge extends Omit<Pledge, "expiresAt"> {
  expiresInHours: number;
}

const fixture = stateJson as unknown as {
  statuses: FixtureStatus[];
  orders: Order[];
  pledges: FixturePledge[];
};

function toStatus(s: FixtureStatus): KibbudStatus {
  if (s.state === "held" && s.expiresInMinutes != null) {
    return {
      id: s.id,
      state: s.state,
      expiresAt: new Date(Date.now() + s.expiresInMinutes * 60_000).toISOString(),
    };
  }
  return { id: s.id, state: s.state };
}

/** Map of kibbud id → status for one (minyan, occasion). Missing ids are available. */
export function statusMap(minyan: string, occasion: string): Map<string, KibbudStatus> {
  const prefix = `${minyan}/${occasion}/`;
  const map = new Map<string, KibbudStatus>();
  for (const s of fixture.statuses) {
    if (s.id.startsWith(prefix)) map.set(s.id, toStatus(s));
  }
  return map;
}

export function statusFor(kibbudId: string): KibbudStatus {
  const s = fixture.statuses.find((x) => x.id === kibbudId);
  return s ? toStatus(s) : { id: kibbudId, state: "available" };
}

export function allOrders(): Order[] {
  return fixture.orders;
}

export function orderFor(kibbudId: string): Order | undefined {
  return fixture.orders.find((o) => o.kibbudId === kibbudId);
}

export function pendingPledges(): Pledge[] {
  return fixture.pledges.map((p) => ({
    ...p,
    expiresAt: new Date(Date.now() + p.expiresInHours * 3_600_000).toISOString(),
  }));
}

export function pledgeFor(kibbudId: string): Pledge | undefined {
  return pendingPledges().find((p) => p.kibbudId === kibbudId);
}

export function soldCount(minyan: string, occasion: string): { sold: number } {
  const prefix = `${minyan}/${occasion}/`;
  let sold = 0;
  for (const s of fixture.statuses) {
    if (s.id.startsWith(prefix) && s.state === "sold") sold++;
  }
  return { sold };
}
