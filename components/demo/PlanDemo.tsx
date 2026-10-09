"use client";

import { useState } from "react";
import PlanColumn from "@/components/PlanColumn";
import { DEMO_CHECKLIST, DEMO_PLAN } from "@/lib/demoData";
import type { ChecklistState } from "@/lib/checklist";

/** План с чек-листом: в увеличенном виде отметки можно ставить (меняются только на экране, ничего не сохраняется). */
export default function PlanDemo({ interactive = false }: { interactive?: boolean }) {
  const [checklist, setChecklist] = useState<ChecklistState>(DEMO_CHECKLIST);
  const toggle = (moduleId: string, i: number, len: number) =>
    setChecklist((c) => {
      const arr = c[moduleId] ? [...c[moduleId]] : [];
      while (arr.length < len) arr.push(false);
      arr[i] = !arr[i];
      return { ...c, [moduleId]: arr };
    });
  return (
    <div>
      <PlanColumn phase="foundation" entries={DEMO_PLAN.foundation} checklist={checklist} onToggleStep={interactive ? toggle : undefined} />
      <PlanColumn phase="traffic" entries={DEMO_PLAN.traffic} checklist={checklist} onToggleStep={interactive ? toggle : undefined} />
      <PlanColumn phase="retention" entries={DEMO_PLAN.retention} checklist={checklist} onToggleStep={interactive ? toggle : undefined} />
    </div>
  );
}
