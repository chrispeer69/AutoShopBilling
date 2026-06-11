// AES-256-GCM for per-shop secrets (SMTP password, Stripe key, Twilio token).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const src = process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!src) throw new Error("Set APP_ENCRYPTION_KEY or NEXTAUTH_SECRET");
  return createHash("sha256").update(src).digest();
}

export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(stored: string): string {
  if (!stored) return "";
  const [ivB64, tagB64, dataB64] = stored.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
