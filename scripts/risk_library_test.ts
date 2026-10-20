// Запуск: npx tsx scripts/risk_library_test.ts  (библиотека типовых угроз под управлением администратора)
import { builtinEntries, mergeLibrary, libraryForBusiness, resolveTypeKey, parseTemplateInput, type TemplateRow } from "@/lib/riskLibrary";
import { keywordsForRisk } from "@/lib/riskWatch";
import { risksForBusiness } from "@/lib/risksCore";

let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.log("FAIL:", msg); } else console.log("ok  :", msg); };
const row = (o: Partial<TemplateRow> & { id: string }): TemplateRow => ({ builtin: false, hidden: false, title: "", category: "economy", what: "", signal: "", measures: "", plan: "", probability: 3, impact: 3, every: 30, keywords: "", types: [], ...o });

// без правок администратора пользователь видит ровно то же, что и раньше
for (const type of ["retail", "services", "horeca", "b2b", "online_edu", "ecommerce", "other", "Услуги", "Кафе, ресторан", "неизвестно", undefined]) {
  const a = libraryForBusiness(mergeLibrary([]), type as string).map((t) => t.id).sort().join();
  const b = risksForBusiness(type as string).map((t) => t.id).sort().join();
  ok(a === b, `без правок список для «${type}» совпадает со встроенным`);
}
ok(resolveTypeKey("Услуги") === "services" && resolveTypeKey("services") === "services" && resolveTypeKey("что-то") === "other" && resolveTypeKey(null) === "other", "тип бизнеса по ключу и по подписи");

const universal = builtinEntries().find((e) => e.id === "x-law-change")!;
const edited = mergeLibrary([row({ id: "x-law-change", builtin: true, title: "Новые законы (моя редакция)", category: "legal", what: "ч", signal: "с", measures: "м", plan: "п", probability: 5, impact: 4, every: 14, keywords: "маркировк, штраф" })]);
const e1 = edited.find((e) => e.id === "x-law-change")!;
ok(e1.title === "Новые законы (моя редакция)" && e1.edited && e1.probability === 5 && e1.every === 14 && e1.types.length === 0 && e1.title !== universal.title, "правка встроенной угрозы подменяет текст и оценки");
ok(libraryForBusiness(edited, "services").find((t) => t.id === "x-law-change")?.title === "Новые законы (моя редакция)", "пользователь видит правку администратора");

const hidden = mergeLibrary([row({ id: "x-currency", builtin: true, hidden: true })]);
const h = hidden.find((e) => e.id === "x-currency")!;
ok(h.hidden && !h.edited && h.title === builtinEntries().find((e) => e.id === "x-currency")!.title, "скрытая угроза сохраняет исходный текст, помечена скрытой");
ok(!libraryForBusiness(hidden, "services").some((t) => t.id === "x-currency"), "скрытая угроза пользователю не показывается");

const custom = mergeLibrary([
  row({ id: "c-aaa", title: "Закрытие границ для поставок", category: "supply", types: ["retail", "ecommerce", "левый"], keywords: "граница, таможн" }),
  row({ id: "c-bbb", title: "Для всех типов бизнеса", types: [] }),
  row({ id: "c-ccc", title: "Скрытая своя", hidden: true }),
]);
ok(libraryForBusiness(custom, "retail").some((t) => t.id === "c-aaa") && libraryForBusiness(custom, "Интернет-магазин").some((t) => t.id === "c-aaa"), "своя угроза для типов: видна «Розничной торговле» и «Интернет-магазину»");
ok(!libraryForBusiness(custom, "services").some((t) => t.id === "c-aaa") && libraryForBusiness(custom, "services").some((t) => t.id === "c-bbb"), "своя угроза не показывается другим типам, «для всех» показывается всем");
ok(!libraryForBusiness(custom, "retail").some((t) => t.id === "c-ccc"), "скрытая своя не показывается");
ok(custom.find((e) => e.id === "c-aaa")!.types.join() === "retail,ecommerce", "неизвестный тип бизнеса в записи отбрасывается");
ok(libraryForBusiness(custom, "retail").every((t) => !("types" in t) && !("hidden" in t) && !("builtin" in t)), "пользователю уходят только поля шаблона (без служебных)");

// ключевые слова: пользователь > администратор > встроенные > категория
const base = { category: "legal" as const, templateId: "c-aaa" };
const tpl = libraryForBusiness(custom, "retail");
ok(keywordsForRisk({ ...base, watch: "мои слова" }, tpl)[0] === "мои слова", "слова пользователя важнее");
ok(keywordsForRisk(base, tpl).join() === "граница,таможн", "слова администратора из библиотеки");
ok(keywordsForRisk({ category: "supply", templateId: "x-border-supply" }, tpl).length > 0 && keywordsForRisk({ category: "supply" }).length > 0, "без слов администратора работают встроенные и слова категории");

// ввод администратора
const good = { title: "Новая угроза для всех", category: "supply", every: 30, probability: 3, impact: 4, what: " что ", keywords: "Граница; ТАМОЖН, ab", types: ["retail", "левый"] };
const pg = parseTemplateInput(good);
ok(pg.ok && pg.value.types.join() === "retail" && pg.value.keywords === "граница, таможн" && pg.value.what === "что", "ввод: типы и слова нормализуются");
for (const bad of [{ ...good, title: "ab" }, { ...good, category: "nope" }, { ...good, every: 5 }, { ...good, probability: 0 }, { ...good, impact: 6 }, { ...good, impact: 2.5 }, null, "x"]) {
  ok(!parseTemplateInput(bad).ok, "ввод отклонён: " + JSON.stringify(bad)?.slice(0, 60));
}
const long = parseTemplateInput({ ...good, measures: "я".repeat(5000), keywords: "я".repeat(900) });
ok(long.ok && long.value.measures.length === 1500, "ввод: длинные тексты обрезаются");

console.log(fails === 0 ? "\nВСЕ ТЕСТЫ ПРОШЛИ" : `\nПРОВАЛЕНО: ${fails}`);
process.exit(fails ? 1 : 0);
