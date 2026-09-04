const STEPS = [
  {
    n: "01",
    kicker: "Шаг 1 · 2 минуты",
    title: "Расскажите о бизнесе",
    text: "Сфера, город, бюджет — простыми словами, без брифов.",
  },
  {
    n: "02",
    kicker: "Шаг 2 · 1 минута",
    title: "Ответьте на вопросы",
    text: "Есть ли сайт и соцсети, какая цель и опыт в продвижении.",
  },
  {
    n: "03",
    kicker: "Шаг 3 · 30 секунд",
    title: "Получите план",
    text: "Наш сервис соберёт маршрут из проверенных модулей под вас.",
  },
];

export default function JourneySection() {
  return (
    <div className="relative grid gap-3 md:grid-cols-[repeat(3,1fr)_1.15fr] md:items-stretch">
      <div className="absolute left-[9%] right-[9%] top-[47px] hidden h-[2px] bg-gradient-to-r from-line via-line to-brand md:block" />

      {STEPS.map((s, i) => (
        <article
          key={s.n}
          className="relative z-10 rounded-2xl border border-line bg-white p-5 pt-4.5 md:p-6"
        >
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wide text-muted">
            <span>{s.kicker}</span>
          </div>
          <div
            className={`my-3.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${
              i === 0
                ? "bg-ink-900 text-brand"
                : i === 1
                ? "bg-violet text-white"
                : "bg-violet-soft text-violet"
            }`}
          >
            {s.n}
          </div>
          <h3 className="mb-1.5 text-lg font-extrabold tracking-tight text-ink-900">{s.title}</h3>
          <p className="text-sm text-muted">{s.text}</p>
        </article>
      ))}

      <article className="relative z-10 flex min-h-[215px] flex-col justify-between rounded-2xl border border-ink-900 bg-ink-900 p-6 text-white">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-brand">
            Ваш результат
          </div>
          <h3 className="my-3 text-xl font-extrabold leading-tight tracking-tight">
            Готовый маршрут привлечения клиентов
          </h3>
          <p className="text-[13px] text-white/60">
            Снимаем рутину планирования — вам остаётся выбрать и запустить первые шаги.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {[
            { v: "3–5", l: "каналов" },
            { v: "11", l: "модулей" },
            { v: "1", l: "план" },
          ].map((s) => (
            <span key={s.l} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] text-white/80">
              <b className="block text-base text-brand">{s.v}</b>
              {s.l}
            </span>
          ))}
        </div>
      </article>
    </div>
  );
}
