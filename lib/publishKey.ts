import { prisma } from "./db";
import { generatePublishKey, hashPublishKey, keyMatches } from "./publishKeyCore";

const HASH_ROW = "BLOG_PUBLISH_KEY";
const USED_ROW = "BLOG_PUBLISH_KEY_USED";

/** Создаёт новый ключ (старый перестаёт работать). Возвращает сам ключ — показывается один раз. */
export async function createPublishKey(): Promise<string> {
  const key = generatePublishKey();
  const value = hashPublishKey(key);
  await prisma.integrationKey.upsert({ where: { name: HASH_ROW }, create: { name: HASH_ROW, value }, update: { value } });
  await prisma.integrationKey.deleteMany({ where: { name: USED_ROW } });
  return key;
}

export async function revokePublishKey() {
  await prisma.integrationKey.deleteMany({ where: { name: { in: [HASH_ROW, USED_ROW] } } });
}

export async function publishKeyStatus(): Promise<{ set: boolean; createdAt: string | null; lastUsedAt: string | null }> {
  const row = await prisma.integrationKey.findUnique({ where: { name: HASH_ROW } });
  const used = await prisma.integrationKey.findUnique({ where: { name: USED_ROW } });
  return { set: Boolean(row), createdAt: row?.updatedAt?.toISOString() ?? null, lastUsedAt: used?.value ?? null };
}

export async function verifyPublishKey(presented: string): Promise<boolean> {
  const row = await prisma.integrationKey.findUnique({ where: { name: HASH_ROW } });
  if (!row || !keyMatches(presented, row.value)) return false;
  const value = new Date().toISOString();
  await prisma.integrationKey
    .upsert({ where: { name: USED_ROW }, create: { name: USED_ROW, value }, update: { value } })
    .catch(() => {});
  return true;
}
