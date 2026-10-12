"use client";

import { useState } from "react";

const OPTIONS = [
  { id: "no_plan", label: "Не понимаю, за что хвататься в первую очередь" },
  { id: "no_time", label: "Нет времени разбираться в маркетинге самому" },
  { id: "tried_agency", label: "Пробовал агентство/фрилансера — не сработало" },
  { id: "just_curious", label: "Просто интересно, что предложит сервис" },
] as const;

type OptionId = (typeof OPTIONS)[number]["id"];

const RESPONSES: Record<OptionId, string> = {
  no_plan: "Как раз для этого — 4 вопроса расставят приоритеты за вас.",
  no_time: "План уйдёт на чтение 3 минуты, а не на изучение курсов по маркетингу.",
  tried_agency: "План остаётся у вас — независимо от того, кто в итоге его выполняет.",
  just_curious: "Честно: покажем бесплатно, без карты и звонка менеджера.",
};

/** Лёгкий вопрос-крючок на главном экране — по образцу теста на главной у
 *  Додо Пиццы: не собирает данных и не подставляет их в план, просто
 *  вовлекает до перехода к настоящей анкете. Ответ честный и одинаковый по
 *  сути для всех, кто выбрал вариант — никакой скрытой "персонализации". */
export default function EngagementHook() {
  const [selected, setSelected] = useState<OptionId | null>(null);

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
      <p className="mb-3 text-sm font-medium text-white/85">Владелец бизнеса, что мешает вам с продвижением больше всего?</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === opt.id
                ? "border-brand bg-brand text-ink-900"
                : "border-white/20 text-white/75 hover:border-white/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/70">{RESPONSES[selected]}</p>
          <a
            href="#wizard"
            className="inline-block rounded-full bg-brand px-4 py-1.5 text-xs font-extrabold text-ink-900 transition-transform hover:-translate-y-0.5"
          >
            Пройти анкету →
          </a>
        </div>
      )}
    </div>
  );
}
