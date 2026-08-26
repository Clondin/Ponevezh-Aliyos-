import { apiErrorResponse } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { admireSyncConfigured } from "@/lib/admire/client";
import {
  banquestEnvironment,
  banquestPublicConfiguration,
  banquestRequest,
  BanquestApiError,
} from "@/lib/banquest/client";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin(request);

    let environment: "sandbox" | "production" | "invalid" = "invalid";
    try {
      environment = banquestEnvironment();
    } catch {
      // Report invalid configuration without exposing its value.
    }

    let apiStatus: "ok" | "credentials_rejected" | "api_error" | "unreachable" =
      "unreachable";
    try {
      await banquestRequest<unknown[]>("/transactions?order=desc&limit=1&offset=0");
      apiStatus = "ok";
    } catch (error) {
      if (error instanceof BanquestApiError) {
        apiStatus = error.status === 401 ? "credentials_rejected" : "api_error";
      }
    }

    const publicConfiguration = banquestPublicConfiguration();
    return Response.json(
      {
        environment,
        apiStatus,
        checkoutEnabled: process.env.BANQUEST_CHECKOUT_ENABLED === "true",
        checkoutReady: publicConfiguration.checkoutReady,
        webhookConfigured: Boolean(process.env.BANQUEST_WEBHOOK_SIGNATURE?.trim()),
        admireSyncConfigured: admireSyncConfigured(),
        emailConfigured: Boolean(
          process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()
        ),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
