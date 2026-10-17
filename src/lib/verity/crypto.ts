import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("A stable AUTH_SECRET of at least 32 characters is required for the Verity connection.");
  return Buffer.from(hkdfSync("sha256", secret, "rental-app-verity", "credential-encryption-v1", 32));
}

export function encryptToken(token: string, userId: string) {
  if (!userId || !token || token.length > 2048) throw new Error("Invalid connection credential.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(ciphertext: string, userId: string) {
  if (!userId || ciphertext.length > 4096) throw new Error("Invalid connection credential.");
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported connection credential.");
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid connection credential.");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
