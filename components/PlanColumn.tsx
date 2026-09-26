"use client";

import { PlanEntry, Phase } from "@/lib/types";
import { ChecklistState } from "@/lib/checklist";

export const PHASE_META: Record<Phase, { title: string; note: string }> = {
  foundation: {
    title: "Этап 1. Фундамент",
    note: "Без этого платный трафик и продвижение будут работать вхолостую",
  },
  traffic: {
    title: "Этап 2. Привлечение трафика",
    note: "Каналы, подобранные под вашу нишу, бюджет и цель",
  },
  retention: {
    title: "Этап 3. Удержание и повторные продажи",
    note: "Дешевле удержать клиента, чем привлечь нового",
  },
};

interface PlanColumnProps {
  phase: Phase;
  entries: PlanEntry[];
  /** Если передан — рядом с каждым шагом появляется чекбокс выполнения. */
  checklist?: ChecklistState;
  onToggleStep?: (moduleId: string, stepIndex: number, stepsLength: number) => void;
}

export default function PlanColumn({ phase, entries, checklist, onToggleStep }: PlanColumnProps) {
  const meta = PHASE_META[phase];
  if (entries.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between border-b border-line pb-2 mb-4">
        <h3 className="font-display text-lg md:text-xl text-ink-900">{meta.title}</h3>
        <span className="hidden md:block text-sm text-muted">{meta.note}</span>
      </div>
      <p className="md:hidden text-sm text-muted mb-4">{meta.note}</p>
      <div className="space-y-4">
        {entries.map((entry, i) => {
          const doneArr = checklist?.[entry.module.id] ?? [];
          const doneCount = doneArr.filter(Boolean).length;
          const total = entry.module.steps.length;
          return (
            <details
              key={entry.module.id}
              className="group rounded-xl border border-line bg-white open:bg-white transition-colors"
              open={i === 0}
            >
              <summary className="flex cursor-pointer items-start gap-4 list-none p-4 md:p-5">
                <span className="waypoint-num shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet text-paper">
                  {i + 1}
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base md:text-lg text-ink-900">
                    {entry.module.title}
                  </span>
                  <span className="block text-sm text-muted mt-1">
                    {entry.module.timeToResult}
                    {checklist && total > 0 && (
                      <span className={doneCount === total ? "text-violet font-medium" : undefined}>
                        {" "}
                        · выполнено {doneCount} из {total}
                      </span>
                    )}
                  </span>
                </span>
                <span className="mt-1 text-ink-900/30 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="px-4 md:px-5 pb-5 pl-[3.25rem] md:pl-[3.75rem]">
                <p className="text-sm md:text-base text-ink-900/80 mb-3">{entry.reason}</p>
                <ul className="space-y-2">
                  {entry.module.steps.map((step, si) => {
                    const checked = Boolean(doneArr[si]);
                    if (checklist && onToggleStep) {
                      return (
                        <li key={si}>
                          <label className="flex cursor-pointer items-start gap-2.5 text-sm md:text-base">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleStep(entry.module.id, si, entry.module.steps.length)}
                              className="mt-1 h-4 w-4 shrink-0 accent-violet"
                            />
                            <span className={checked ? "text-ink-900/40 line-through" : "text-ink-900/90"}>
                              {step}
                            </span>
                          </label>
                        </li>
                      );
                    }
                    return (
                      <li key={si} className="flex gap-2 text-sm md:text-base text-ink-900/90">
                        <span className="text-brand font-mono">→</span>
                        <span>{step}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
