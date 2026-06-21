import { OPERATOR_LABEL } from "@/lib/operators";
import { formatUkDateTime } from "@/lib/time";

import { getFromAddress, getResend } from "./client";

type Args = {
  email: string;
  signedUrl: string;
  listing: {
    operator: keyof typeof OPERATOR_LABEL;
    routeOrigin: string;
    routeDestination: string;
    departureAt: Date;
  };
};

export async function sendTicketReleasedEmail({
  email,
  signedUrl,
  listing,
}: Args) {
  const resend = getResend();
  if (!resend) return null;
  const op = OPERATOR_LABEL[listing.operator];
  const when = formatUkDateTime(listing.departureAt);
  const subject = `Your ticket: ${listing.routeOrigin} → ${listing.routeDestination}`;
  const html = `
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF7F0;font-family:-apple-system,sans-serif;color:#1A1A1A">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fff;border-radius:14px;padding:36px"><tr><td>
<div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1B4D3E">LastLeg</div>
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:24px 0 8px">Your ticket is ready.</h1>
<p style="color:#3a3a3a;margin:0">${esc(op)} · ${esc(listing.routeOrigin)} → ${esc(listing.routeDestination)} · ${esc(when)}</p>
<p style="margin:28px 0 0"><a href="${esc(signedUrl)}" style="display:inline-block;background:#E8745C;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:600">Open your ticket PDF</a></p>
<p style="font-size:13px;color:#6a6a6a;margin:28px 0 0">This link works for 24 hours. Save or screenshot the ticket to your phone in case the driver asks. Show it at the door — they scan the barcode.</p>
</td></tr></table>
</td></tr></table></body></html>`.trim();

  const text = [
    `Your ticket is ready.`,
    `${op} · ${listing.routeOrigin} → ${listing.routeDestination} · ${when}`,
    ``,
    signedUrl,
    ``,
    `Link expires in 24 hours.`,
  ].join("\n");

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
