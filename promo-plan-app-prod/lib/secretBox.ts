import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Простое симметричное шифрование для секретов, которые нужно положить в
// базу (OAuth-токены Яндекс Метрики) — чтобы дамп базы сам по себе не
// раскрывал рабочие токены доступа к чужой Метрике. Ключ выводится из уже
// обязательного NEXTAUTH_SECRET — заводить для этого ещё одну переменную
// окружения не нужно.

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || "";
  return createHash("sha256").update(secret).digest(); // 32 байта — подходит для aes-256
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptSecret(value: string): string {
  const [ivHex, tagHex, dataHex] = value.split(".");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Некорректный формат зашифрованного значения");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
