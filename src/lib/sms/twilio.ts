// Twilio SMS sender. Env-gated like every other integration: returns null
// when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER aren't
// set. UK numbers only per D003 + D017.
//
// We don't pull in the twilio npm package — its bundle is heavy and we only
// need the Messages.create REST call. Direct fetch with basic auth keeps the
// serverless function lean.

type SendSmsArgs = {
  to: string; // E.164 UK number
  body: string;
};

type SendResult =
  | { ok: true; sid: string }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

function isUkE164(num: string) {
  return /^\+44\d{9,10}$/.test(num.replace(/\s+/g, ""));
}

export async function sendSms({ to, body }: SendSmsArgs): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, reason: "not_configured" };
  }
  if (!isUkE164(to)) {
    return { ok: false, reason: "send_failed", error: "not a UK number" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ From: from, To: to, Body: body });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: "send_failed", error: text.slice(0, 200) };
    }
    const data = (await res.json()) as { sid: string };
    return { ok: true, sid: data.sid };
  } catch (err) {
    return {
      ok: false,
      reason: "send_failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
