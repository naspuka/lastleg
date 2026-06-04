import { ROUTES } from "@/lib/routes";

import { getFromAddress, getResend } from "./client";

type Args = {
  email: string;
  routes: string[];
  role: "buyer" | "seller" | "both";
};

const ROUTE_LABELS = new Map(ROUTES.map((r) => [r.slug, r.label]));

/**
 * Send the one-off Phase 0 waitlist confirmation email.
 *
 * Resolves `null` on a no-op (no Resend configured yet) so the server action
 * can keep going. Throws on delivery failures so the caller can decide
 * whether to log + ignore or surface — we currently log + ignore because a
 * dropped confirmation shouldn't fail the signup flow.
 */
export async function sendWaitlistConfirmation({
  email,
  routes,
  role,
}: Args): Promise<{ id: string } | null> {
  const resend = getResend();
  if (!resend) return null;

  const labels = routes
    .map((slug) => ROUTE_LABELS.get(slug) ?? slug)
    .join(" · ");

  const roleLine =
    role === "both"
      ? "You're in for both buying and selling."
      : role === "buyer"
        ? "You're in as a buyer."
        : "You're in as a seller.";

  const subject = "You're on the LastLeg waitlist";

  // Plain HTML inline — Resend's React Email integration is overkill for one
  // transactional template. Migrate to @react-email/components when we have
  // 3+ templates (likely Phase 2 — listing notifications).
  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;padding:40px 36px;box-shadow:0 4px 24px rgba(27,77,62,0.06);">
          <tr>
            <td>
              <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1B4D3E;letter-spacing:-0.2px;">LastLeg</div>
              <h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.2;font-weight:600;margin:32px 0 0;color:#1A1A1A;">You&rsquo;re on the list.</h1>
              <p style="font-size:16px;line-height:1.55;color:#3a3a3a;margin:16px 0 0;">${escapeHtml(roleLine)} We&rsquo;ll email you the moment we launch on a route you picked.</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;border-radius:10px;background:#F2EFE8;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="font-size:12px;font-weight:600;letter-spacing:1px;color:#5a5a5a;margin:0;text-transform:uppercase;">Your routes</p>
                    <p style="font-size:15px;line-height:1.45;color:#1A1A1A;margin:8px 0 0;">${escapeHtml(labels) || "&mdash;"}</p>
                  </td>
                </tr>
              </table>

              <p style="font-size:15px;line-height:1.55;color:#3a3a3a;margin:0;">A quick recap of how LastLeg works:</p>
              <ul style="font-size:15px;line-height:1.6;color:#3a3a3a;padding-left:20px;margin:8px 0 0;">
                <li>Sellers list unused coach tickets at or below the price they paid.</li>
                <li>Buyers pick them up at a discount &mdash; payment held in escrow.</li>
                <li>Sellers paid an hour after the coach departs. Guarantee fund covers anyone who gets denied boarding.</li>
              </ul>

              <p style="font-size:14px;color:#5a5a5a;margin:32px 0 0;line-height:1.55;">If you didn&rsquo;t sign up, just ignore this email &mdash; we won&rsquo;t contact you again. To remove yourself any time, reply with &ldquo;remove&rdquo;.</p>

              <hr style="border:none;border-top:1px solid #E8E2D6;margin:32px 0 20px;">
              <p style="font-size:12px;color:#8a8a8a;margin:0;line-height:1.5;">LastLeg &middot; UK only &middot; <a href="https://lastleg.app/privacy" style="color:#8a8a8a;text-decoration:underline;">Privacy</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = [
    "You're on the LastLeg waitlist.",
    "",
    roleLine,
    "",
    `Your routes: ${labels || "—"}`,
    "",
    "How LastLeg works:",
    "• Sellers list unused coach tickets at or below the price they paid.",
    "• Buyers pick them up at a discount — payment held in escrow.",
    "• Sellers paid an hour after the coach departs. Guarantee fund covers anyone denied boarding.",
    "",
    "Didn't sign up? Ignore this email. To remove yourself any time, reply 'remove'.",
    "",
    "LastLeg · UK only · https://lastleg.app/privacy",
  ].join("\n");

  const result = await resend.emails.send({
    from: getFromAddress(),
    to: email,
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": "<mailto:contact@lastleg.app?subject=unsubscribe>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result.data ? { id: result.data.id } : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
