import { getFromAddress, getResend } from "./client";

type Args = {
  email: string;
  signUpUrl: string;
};

// Phase 8 invite batches per P8-02. Sent to waitlist members in priority
// route order. The email itself is intentionally minimal — a one-line
// pitch and a link.
export async function sendWaitlistInviteEmail({ email, signUpUrl }: Args) {
  const resend = getResend();
  if (!resend) return null;
  const subject = "Your LastLeg invite";
  const html = `
<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:-apple-system,sans-serif;color:#1A1A1A">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:14px;padding:36px"><tr><td>
<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1B4D3E">LastLeg</div>
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:24px 0 12px">You&rsquo;re in.</h1>
<p style="color:#3a3a3a;margin:0 0 24px;line-height:1.5">Your route is live on LastLeg. Browse last-minute coach tickets your fellow travellers can&rsquo;t use, or list one of your own.</p>
<p style="margin:0"><a href="${esc(signUpUrl)}" style="display:inline-block;background:#E8745C;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:600">Get started</a></p>
<p style="color:#7a7565;font-size:12px;margin:32px 0 0">If you didn&rsquo;t request this, ignore it. We won&rsquo;t email you again.</p>
</td></tr></table>
</td></tr></table></body></html>`.trim();
  const text = `You're in.\n\nGet started: ${signUpUrl}`;
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
