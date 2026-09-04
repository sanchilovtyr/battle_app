const CHANNELS = [
  { name: "Яндекс Карты", tag: "Запустить первым", priority: true },
  { name: "Яндекс Директ", tag: "Поиск рядом", priority: false },
  { name: "VK Реклама", tag: "Гео-таргетинг", priority: false },
  { name: "Telegram", tag: "Тест №2", priority: false },
];

export default function HeroPreviewCard() {
  return (
    <div className="relative rotate-[1.5deg] rounded-[20px] border border-white/15 bg-white p-5 text-ink-900 shadow-[0_35px_70px_rgba(5,6,19,0.45)]">
      <div className="pointer-events-none absolute -inset-x-3 -inset-y-3 -z-10 rounded-[24px] border border-white/15" />

      <div className="flex items-center justify-between border-b border-line pb-3.5 text-[13px]">
        <b>Ваш план продвижения</b>
        <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-extrabold text-ink-900">
          Готов
        </span>
      </div>

      <div className="mt-4 text-lg font-extrabold">Кофейня «Полдень»</div>
      <div className="text-[13px] text-muted">Казань · у метро · средний чек 480 ₽</div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {CHANNELS.map((c) => (
          <div
            key={c.name}
            className={`rounded-xl border p-3 ${
              c.priority ? "border-violet-soft bg-violet-soft" : "border-transparent bg-soft"
            }`}
          >
            <strong className="block text-sm">{c.name}</strong>
            <span className="mt-1 inline-block rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-900/70">
              {c.tag}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span>Готовность к запуску</span>
        <b>78%</b>
      </div>
      <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet to-[#9A81FF]"
          style={{ width: "78%" }}
        />
      </div>
    </div>
  );
}
