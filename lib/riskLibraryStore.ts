// Чтение библиотеки угроз из базы (только сервер).
import { prisma } from "@/lib/db";
import { mergeLibrary, type LibraryEntry, type TemplateRow } from "@/lib/riskLibrary";

export const rtDb = prisma as any;

export async function loadLibrary(): Promise<LibraryEntry[]> {
  const rows = (await rtDb.riskTemplateRow.findMany()) as TemplateRow[];
  return mergeLibrary(rows);
}
