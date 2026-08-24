import { Resend } from "resend";
import {
  currentKibbud,
  currentMinyan,
  currentOccasion,
} from "@/lib/calendar/current";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";
import type { CheckoutRecord, StoredOrder, StoredPledge } from "@/lib/storage/types";

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  status: "queued" | "sent";
  createdAt: string;
  providerId?: string;
  attempts?: number;
  lastError?: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
        character
      ]!
  );
}

function sender(): string {
  const configured = process.env.EMAIL_FROM?.trim();
  if (configured) return configured;
  try {
    const host = new URL(process.env.SITE_URL ?? "http://localhost").hostname;
    if (host !== "localhost") {
      return `American Friends of Ponevez Yeshiva <receipts@${host}>`;
    }
  } catch {
    // The environment validator will surface an invalid SITE_URL elsewhere.
  }
  return "Ponevez Kibbudim <onboarding@resend.dev>";
}

async function deliver(record: EmailRecord): Promise<void> {
  const store = getStateStore();
  const existing = await store.get<EmailRecord>(keys.email(record.id));
  if (existing?.status === "sent") return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await Promise.all([
      store.set(keys.email(record.id), record),
      store.sadd(keys.emailOutbox, record.id),
    ]);
    console.warn(`Email ${record.id} queued because RESEND_API_KEY is not configured`);
    return;
  }

  const resend = new Resend(apiKey);
  const attempts = (existing?.attempts ?? record.attempts ?? 0) + 1;
  let response: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    response = await resend.emails.send(
      {
        from: sender(),
        to: record.to,
        subject: record.subject,
        html: record.html,
      },
      { idempotencyKey: record.id }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email provider request failed";
    await Promise.all([
      store.set(keys.email(record.id), {
        ...record,
        status: "queued",
        attempts,
        lastError: message,
      }),
      store.sadd(keys.emailOutbox, record.id),
    ]);
    throw error;
  }
  if (response.error) {
    const queued = { ...record, status: "queued" as const, attempts, lastError: response.error.message };
    await Promise.all([
      store.set(keys.email(record.id), queued),
      store.sadd(keys.emailOutbox, record.id),
    ]);
    throw new Error(`Resend rejected ${record.id}: ${response.error.message}`);
  }
  await Promise.all([
    store.set(keys.email(record.id), {
      ...record,
      status: "sent",
      providerId: response.data?.id,
      attempts,
      lastError: undefined,
    }),
    store.srem(keys.emailOutbox, record.id),
  ]);
}

export async function notifyOfficeOfPledge(pledge: StoredPledge): Promise<void> {
  const officeEmail = process.env.OFFICE_NOTIFY_EMAIL;
  if (!officeEmail) throw new Error("OFFICE_NOTIFY_EMAIL is required");
  const item = currentKibbud(pledge.kibbudId);
  const record: EmailRecord = {
    id: `pledge-office-${pledge.id}`,
    to: officeEmail,
    subject: `Pending kibbud pledge: ${item?.name ?? pledge.kibbudId}`,
    html: `<h1>Pending kibbud pledge</h1>
      <p><strong>Kibbud:</strong> ${escapeHtml(item?.name ?? pledge.kibbudId)}</p>
      <p><strong>Donor:</strong> ${escapeHtml(pledge.donorName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(pledge.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(pledge.phone ?? "Not provided")}</p>
      <p><strong>Amount:</strong> $${pledge.amount.toLocaleString("en-US")}</p>
      <p><strong>Expires:</strong> ${escapeHtml(pledge.expiresAt)}</p>
      <p><strong>Mi Shebeirach:</strong> ${escapeHtml(pledge.misheberachNames.join("; "))}</p>
      ${pledge.dedicationType && pledge.dedicationName ? `<p><strong>${pledge.dedicationType === "memory" ? "In memory of" : "In honor of"}:</strong> ${escapeHtml(pledge.dedicationName)}</p>` : ""}`,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await deliver(record);
}

export async function sendDonorPledgeReservation(pledge: StoredPledge): Promise<void> {
  const item = currentKibbud(pledge.kibbudId);
  const minyan = item ? currentMinyan(item.minyan) : undefined;
  const occasion = item ? currentOccasion(item.occasion) : undefined;
  const instructions = process.env.OFFICE_PAYMENT_INSTRUCTIONS?.trim() ||
    "Please contact the Ponevez office at office@ponevez.com or 212-675-9260 to arrange payment.";
  await deliver({
    id: `pledge-donor-${pledge.id}`,
    to: pledge.email,
    subject: `Your Ponevez kibbud reservation${item ? ` — ${item.name}` : ""}`,
    html: `<h1>Your kibbud is reserved</h1>
      <p>Dear ${escapeHtml(pledge.donorName)},</p>
      <p>We are holding ${escapeHtml(item?.name ?? pledge.kibbudId)}${occasion ? ` for ${escapeHtml(occasion.name)}` : ""}${minyan ? ` in the ${escapeHtml(minyan.name)} Minyan` : ""} until ${escapeHtml(pledge.expiresAt)}.</p>
      <p><strong>Amount:</strong> $${pledge.amount.toLocaleString("en-US")}</p>
      <p>${escapeHtml(instructions)}</p>
      <p>If payment is not arranged before the reservation expires, the kibbud will return to the site.</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
}

export async function sendPledgeNotifications(pledge: StoredPledge): Promise<void> {
  const results = await Promise.allSettled([
    notifyOfficeOfPledge(pledge),
    sendDonorPledgeReservation(pledge),
  ]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (failures.length) {
    throw new AggregateError(failures.map((failure) => failure.reason), "Pledge email failed");
  }
}

function dedicationHtml(order: StoredOrder): string {
  if (!order.dedicationType || !order.dedicationName) return "";
  const lead = order.dedicationType === "memory" ? "In memory of" : "In honor of";
  return `<p><strong>${lead}:</strong> ${escapeHtml(order.dedicationName)}${
    order.dedicationMessage ? `<br>${escapeHtml(order.dedicationMessage)}` : ""
  }</p>`;
}

export async function sendDonorConfirmation(order: StoredOrder): Promise<void> {
  const item = currentKibbud(order.kibbudId);
  const occasion = item ? currentOccasion(item.occasion) : undefined;
  const record: EmailRecord = {
    id: `order-confirmation-${order.id}`,
    to: order.email,
    subject: `Your Ponevez kibbud sponsorship${item ? ` — ${item.name}` : ""}`,
    html: `<h1>Thank you for your sponsorship</h1>
      <p>Dear ${escapeHtml(order.donorName)},</p>
      <p>We gratefully acknowledge your $${order.amount.toLocaleString("en-US")} contribution${
        item ? ` sponsoring <strong>${escapeHtml(item.name)}</strong>` : ""
      }${occasion ? ` for ${escapeHtml(occasion.name)}` : ""}.</p>
      <p>Mi Shebeirach names: ${escapeHtml(order.misheberachNames.join("; ") || "None provided")}</p>
      ${dedicationHtml(order)}
      <p><strong>Receipt number:</strong> ${escapeHtml(order.id)}</p>
      <p>American Friends of Ponevez Yeshiva in Israel, Inc. is a US 501(c)(3) organization. No goods or services were provided in exchange for this contribution.</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await deliver(record);
}

export async function notifyOfficeOfOrder(order: StoredOrder): Promise<void> {
  const officeEmail = process.env.OFFICE_NOTIFY_EMAIL;
  if (!officeEmail) throw new Error("OFFICE_NOTIFY_EMAIL is required");
  const item = currentKibbud(order.kibbudId);
  const minyan = item ? currentMinyan(item.minyan) : undefined;
  const occasion = item ? currentOccasion(item.occasion) : undefined;
  const record: EmailRecord = {
    id: `order-office-${order.id}`,
    to: officeEmail,
    subject: `Payment received: ${item?.name ?? order.kibbudId}`,
    html: `<h1>Kibbud payment received</h1>
      <p><strong>Kibbud:</strong> ${escapeHtml(item?.name ?? order.kibbudId)}</p>
      <p><strong>Minyan:</strong> ${escapeHtml(minyan?.name ?? "Unknown")}</p>
      <p><strong>Occasion:</strong> ${escapeHtml(occasion?.name ?? "Unknown")}</p>
      <p><strong>Donor:</strong> ${escapeHtml(order.donorName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(order.email)}</p>
      <p><strong>Amount:</strong> $${order.amount.toLocaleString("en-US")}</p>
      <p><strong>Payment method:</strong> ${order.method === "card" ? "Credit card" : "Office-confirmed payment"}</p>
      <p><strong>Mi Shebeirach:</strong> ${escapeHtml(order.misheberachNames.join("; ") || "None provided")}</p>
      ${dedicationHtml(order)}
      <p><strong>Order ID:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>Banquest transaction:</strong> ${escapeHtml(order.gatewayTransactionId ?? "Not returned")}</p>
      <p><strong>Banquest reference:</strong> ${escapeHtml(order.gatewayReference ?? "Not returned")}</p>
      <p><strong>Received:</strong> ${escapeHtml(order.createdAt)}</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await deliver(record);
}

/** Sends both sides of a completed sale. Stable record IDs make retries safe. */
async function notifyHonoree(order: StoredOrder): Promise<void> {
  if (!order.honoreeEmail || !order.dedicationType || !order.dedicationName) return;
  const item = currentKibbud(order.kibbudId);
  const lead = order.dedicationType === "memory" ? "in memory of" : "in honor of";
  await deliver({
    id: `order-honoree-${order.id}`,
    to: order.honoreeEmail,
    subject: "A Ponevez kibbud sponsorship was dedicated",
    html: `<h1>A meaningful sponsorship</h1>
      <p>${escapeHtml(order.recognitionName || order.donorName)} sponsored ${escapeHtml(item?.name ?? "a kibbud")} ${lead} ${escapeHtml(order.dedicationName)}.</p>
      ${order.dedicationMessage ? `<p>${escapeHtml(order.dedicationMessage)}</p>` : ""}
      <p>May this sponsorship be a lasting zechus.</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
}

export async function sendOrderNotifications(order: StoredOrder): Promise<void> {
  const results = await Promise.allSettled([
    sendDonorConfirmation(order),
    notifyOfficeOfOrder(order),
    notifyHonoree(order),
  ]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (failures.length) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "One or more order emails could not be processed"
    );
  }
}

export async function sendReversalNotifications(checkout: CheckoutRecord): Promise<void> {
  const item = currentKibbud(checkout.kibbudId);
  const officeEmail = process.env.OFFICE_NOTIFY_EMAIL?.trim();
  const records: EmailRecord[] = [
    {
      id: `reversal-donor-${checkout.paymentId}`,
      to: checkout.email,
      subject: "Update about your Ponevez kibbud sponsorship",
      html: `<h1>Payment update</h1><p>Dear ${escapeHtml(checkout.donorName)},</p><p>Banquest reported that the payment for ${escapeHtml(item?.name ?? checkout.kibbudId)} did not complete or was reversed. The kibbud is no longer marked sponsored.</p><p>If you believe this is an error, please contact office@ponevez.com or 212-675-9260.</p>`,
      status: "queued",
      createdAt: new Date().toISOString(),
    },
  ];
  if (officeEmail) {
    records.push({
      id: `reversal-office-${checkout.paymentId}`,
      to: officeEmail,
      subject: `Payment reversed: ${item?.name ?? checkout.kibbudId}`,
      html: `<h1>Kibbud payment reversed</h1><p><strong>Donor:</strong> ${escapeHtml(checkout.donorName)}</p><p><strong>Kibbud:</strong> ${escapeHtml(item?.name ?? checkout.kibbudId)}</p><p><strong>Payment ID:</strong> ${escapeHtml(checkout.paymentId)}</p>`,
      status: "queued",
      createdAt: new Date().toISOString(),
    });
  }
  const results = await Promise.allSettled(records.map(deliver));
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("One or more reversal notifications could not be processed");
  }
}

export async function emailRecord(id: string): Promise<EmailRecord | null> {
  return getStateStore().get<EmailRecord>(keys.email(id));
}

export async function queuedEmails(): Promise<EmailRecord[]> {
  const store = getStateStore();
  const ids = await store.smembers<string[]>(keys.emailOutbox);
  if (!ids.length) return [];
  const records = await store.mget<Array<EmailRecord | null>>(...ids.map(keys.email));
  return records.filter((record): record is EmailRecord => Boolean(record));
}

export async function retryEmail(id: string): Promise<EmailRecord | null> {
  const record = await emailRecord(id);
  if (!record) return null;
  await deliver({ ...record, status: "queued" });
  return emailRecord(id);
}
