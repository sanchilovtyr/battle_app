"use client";

import { useState } from "react";
import AnalyticsReport from "@/components/analytics/AnalyticsReport";
import AnalyticsReplays from "@/components/analytics/AnalyticsReplays";
import AnalyticsHeatmap from "@/components/analytics/AnalyticsHeatmap";
import RangePicker, { DEFAULT_RANGE, RangeValue, rangeQuery } from "@/components/analytics/RangePicker";

type View = "report" | "replays" | "clicks" | "scroll";

const VIEWS: { id: View; label: string }[] = [
  { id: "report", label: "Отчёт" },
  { id: "replays", label: "Вебвизор" },
  { id: "clicks", label: "Карта кликов" },
  { id: "scroll", label: "Карта скролла" },
];

export default function AdminAnalyticsTab() {
  const [view, setView] = useState<View>("report");
  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE);
  const query = rangeQuery(range);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-4">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === v.id ? "bg-violet text-white" : "bg-soft text-ink-900 hover:bg-line"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {(view === "report" || view === "replays") && <RangePicker value={range} onChange={setRange} />}

      {view === "report" && <AnalyticsReport query={query} />}
      {view === "replays" && <AnalyticsReplays query={query} />}
      {view === "clicks" && <AnalyticsHeatmap mode="clicks" />}
      {view === "scroll" && <AnalyticsHeatmap mode="scroll" />}
    </div>
  );
}
