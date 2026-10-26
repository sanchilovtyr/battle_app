"use client";

import { useEffect, useMemo, useState } from "react";
import type { Risk, RiskTemplate } from "@/lib/risksCore";
import { matchNews } from "@/lib/monitorCore";
import { keywordsForRisk } from "@/lib/riskWatch";

interface Item {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  source: string;
}

const fmt = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

export default function NewsWatch({ risks, templates }: { risks: Risk[]; templates?: RiskTemplate[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/risks/news", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items?: Item[] }) => live && setItems(d.items ?? []))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    return risks
      .filter((r) => r.status !== "controlled")
      .map((r) => ({ risk: r, hits: matchNews(items, keywordsForRisk(r, templates), 3) }))
      .filter((g) => g.hits.length > 0)
      .slice(0, 8);
  }, [items, risks, templates]);

  if (failed || items === null) return null;

  return (
    <section aria-labelledby="rk-news" className="mb-6 rounded-2xl border border-line bg-white p-5">
      <h2 id="rk-news" className="font-display text-base text-ink-900">
        Новости и законы, которые могут вас коснуться
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Мы берём свежие публикации из новостных лент и показываем те, что связаны с рисками из вашего реестра (по ключевым словам). Подбор автоматический и может ошибаться: откройте источник и оцените сами.
      </p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl bg-soft p-4 text-sm text-ink-900/80">Ленты новостей пока не подключены. Здесь появятся публикации о законах, ценах и поставках, связанные с вашими рисками.</p>
      ) : groups.length === 0 ? (
        <p className="mt-3 text-sm text-ink-900/75">Пока нет публикаций, подходящих под ваши угрозы.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {groups.map(({ risk, hits }) => (
            <li key={risk.id}>
              <p className="text-sm font-medium text-ink-900">{risk.title}</p>
              <ul className="mt-1 space-y-1.5">
                {hits.map((h) => (
                  <li key={h.id} className="text-sm">
                    <a href={h.link} target="_blank" rel="noopener noreferrer nofollow" className="text-violet underline underline-offset-4 hover:text-ink-900">
                      {h.title}
                    </a>
                    <span className="ml-2 text-xs text-muted">
                      {h.source}
                      {h.source ? ", " : ""}
                      {fmt(h.publishedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
