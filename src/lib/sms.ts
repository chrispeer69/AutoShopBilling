import type { Shop } from "@prisma/client";
import { decrypt } from "@/lib/crypto";

export function smsConfigured(shop: Shop) {
  return !!(shop.twilioSid && shop.twilioTokenEnc && shop.twilioFrom);
}

export async function sendSms(shop: Shop, to: string, body: string) {
  if (!smsConfigured(shop)) throw new Error("Text messaging isn't set up. Add Twilio settings in Settings.");
  const token = decrypt(shop.twilioTokenEnc);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${shop.twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${shop.twilioSid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: shop.twilioFrom, Body: body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Twilio error ${res.status}`);
  }
}
