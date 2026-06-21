import { getFromAddress, getResend } from "./client";

type Args = {
  email: string;
  reason: string;
  reviewUrl: string;
};

// Seller-side notification: "your payout is on hold because a buyer
// reported a problem".
export async function sendPayoutHaltedEmail({
  email,
  reason,
  reviewUrl,
}: Args) {
  const resend = getResend();
  if (!resend) return null;
  const subject = "Your LastLeg payout is on hold";
  const html = `
<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:-apple-system,sans-serif;color:#1A1A1A">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:14px;padding:36px"><tr><td>
<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1B4D3E">LastLeg</div>
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:24px 0 12px">Your payout is on hold.</h1>
<p style="color:#3a3a3a;margin:0 0 16px;line-height:1.5">The buyer reported an issue with their trip:</p>
<p style="background:#F2EFE8;border-radius:10px;padding:16px;margin:0 0 24px;font-size:14px">${esc(reason)}</p>
<p style="color:#3a3a3a;margin:0 0 16px;line-height:1.5">We&rsquo;ve paused the payout while we look at it. You&rsquo;ll hear from us within 48 hours. If you have evidence the trip went fine, share it now.</p>
<p style="margin:24px 0 0"><a href="${esc(reviewUrl)}" style="display:inline-block;background:#1B4D3E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">Respond</a></p>
</td></tr></table>
</td></tr></table></body></html>`.trim();
  const text = `Your LastLeg payout is on hold.\n\nReason: ${reason}\n\nRespond: ${reviewUrl}`;
  const r = await resend.emails.send({
    from: getFromAddress(),
    to: email,
    subject,
    html,
    text,
  });
  if (r.error) throw new Error(`Resend: ${r.error.message}`);
  return r.data ? { id: r.data.id } : null;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
