import { Answers, GeneratedPlan, PlanEntry, Phase, PlanModule } from "./types";
import { getEffectiveModules } from "./adminModules";

const PHASE_LIMITS: Record<Phase, number> = {
  foundation: 3,
  traffic: 4,
  retention: 2,
};

const businessLabels: Record<Answers["businessType"], string> = {
  retail: "розничной торговли",
  services: "сферы услуг",
  horeca: "кафе/ресторана",
  b2b: "B2B-компании",
  online_edu: "онлайн-школы",
  ecommerce: "интернет-магазина",
  other: "вашего бизнеса",
};

const budgetLabels: Record<Answers["budget"], string> = {
  under20: "ограниченным бюджетом (до 20 000 ₽/мес)",
  "20to100": "бюджетом 20 000–100 000 ₽/мес",
  "100to500": "бюджетом 100 000–500 000 ₽/мес",
  over500: "бюджетом более 500 000 ₽/мес",
};

function buildEntries(modules: PlanModule[], a: Answers, phase: Phase): PlanEntry[] {
  return modules
    .filter((m) => m.phase === phase)
    .map((m) => ({ module: m, score: m.score(a), reason: m.why(a) }))
    .filter((e) => e.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, PHASE_LIMITS[phase]);
}

export function generatePlan(a: Answers): GeneratedPlan {
  const modules = getEffectiveModules();
  const foundation = buildEntries(modules, a, "foundation");
  const traffic = buildEntries(modules, a, "traffic");
  const retention = buildEntries(modules, a, "retention");

  const summary = `Персональный маршрут для ${businessLabels[a.businessType]} с ${
    budgetLabels[a.budget]
  }. Начните с фундамента (${foundation.length} шага), затем подключайте каналы трафика (${
    traffic.length
  }) и закрепляйте результат удержанием клиентов (${retention.length}).`;

  return { answers: a, foundation, traffic, retention, summary };
}
