const STOPS = [
  {
    phase: "Фундамент",
    item: "Сайт с чётким предложением",
  },
  {
    phase: "Трафик",
    item: "Карты + отзывы, затем реклама",
  },
  {
    phase: "Удержание",
    item: "Рассылки для повторных продаж",
  },
];

export default function HeroPreviewCard() {
  return (
    <a
      href="#pricing"
      className="group relative block rotate-[1.5deg] rounded-[20px] border border-white/15 bg-white p-6 text-ink-900 shadow-[0_35px_70px_rgba(5,6,19,0.45)] transition-transform hover:-translate-y-1 hover:rotate-0"
    >
      <div className="pointer-events-none absolute -inset-x-3 -inset-y-3 -z-10 rounded-[24px] border border-white/15" />

      <div className="flex items-center justify-between border-b border-line pb-3.5 text-[13px]">
        <b>Маршрут для «Кофейня «Полдень»»</b>
      </div>
      <p className="mt-2 text-[13px] text-muted">Казань · у метро · средний чек 480 ₽</p>

      <div className="relative mt-5 pl-[7px]">
        <div className="absolute bottom-3 left-[7px] top-3 w-px border-l-2 border-dashed border-line" />
        {STOPS.map((s, i) => (
          <div key={s.phase} className="relative mb-5 flex gap-4 pl-6 last:mb-0">
            <span
              className={`absolute left-0 top-0.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 ${
                i === 0
                  ? "border-violet bg-violet"
                  : i === 1
                  ? "border-violet bg-white"
                  : "border-line bg-white"
              }`}
            />
            <div>
              <div className="text-[13px] font-extrabold text-ink-900">{s.phase}</div>
              <div className="text-[13px] text-muted">{s.item}</div>
            </div>
          </div>
        ))}
        <div className="relative flex items-center gap-4 pl-6">
          <span className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
          <div className="text-[13px] font-extrabold text-ink-900">Больше клиентов</div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-1.5 border-t border-line pt-3.5 text-[13px] font-bold text-violet">
        Посмотреть тарифы
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </a>
  );
}
