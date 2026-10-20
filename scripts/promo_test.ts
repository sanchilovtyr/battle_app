// Запуск: npx tsx scripts/promo_test.ts  (промокоды: чистые правила, без базы и сети)
import { normalizeCode, isValidCode, priceWithPromo, evaluatePromo, parsePromoInput, generateCode, promoSummary, type PromoLike } from "@/lib/promoCore";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";

let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.log("FAIL:", msg); } else console.log("ok  :", msg); };
const now = new Date("2026-10-20T09:00:00Z");

ok(normalizeCode("  лето 2026 ") === "ЛЕТО2026" && normalizeCode("abc‐12") === "ABC-12" && normalizeCode(5) === "", "код: регистр, пробелы, юникод-дефис");
ok(isValidCode("AB1") && isValidCode("K7M2-9QXA") && !isValidCode("AB") && !isValidCode("X".repeat(33)) && !isValidCode("A B") && !isValidCode("A<B>"), "код: допустимые символы и длина");

const p50 = priceWithPromo(6990, 50);
ok(p50.finalRub === 3495 && p50.discountRub === 3495 && !p50.free, "скидка 50% от 6 990 = 3 495");
ok(priceWithPromo(6990, 33).finalRub === 4683 && priceWithPromo(6990, 33).originalRub === 6990, "скидка 33% округляется до рубля: 4 683");
ok(priceWithPromo(6990, 100).free && priceWithPromo(6990, 100).finalRub === 0, "100% — бесплатный месяц без платежа");
ok(priceWithPromo(100, 99).finalRub === 1 && !priceWithPromo(100, 99).free, "при скидке меньше 100% платить минимум 1 ₽");
ok(priceWithPromo(6990, 0).finalRub === 6990 && priceWithPromo(6990, 250).free, "скидка зажата в 0..100%");

const base: PromoLike = { active: true, percent: 50, planId: "agency", expiresAt: null, maxUses: null, usedCount: 0 };
const ctx = { now, planId: "agency", effectivePlanId: "trial", alreadyUsedByUser: false };
ok(evaluatePromo(base, ctx).ok, "обычный код на бесплатном тарифе подходит");
ok(!evaluatePromo(null, ctx).ok, "несуществующий код отклоняется");
ok(!evaluatePromo({ ...base, active: false }, ctx).ok, "выключенный код отклоняется");
ok(!evaluatePromo({ ...base, expiresAt: new Date("2026-10-20T08:59:00Z") }, ctx).ok && evaluatePromo({ ...base, expiresAt: new Date("2026-10-21T00:00:00Z") }, ctx).ok, "срок действия кода");
ok(!evaluatePromo({ ...base, maxUses: 5, usedCount: 5 }, ctx).ok && evaluatePromo({ ...base, maxUses: 5, usedCount: 4 }, ctx).ok, "лимит использований");
const r1 = evaluatePromo(base, { ...ctx, effectivePlanId: "start" });
ok(!r1.ok && r1.code === "not_free_plan", "на платном тарифе промокод не применяется");
const r2 = evaluatePromo(base, { ...ctx, alreadyUsedByUser: true });
ok(!r2.ok && r2.code === "already_used", "повторно тот же пользователь не может");
const r3 = evaluatePromo(base, { ...ctx, planId: "start" });
ok(!r3.ok && r3.code === "wrong_plan", "на другой тариф код не действует");
const a = evaluatePromo(null, ctx), b = evaluatePromo({ ...base, active: false }, ctx), c = evaluatePromo({ ...base, maxUses: 1, usedCount: 1 }, ctx);
ok(!a.ok && !b.ok && !c.ok && a.message === b.message && b.message === c.message, "«нет», «выключен», «закончился» неотличимы (код нельзя подобрать по ответам)");

ok(parsePromoInput({ code: "лето26", percent: 30 }, now).ok, "админ: простой код принимается");
const full = parsePromoInput({ code: "k7m2-9qxa", percent: 100, expiresAt: "2026-12-31", maxUses: 10, note: " друг " }, now);
ok(full.ok && full.value.code === "K7M2-9QXA" && full.value.maxUses === 10 && full.value.note === "друг" && full.value.expiresAt?.toISOString() === "2026-12-31T20:59:59.000Z", "админ: дата «до 31.12» = конец дня по Москве");
for (const bad of [{ code: "a", percent: 10 }, { code: "ABC", percent: 0 }, { code: "ABC", percent: 101 }, { code: "ABC", percent: 5.5 }, { code: "ABC", percent: 10, expiresAt: "2020-01-01" }, { code: "ABC", percent: 10, maxUses: 0 }, { code: "ABC", percent: 10, expiresAt: "не дата" }, null, "x"]) {
  ok(!parsePromoInput(bad, now).ok, "админ: отклонено " + JSON.stringify(bad));
}
const codes = new Set(Array.from({ length: 200 }, () => generateCode()));
ok(codes.size > 190 && [...codes].every((x) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(x) && isValidCode(x) && !/[01OI]/.test(x)), "случайные коды читаемы и допустимы");

const s50 = promoSummary(p50, 50, "6 990 ₽");
ok(/первый месяц/.test(s50) && /3 495 ₽ вместо 6 990 ₽/.test(s50) && /Со второго месяца/.test(s50) && /отменить можно/.test(s50), "текст для пользователя: скидка на первый месяц, дальше полная цена, отмена");
ok(/бесплатно/.test(promoSummary(priceWithPromo(6990, 100), 100, "6 990 ₽")) && /Автопродление не включится/.test(promoSummary(priceWithPromo(6990, 100), 100, "6 990 ₽")), "текст для бесплатного месяца");

// Бесплатный месяц оформляется как «отменённая» подписка с будущей датой: доступ есть до конца периода и потом сам пропадает
const end = new Date(now.getTime() + 30 * 86400000);
ok(computeEffectivePlanId({ planId: "agency", status: "cancelled", currentPeriodEnd: end }) === "agency", "бесплатный месяц: Премиум действует в течение периода");
ok(computeEffectivePlanId({ planId: "agency", status: "cancelled", currentPeriodEnd: new Date(Date.now() - 1000) }) === "trial", "бесплатный месяц: после окончания возврат на бесплатный тариф");

console.log(fails === 0 ? "\nВСЕ ТЕСТЫ ПРОШЛИ" : `\nПРОВАЛЕНО: ${fails}`);
process.exit(fails ? 1 : 0);
