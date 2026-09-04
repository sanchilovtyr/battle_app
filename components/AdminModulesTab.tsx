"use client";

import { useMemo, useState } from "react";
import {
  getEditableBaseModules,
  getCustomModules,
  saveOverride,
  clearOverride,
  saveCustomModule,
  deleteCustomModule,
  CustomModule,
} from "@/lib/adminModules";
import { Phase, BusinessType } from "@/lib/types";
import { QUESTIONS } from "@/lib/questions";

const PHASE_LABELS: Record<Phase, string> = {
  foundation: "Этап 1 · Фундамент",
  traffic: "Этап 2 · Трафик",
  retention: "Этап 3 · Удержание",
};

const BUSINESS_TYPE_OPTIONS =
  QUESTIONS.find((q) => q.id === "businessType")?.options ?? [];

interface FormState {
  title: string;
  why: string;
  timeToResult: string;
  steps: string[];
  phase: Phase;
  score: number;
  businessTypes: BusinessType[];
}

const EMPTY_FORM: FormState = {
  title: "",
  why: "",
  timeToResult: "",
  steps: [""],
  phase: "traffic",
  score: 5,
  businessTypes: [],
};

export default function AdminModulesTab() {
  const [version, setVersion] = useState(0); // для форс-обновления после сохранения в localStorage
  const [target, setTarget] = useState<{ kind: "base" | "custom" | "new"; id: string | null } | null>(
    null
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const baseModules = useMemo(() => getEditableBaseModules(), [version]);
  const customModules = useMemo(() => getCustomModules(), [version]);

  const refresh = () => setVersion((v) => v + 1);

  const openEditBase = (id: string) => {
    const m = baseModules.find((x) => x.id === id);
    if (!m) return;
    setForm({
      title: m.title,
      why: m.why({} as never),
      timeToResult: m.timeToResult,
      steps: [...m.steps],
      phase: m.phase,
      score: 5,
      businessTypes: [],
    });
    setTarget({ kind: "base", id });
  };

  const openEditCustom = (m: CustomModule) => {
    setForm({
      title: m.title,
      why: m.why,
      timeToResult: m.timeToResult,
      steps: [...m.steps],
      phase: m.phase,
      score: m.score,
      businessTypes: [...m.businessTypes],
    });
    setTarget({ kind: "custom", id: m.id });
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setTarget({ kind: "new", id: null });
  };

  const closeForm = () => setTarget(null);

  const updateStep = (i: number, value: string) => {
    const steps = [...form.steps];
    steps[i] = value;
    setForm({ ...form, steps });
  };

  const addStep = () => setForm({ ...form, steps: [...form.steps, ""] });
  const removeStep = (i: number) =>
    setForm({ ...form, steps: form.steps.filter((_, si) => si !== i) });

  const toggleBusinessType = (bt: BusinessType) => {
    setForm((f) => ({
      ...f,
      businessTypes: f.businessTypes.includes(bt)
        ? f.businessTypes.filter((x) => x !== bt)
        : [...f.businessTypes, bt],
    }));
  };

  const save = () => {
    if (!target) return;
    const cleanSteps = form.steps.map((s) => s.trim()).filter(Boolean);

    if (target.kind === "base" && target.id) {
      saveOverride(target.id, {
        title: form.title.trim(),
        why: form.why.trim(),
        timeToResult: form.timeToResult.trim(),
        steps: cleanSteps,
      });
    } else {
      const id = target.kind === "custom" && target.id ? target.id : `custom-${Date.now()}`;
      saveCustomModule({
        id,
        title: form.title.trim(),
        phase: form.phase,
        timeToResult: form.timeToResult.trim(),
        why: form.why.trim(),
        steps: cleanSteps,
        score: form.score,
        businessTypes: form.businessTypes,
      });
    }
    closeForm();
    refresh();
  };

  const resetBase = (id: string) => {
    clearOverride(id);
    refresh();
  };

  const removeCustom = (id: string) => {
    deleteCustomModule(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Правки здесь по-настоящему меняют планы, которые получают пользователи в этом браузере:
        текст встроенных пунктов можно переписать, а формулу их приоритета — только у новых
        пунктов, которые вы добавляете сами.
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base text-ink-900">Встроенные пункты</h3>
        </div>
        <div className="space-y-2">
          {baseModules.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{m.title}</span>
                  {m.isOverridden && (
                    <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] text-violet">
                      Изменено
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">{PHASE_LABELS[m.phase]}</span>
              </div>
              <div className="flex gap-2">
                {m.isOverridden && (
                  <button
                    onClick={() => resetBase(m.id)}
                    className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  onClick={() => openEditBase(m.id)}
                  className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
                >
                  Редактировать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base text-ink-900">Добавленные пункты</h3>
          <button
            onClick={openNew}
            className="rounded-full bg-brand px-4 py-2 text-sm font-extrabold text-ink-900 hover:bg-brand/90"
          >
            + Добавить пункт
          </button>
        </div>
        {customModules.length === 0 && (
          <p className="text-sm text-muted">Пока ничего не добавлено.</p>
        )}
        <div className="space-y-2">
          {customModules.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-4"
            >
              <div>
                <span className="font-medium text-ink-900">{m.title}</span>
                <div className="text-xs text-muted">
                  {PHASE_LABELS[m.phase]} · приоритет {m.score} ·{" "}
                  {m.businessTypes.length === 0
                    ? "все типы бизнеса"
                    : `${m.businessTypes.length} тип(ов) бизнеса`}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => removeCustom(m.id)}
                  className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                >
                  Удалить
                </button>
                <button
                  onClick={() => openEditCustom(m)}
                  className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
                >
                  Редактировать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {target && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onClick={closeForm}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <h3 className="mb-4 font-display text-lg text-ink-900">
              {target.kind === "base" ? "Редактировать пункт" : target.kind === "new" ? "Новый пункт" : "Редактировать добавленный пункт"}
            </h3>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Название</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>

              {target.kind !== "base" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Этап</label>
                    <select
                      value={form.phase}
                      onChange={(e) => setForm({ ...form, phase: e.target.value as Phase })}
                      className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                    >
                      {(Object.keys(PHASE_LABELS) as Phase[]).map((p) => (
                        <option key={p} value={p}>
                          {PHASE_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Приоритет (1–10)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={form.score}
                      onChange={(e) => setForm({ ...form, score: Number(e.target.value) })}
                      className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-muted">Срок до результата</label>
                <input
                  value={form.timeToResult}
                  onChange={(e) => setForm({ ...form, timeToResult: e.target.value })}
                  placeholder="например, 2–3 недели"
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted">Почему это важно</label>
                <textarea
                  value={form.why}
                  onChange={(e) => setForm({ ...form, why: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted">Шаги</label>
                <div className="space-y-2">
                  {form.steps.map((step, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={step}
                        onChange={(e) => updateStep(i, e.target.value)}
                        className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                      />
                      <button
                        onClick={() => removeStep(i)}
                        className="shrink-0 rounded-xl border border-line px-3 text-sm text-muted hover:bg-soft"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addStep}
                  className="mt-2 text-sm text-violet underline underline-offset-4"
                >
                  + Добавить шаг
                </button>
              </div>

              {target.kind !== "base" && (
                <div>
                  <label className="mb-1 block text-xs text-muted">
                    Для каких типов бизнеса (ничего не выбрано — для всех)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BUSINESS_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => toggleBusinessType(opt.value as BusinessType)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          form.businessTypes.includes(opt.value as BusinessType)
                            ? "bg-violet text-white"
                            : "border border-line bg-white text-ink-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                onClick={closeForm}
                className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-medium text-ink-900 hover:bg-soft"
              >
                Отмена
              </button>
              <button
                onClick={save}
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
