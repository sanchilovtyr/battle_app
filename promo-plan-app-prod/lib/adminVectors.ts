import { VECTORS, VectorId, VectorProfile } from "./vectors";

/** Правки текста вектора аудитории — все поля, кроме id, можно переопределить */
export interface VectorOverrideData {
  name: string;
  tagline: string;
  pain: string;
  dream: string;
  toneAdvice: string;
  adTips: string[];
  avoid: string;
}

/** Векторы с применёнными правками — для админки (список + флаг "изменено") */
export function getEditableVectors(
  overrides: Record<string, VectorOverrideData>
): (VectorProfile & { isOverridden: boolean })[] {
  return VECTORS.map((v) => {
    const o = overrides[v.id];
    if (!o) return { ...v, isOverridden: false };
    return { ...v, ...o, isOverridden: true };
  });
}

/** Один вектор с применённой правкой (если есть) — для показа пользователю */
export function applyVectorOverride(
  base: VectorProfile,
  overrides: Record<string, VectorOverrideData>
): VectorProfile {
  const o = overrides[base.id];
  if (!o) return base;
  return { ...base, ...o };
}

export function isVectorId(id: string): id is VectorId {
  return VECTORS.some((v) => v.id === id);
}
