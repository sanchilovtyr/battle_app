import { CaseStudy } from "@/lib/cases";

/** Показывает пользователю кейс агентства, релевантный его нише, прямо рядом
 *  с готовым планом — чтобы доверие подкреплялось конкретной цифрой именно из
 *  его сферы бизнеса, а не общим списком кейсов на лендинге. */
export default function NicheCaseCallout({ c }: { c: CaseStudy }) {
  return (
    <div className="print:hidden mb-8 rounded-xl border border-violet/30 bg-violet-soft p-5 md:p-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet">
        Похожий кейс нашего агентства
      </p>
      <h4 className="mb-1.5 font-display text-lg text-ink-900">{c.title}</h4>
      <p className="mb-4 text-sm text-ink-900/70">{c.problem}</p>
      <div className="flex flex-wrap gap-2.5">
        {c.metrics.map((m) => (
          <span key={m.l} className="rounded-lg bg-white px-3.5 py-2 text-xs text-ink-900">
            <b className="mr-1 text-violet">{m.v}</b>
            {m.l}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-900/50">Сработало: {c.channel}</p>
    </div>
  );
}
