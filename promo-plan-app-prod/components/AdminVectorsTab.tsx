"use client";

import { useEffect, useState } from "react";
import { VectorId } from "@/lib/vectors";

interface VectorRow {
  id: VectorId;
  name: string;
  tagline: string;
  pain: string;
  dream: string;
  toneAdvice: string;
  adTips: string[];
  avoid: string;
  isOverridden: boolean;
}

interface FormState {
  name: string;
  tagline: string;
  pain: string;
  dream: string;
  toneAdvice: string;
  adTips: string[];
  avoid: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  tagline: "",
  pain: "",
  dream: "",
  toneAdvice: "",
  adTips: [""],
  avoid: "",
};

export default function AdminVectorsTab() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vectors, setVectors] = useState<VectorRow[]>([]);
  const [targetId, setTargetId] = useState<VectorId | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/vectors")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Ошибка загрузки");
        return res.json();
      })
      .then((data) => setVectors(data.vectors))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoaded(true));
  };

  useEffect(load, []);

  const openEdit = (v: VectorRow) => {
    setForm({
      name: v.name,
      tagline: v.tagline,
      pain: v.pain,
      dream: v.dream,
      toneAdvice: v.toneAdvice,
      adTips: v.adTips.length > 0 ? [...v.adTips] : [""],
      avoid: v.avoid,
    });
    setTargetId(v.id);
  };

  const closeForm = () => setTargetId(null);

  const updateTip = (i: number, value: string) => {
    const adTips = [...form.adTips];
    adTips[i] = value;
    setForm({ ...form, adTips });
  };
  const addTip = () => setForm({ ...form, adTips: [...form.adTips, ""] });
  const removeTip = (i: number) => setForm({ ...form, adTips: form.adTips.filter((_, ti) => ti !== i) });

  const save = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/vectors/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vectorId: targetId,
          name: form.name.trim(),
          tagline: form.tagline.trim(),
          pain: form.pain.trim(),
          dream: form.dream.trim(),
          toneAdvice: form.toneAdvice.trim(),
          adTips: form.adTips.map((t) => t.trim()).filter(Boolean),
          avoid: form.avoid.trim(),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Ошибка сохранения");
      closeForm();
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const reset = async (vectorId: VectorId) => {
    await fetch(`/api/admin/vectors/override?vectorId=${encodeURIComponent(vectorId)}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Правки здесь меняют расшифровку вектора аудитории, которую видят{" "}
        <b>все</b> пользователи с этим вектором — не только в этом браузере.
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>
      )}

      {!loaded && <p className="text-sm text-muted">Загрузка…</p>}

      {loaded && (
        <div className="space-y-2">
          {vectors.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{v.name}</span>
                  {v.isOverridden && (
                    <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] text-violet">
                      Изменено
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted">{v.tagline}</span>
              </div>
              <div className="flex gap-2">
                {v.isOverridden && (
                  <button
                    onClick={() => reset(v.id)}
                    className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  onClick={() => openEdit(v)}
                  className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
                >
                  Редактировать
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {targetId && (
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
            <h3 className="mb-4 font-display text-lg text-ink-900">Редактировать вектор</h3>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Название</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Короткое описание (tagline)</label>
                <input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Боль</label>
                <textarea
                  value={form.pain}
                  onChange={(e) => setForm({ ...form, pain: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Мечта</label>
                <textarea
                  value={form.dream}
                  onChange={(e) => setForm({ ...form, dream: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Тон коммуникации</label>
                <textarea
                  value={form.toneAdvice}
                  onChange={(e) => setForm({ ...form, toneAdvice: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Рекомендации по рекламе</label>
                <div className="space-y-2">
                  {form.adTips.map((tip, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={tip}
                        onChange={(e) => updateTip(i, e.target.value)}
                        className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                      />
                      <button
                        onClick={() => removeTip(i)}
                        className="shrink-0 rounded-xl border border-line px-3 text-sm text-muted hover:bg-soft"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addTip} className="mt-2 text-sm text-violet underline underline-offset-4">
                  + Добавить рекомендацию
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Чего избегать</label>
                <textarea
                  value={form.avoid}
                  onChange={(e) => setForm({ ...form, avoid: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
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
                disabled={saving}
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
