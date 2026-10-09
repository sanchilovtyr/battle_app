"use client";

import { useEffect, useState } from "react";

interface GrowthPointRow {
  id: string;
  title: string;
  body: string;
  action: string;
  note?: string;
  isOverridden: boolean;
}

interface FormState {
  title: string;
  body: string;
  action: string;
}

const EMPTY_FORM: FormState = { title: "", body: "", action: "" };

export default function AdminGrowthPointsTab() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<GrowthPointRow[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/growth-points")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Ошибка загрузки");
        return res.json();
      })
      .then((data) => setPoints(data.points))
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoaded(true));
  };

  useEffect(load, []);

  const openEdit = (p: GrowthPointRow) => {
    setForm({ title: p.title, body: p.body, action: p.action });
    setTargetId(p.id);
  };

  const closeForm = () => setTargetId(null);

  const save = async () => {
    if (!targetId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/growth-points/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointId: targetId,
          title: form.title.trim(),
          body: form.body.trim(),
          action: form.action.trim(),
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

  const reset = async (pointId: string) => {
    await fetch(`/api/admin/growth-points/override?pointId=${encodeURIComponent(pointId)}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Точки роста считаются автоматически по чек-листу, воронке и Метрике каждого пользователя —
        здесь можно поменять заголовок, текст и следующий шаг для конкретного правила. У части
        правил текст в коде собирается из цифр самого пользователя — правка заменит его на общий
        текст без цифр (см. пометку у правила).
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>
      )}

      {!loaded && <p className="text-sm text-muted">Загрузка…</p>}

      {loaded && (
        <div className="space-y-2">
          {points.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-900">{p.title}</span>
                    {p.isOverridden && (
                      <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[11px] text-violet">
                        Изменено
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{p.body}</p>
                  {p.note && <p className="mt-1 text-xs italic text-ink-900/40">{p.note}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {p.isOverridden && (
                    <button
                      onClick={() => reset(p.id)}
                      className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                    >
                      Сбросить
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(p)}
                    className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
                  >
                    Редактировать
                  </button>
                </div>
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
            <h3 className="mb-4 font-display text-lg text-ink-900">Редактировать точку роста</h3>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Заголовок</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Текст</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  Следующий шаг <span className="font-normal">(необязательно)</span>
                </label>
                <input
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
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
