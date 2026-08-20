import { Resend } from "resend";
import type { Order, Pledge } from "@/contracts/types";
import { currentKibbud, currentOccasion } from "@/lib/calendar/current";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";

interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  html: string;
  status: "queued" | "sent";
  createdAt: string;
  providerId?: string;
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
  const response = await resend.emails.send(
    {
      from: sender(),
      to: record.to,
      subject: record.subject,
      html: record.html,
    },
    { idempotencyKey: record.id }
  );
  if (response.error) {
    await Promise.all([
      store.set(keys.email(record.id), record),
      store.sadd(keys.emailOutbox, record.id),
    ]);
    throw new Error(`Resend rejected ${record.id}: ${response.error.message}`);
  }
  await Promise.all([
    store.set(keys.email(record.id), {
      ...record,
      status: "sent",
      providerId: response.data?.id,
    }),
    store.srem(keys.emailOutbox, record.id),
  ]);
}

export async function notifyOfficeOfPledge(pledge: Pledge): Promise<void> {
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
      <p><strong>Mi Shebeirach:</strong> ${escapeHtml(pledge.misheberachNames.join("; "))}</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await deliver(record);
}

export async function sendDonorConfirmation(order: Order): Promise<void> {
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
      <p>American Friends of Ponevez Yeshiva in Israel, Inc. is a US 501(c)(3) organization. No goods or services were provided in exchange for this contribution.</p>`,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  await deliver(record);
}
