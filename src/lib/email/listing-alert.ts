import { OPERATOR_LABEL } from "@/lib/operators";
import { formatGBP } from "@/lib/pricing";
import { formatUkDateTime } from "@/lib/time";

import { getFromAddress, getResend } from "./client";

type Args = {
  email: string;
  listing: {
    id: string;
    operator: keyof typeof OPERATOR_LABEL;
    routeOrigin: string;
    routeDestination: string;
    departureAt: Date;
    currentPricePence: number;
    originalPricePence: number;
  };
  baseUrl: string;
};

/**
 * "Match found on the route you saved" email per §3.7. No-op if Resend isn't
 * configured. Throws on Resend API errors so the calling Inngest job can
 * record + retry.
 */
export async function sendListingAlertEmail({
  email,
  listing,
  baseUrl,
}: Args): Promise<{ id: string } | null> {
  const resend = getResend();
  if (!resend) return null;

  const op = OPERATOR_LABEL[listing.operator];
  const when = formatUkDateTime(listing.departureAt);
  const price = formatGBP(listing.currentPricePence);
  const wasPrice = formatGBP(listing.originalPricePence);
  const url = `${baseUrl}/listings/${listing.id}`;

  const subject = `${listing.routeOrigin} → ${listing.routeDestination} · ${price}`;

  const html = `
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:-apple-system,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;padding:36px;box-shadow:0 4px 24px rgba(27,77,62,0.06);">
        <tr><td>
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1B4D3E;">LastLeg</div>
          <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:24px 0 8px;">A ticket on your route just opened up.</h1>
          <p style="color:#3a3a3a;margin:0 0 24px;">${escapeHtml(op)} · ${escapeHtml(when)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2EFE8;border-radius:12px;padding:20px;">
            <tr><td>
              <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A1A1A;">${escapeHtml(listing.routeOrigin)} → ${escapeHtml(listing.routeDestination)}</div>
              <div style="margin-top:8px;font-family:Georgia,serif;font-size:28px;color:#1B4D3E;font-weight:700;">${escapeHtml(price)}<span style="font-size:14px;color:#7a7565;font-weight:400;text-decoration:line-through;margin-left:8px;">${escapeHtml(wasPrice)}</span></div>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#E8745C;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">See the ticket</a></p>
          <p style="font-size:12px;color:#8a8a8a;margin:32px 0 0;">Got this by accident? Manage your saved alerts at <a href="${escapeHtml(baseUrl)}/alerts">${escapeHtml(baseUrl)}/alerts</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = [
    `A ticket on your route just opened up.`,
    `${listing.routeOrigin} → ${listing.routeDestination}`,
    `${op} · ${when}`,
    `${price} (was ${wasPrice})`,
    ``,
    `See the ticket: ${url}`,
    ``,
    `Manage alerts: ${baseUrl}/alerts`,
  ].join("\n");

  const result = await resend.emails.send({
    from: getFromAddress(),
    to: email,
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${baseUrl}/alerts>`,
    },
  });

  if (result.error) throw new Error(`Resend: ${result.error.message}`);
  return result.data ? { id: result.data.id } : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
