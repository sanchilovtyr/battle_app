"use client";

import { useState } from "react";
import { FAQ } from "@/lib/faq";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {FAQ.map((item, i) => {
          const open = openIndex === i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
              >
                <span className="font-medium text-ink-900">{item.q}</span>
                <span
                  className={`shrink-0 text-xl text-violet transition-transform ${open ? "rotate-45" : ""}`}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {open && <p className="px-5 pb-5 text-sm leading-relaxed text-muted md:px-6 md:pb-6">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
