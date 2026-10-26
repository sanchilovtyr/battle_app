"use client";

import { startTour } from "@/components/tour/Tour";

/** Кнопка «Подсказки»: открывает гид заново */
export default function TourButton({ id, className, children }: { id: string; className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => startTour(id)} className={className}>
      {children ?? "Подсказки"}
    </button>
  );
}
