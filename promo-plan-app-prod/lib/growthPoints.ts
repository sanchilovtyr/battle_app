// "Точки роста" — сквозной движок рекомендаций для бизнеса. В отличие от
// lib/ruleEngine.ts (который один раз считает план по анкете), этот движок
// пересчитывается каждый раз от актуального состояния: чек-листа, воронки
// (lib/funnel.ts) и подключения Яндекс.Метрики. Каждое правило по
// возможности сверяет минимум два источника данных друг с другом, а не
// смотрит на них по отдельности — иначе это был бы просто список из трёх
// независимых блоков.
//
// Принципиально: движок никогда не сравнивает цифры клиента со средними по
// рынку/нише — таких проверенных данных у нас нет, а придумывать их нельзя.
// Все рекомендации строятся только на данных, которые сам клиент ввёл или
// подтянул из своей Метрики, и на структуре его собственного плана.

import { GeneratedPlan, Phase, PlanEntry } from "./types";
import { ChecklistState, moduleProgress, phaseProgress, unfinishedSteps } from "./checklist";
import { FunnelSnapshot } from "./funnel";
import { GrowthTarget } from "./growthTarget";

export interface GrowthPoint {
  id: string;
  title: string;
  body: string;
  action?: string; // конкретный следующий шаг
  phase?: Phase;
  priority: number; // выше — важнее, топ-3 показываются пользователю
}

export interface GrowthPointsInput {
  plan: GeneratedPlan;
  checklist: ChecklistState;
  snapshots: FunnelSnapshot[];
  metrikaConnected: boolean;
  metrikaGoalsSet: boolean; // настроена хотя бы одна цель (заявки или продажи)
  target: GrowthTarget;
}

const PHASE_LABEL: Record<Phase, string> = {
  foundation: "Фундамент",
  traffic: "Трафик",
  retention: "Удержание",
};

function allEntries(plan: GeneratedPlan): PlanEntry[] {
  return [...plan.foundation, ...plan.traffic, ...plan.retention];
}

function findEntry(plan: GeneratedPlan, moduleId: string): PlanEntry | undefined {
  return allEntries(plan).find((e) => e.module.id === moduleId);
}

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

interface Stage {
  key: "toLeads" | "toSales" | "toRepeat";
  value: number | null;
}

function buildStages(s: FunnelSnapshot): Stage[] {
  return [
    { key: "toLeads", value: pct(s.leads, s.visitors) },
    { key: "toSales", value: pct(s.sales, s.leads) },
    { key: "toRepeat", value: pct(s.repeat, s.sales) },
  ];
}

function weakestStage(stages: Stage[]): Stage | null {
  const withValue = stages.filter((s) => s.value !== null);
  if (withValue.length === 0) return null;
  return withValue.reduce((min, s) => (s.value! < min.value! ? s : min), withValue[0]);
}

function firstUnfinished(plan: GeneratedPlan, checklist: ChecklistState, phase: Phase) {
  const entries = plan[phase];
  const steps = unfinishedSteps(checklist, entries, 1);
  return steps[0] ?? null;
}

// ---- Правила ----------------------------------------------------------

/** Нет вообще никаких данных — без них любая другая рекомендация гадательна. */
function ruleNoData(input: GrowthPointsInput): GrowthPoint | null {
  if (input.snapshots.length > 0 || input.metrikaConnected) return null;
  return {
    id: "no-data",
    title: "Пока не на чем строить точки роста",
    body: "Внесите показатели воронки хотя бы за один период (или подключите Яндекс.Метрику) — без цифр можно опираться только на общий план, но не на то, что реально происходит с вашими клиентами.",
    priority: 100,
  };
}

/** Пункт про аналитику отмечен выполненным, но Метрика не видит целей. */
function ruleChecklistMetrikaMismatch(input: GrowthPointsInput): GrowthPoint | null {
  const entry = findEntry(input.plan, "analytics");
  if (!entry) return null;
  const progress = moduleProgress(input.checklist, "analytics", entry.module.steps.length);
  if (progress.total === 0 || progress.pct < 100) return null;
  if (input.metrikaGoalsSet) return null;
  return {
    id: "checklist-metrika-mismatch",
    title: "Аналитика отмечена как настроенная, но цели не подключены",
    body: input.metrikaConnected
      ? "Метрика подключена, но заявки и продажи в ней не размечены целями — по факту вы не увидите в ней, что реально приводит к заявке. Стоит перепроверить, а не просто отметить пункт."
      : "Пункт про аналитику в чек-листе отмечен выполненным, но Метрика к этому бизнесу вообще не подключена — без неё нельзя автоматически проверять, что происходит с трафиком.",
    action: "Проверьте настройку целей в Яндекс.Метрике (или подключите её в разделе «Где вы теряете клиентов»).",
    phase: "foundation",
    priority: 95,
  };
}

/** Юнит-экономика не сходится: продажа стоит дороже, чем приносит. */
function ruleUnitEconomics(input: GrowthPointsInput): GrowthPoint | null {
  const latest = input.snapshots[input.snapshots.length - 1];
  if (!latest || !latest.adSpend || !latest.avgReceipt) return null;
  if (!latest.sales) return null;
  const costPerSale = latest.adSpend / latest.sales;
  if (costPerSale <= latest.avgReceipt) return null;
  return {
    id: "unit-economics",
    title: "Продажа обходится дороже, чем приносит",
    body: `За «${latest.label}» реклама стоила ${Math.round(latest.adSpend).toLocaleString(
      "ru-RU"
    )} ₽ на ${latest.sales} продаж(и) — то есть примерно ${Math.round(costPerSale).toLocaleString(
      "ru-RU"
    )} ₽ за продажу, при среднем чеке ${Math.round(latest.avgReceipt).toLocaleString("ru-RU")} ₽. Пока это не окупается — маркетинговый план тут не поможет, нужно менять либо канал/цену показов, либо саму воронку (конверсию заявки в продажу), либо средний чек.`,
    priority: 92,
  };
}

/** Заявки долго не обрабатывают, и именно на этом этапе теряют клиентов. */
function ruleSlowResponse(input: GrowthPointsInput): GrowthPoint | null {
  const latest = input.snapshots[input.snapshots.length - 1];
  if (!latest) return null;
  const slow = latest.responseSpeed === "slower" || latest.dropReason === "no_answer";
  if (!slow) return null;
  const stages = buildStages(latest);
  const weak = weakestStage(stages);
  if (weak && weak.key !== "toSales") return null; // сигнал про скорость важен именно тут
  return {
    id: "slow-response",
    title: "Заявки обрабатываются медленно",
    body: "Это часто теряет больше клиентов, чем любая реклама: пока вы отвечаете сутками, человек уже написал конкуренту. Обычно достаточно начать отвечать в течение часа, чтобы конверсия заявки в продажу заметно выросла — раньше, чем сработает любой пункт плана.",
    phase: "retention",
    priority: 88,
  };
}

/** Весь план по трафику выполнен, а обращений больше не становится. */
function ruleTrafficDoneFunnelFlat(input: GrowthPointsInput): GrowthPoint | null {
  const trafficProgress = phaseProgress(input.checklist, input.plan.traffic);
  if (trafficProgress.total === 0 || trafficProgress.pct < 100) return null;
  if (input.snapshots.length < 2) return null;
  const prev = input.snapshots[input.snapshots.length - 2];
  const latest = input.snapshots[input.snapshots.length - 1];
  if (latest.visitors > prev.visitors) return null;
  return {
    id: "traffic-done-flat",
    title: "Весь план по трафику выполнен, а обращений не прибавилось",
    body: `С «${prev.label}» по «${latest.label}» обращения не выросли (${prev.visitors} → ${latest.visitors}), хотя все пункты этапа «Трафик» уже сделаны. Вероятно, дело не в том, что ещё не попробовано, а в том, что уже запущенные каналы не сработали, — стоит пересмотреть их, а не добавлять новые.`,
    phase: "traffic",
    priority: 85,
  };
}

/** Причина отказов указана явно — направляем к конкретному действию. */
function ruleDropReason(input: GrowthPointsInput): GrowthPoint | null {
  const latest = input.snapshots[input.snapshots.length - 1];
  if (!latest?.dropReason || latest.dropReason === "unknown" || latest.dropReason === "no_answer") {
    return null; // no_answer уже обрабатывается ruleSlowResponse
  }
  const byReason: Record<string, { title: string; body: string; phase: Phase }> = {
    price: {
      title: "Чаще всего отказывают из-за цены",
      body: "Это не всегда значит «снижайте цену» — часто помогает точнее объяснить, за что клиент платит, добавить рассрочку/пакеты или ориентир по стоимости прямо в предложении, чтобы отсеивать нецелевые обращения раньше.",
      phase: "foundation",
    },
    competitor: {
      title: "Клиенты уходят к конкурентам",
      body: "Стоит понять, чем конкретно конкурент убеждает — часто это репутация (отзывы, рейтинг на картах) или более понятное предложение, а не обязательно цена.",
      phase: "foundation",
    },
    changed_mind: {
      title: "Клиенты передумывают после первого контакта",
      body: "Это типичный повод для рассылок/напоминаний: тёплый контакт остывает, если с ним не работать после первого обращения.",
      phase: "retention",
    },
  };
  const info = byReason[latest.dropReason];
  if (!info) return null;
  const step = firstUnfinished(input.plan, input.checklist, info.phase);
  return {
    id: `drop-reason-${latest.dropReason}`,
    title: info.title,
    body: info.body,
    action: step ? `${step.moduleTitle}: ${step.step}` : undefined,
    phase: info.phase,
    priority: 80,
  };
}

/** Слабое звено воронки → конкретный невыполненный шаг именно в этой фазе. */
function ruleWeakestStage(input: GrowthPointsInput): GrowthPoint | null {
  const latest = input.snapshots[input.snapshots.length - 1];
  if (!latest) return null;
  const weak = weakestStage(buildStages(latest));
  if (!weak) return null;

  const byKey: Record<Stage["key"], { title: string; phase: Phase }> = {
    toLeads: { title: "Больше всего клиентов теряется на входе — обращения не становятся заявками", phase: "foundation" },
    toSales: { title: "Заявки есть, но до оплаты доходят немногие", phase: "retention" },
    toRepeat: { title: "Клиенты покупают один раз и не возвращаются", phase: "retention" },
  };
  const info = byKey[weak.key];
  const step = firstUnfinished(input.plan, input.checklist, info.phase);
  if (!step) return null; // если по фазе всё сделано — тут нечего предложить, это не точка роста

  return {
    id: `weakest-${weak.key}`,
    title: info.title,
    body: `Это самый слабый переход в вашей воронке (${weak.value}%). Ближайший шаг из этапа «${PHASE_LABEL[info.phase]}», который ещё не сделан:`,
    action: `${step.moduleTitle}: ${step.step}`,
    phase: info.phase,
    priority: 70,
  };
}

/** Весь трафик держится на одном канале последние несколько периодов. */
function ruleSingleChannel(input: GrowthPointsInput): GrowthPoint | null {
  const recent = input.snapshots.slice(-3).filter((s) => s.channel);
  if (recent.length < 2) return null;
  const channel = recent[0].channel;
  if (!recent.every((s) => s.channel === channel)) return null;
  const step = firstUnfinished(input.plan, input.checklist, "traffic");
  return {
    id: "single-channel",
    title: "Весь рост держится на одном канале",
    body: "Последние периоды обращения приходят практически из одного источника — это риск: если канал подорожает или перестанет работать, обращения сразу просядут. Стоит параллельно пробовать ещё один канал из плана.",
    action: step ? `${step.moduleTitle}: ${step.step}` : undefined,
    phase: "traffic",
    priority: 55,
  };
}

/** Отзывы не растут, а пункт про карты/отзывы ещё не закрыт. */
function ruleReviewsStagnant(input: GrowthPointsInput): GrowthPoint | null {
  const entry = findEntry(input.plan, "maps_reputation");
  if (!entry) return null;
  const progress = moduleProgress(input.checklist, "maps_reputation", entry.module.steps.length);
  if (progress.total === 0 || progress.pct >= 100) return null;

  const withReviews = input.snapshots.filter((s) => typeof s.reviewsCount === "number");
  if (withReviews.length === 0) return null;
  const latest = withReviews[withReviews.length - 1];
  const grew = withReviews.length >= 2 && latest.reviewsCount! > withReviews[withReviews.length - 2].reviewsCount!;
  if (grew) return null;

  const step = unfinishedSteps(input.checklist, [entry], 1)[0];
  return {
    id: "reviews-stagnant",
    title: "Отзывы не растут, а карточки на картах ещё не доведены до конца",
    body: `Сейчас у вас ${latest.reviewsCount} отзыв(ов)${
      latest.reviewsRating ? ` при рейтинге ${latest.reviewsRating}` : ""
    }, и за последние периоды это число не увеличилось. Для многих ниш карты и отзывы дают обращения не хуже рекламы, но только если карточка доведена до конца.`,
    action: step ? step.step : undefined,
    phase: "foundation",
    priority: 60,
  };
}

/** Факт заметно отстаёт от собственной цели клиента. */
function ruleTargetGap(input: GrowthPointsInput): GrowthPoint | null {
  const latest = input.snapshots[input.snapshots.length - 1];
  if (!latest) return null;
  const { target } = input;
  const checks: { actual: number; goal?: number; label: string }[] = [
    { actual: latest.leads, goal: target.leadsPerMonth, label: "заявкам" },
    { actual: latest.sales, goal: target.salesPerMonth, label: "продажам" },
  ];
  for (const c of checks) {
    if (!c.goal) continue;
    const ratio = c.actual / c.goal;
    if (ratio >= 0.8) continue;
    return {
      id: `target-gap-${c.label}`,
      title: `До своей цели по ${c.label} пока далеко`,
      body: `За «${latest.label}»: ${c.actual} из ${c.goal} — это ${Math.round(ratio * 100)}% от цели, которую вы сами поставили. Прежде чем менять план, стоит убедиться, что цель реалистична для текущего бюджета и этапа.`,
      priority: 65,
    };
  }
  return null;
}

// ruleNoData обрабатывается отдельно в computeGrowthPoints (короткое замыкание —
// если данных нет вообще, остальные правила гарантированно ничего не найдут).
const RULES: ((input: GrowthPointsInput) => GrowthPoint | null)[] = [
  ruleChecklistMetrikaMismatch,
  ruleUnitEconomics,
  ruleSlowResponse,
  ruleTrafficDoneFunnelFlat,
  ruleDropReason,
  ruleWeakestStage,
  ruleSingleChannel,
  ruleReviewsStagnant,
  ruleTargetGap,
];

export function computeGrowthPoints(input: GrowthPointsInput, limit = 3): GrowthPoint[] {
  const noData = ruleNoData(input);
  if (noData) return [noData];

  const points = RULES.map((rule) => rule(input)).filter((p): p is GrowthPoint => p !== null);
  return points.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
