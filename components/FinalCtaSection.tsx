export default function FinalCtaSection() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="mb-3 font-display text-2xl tracking-tight text-white md:text-4xl">
        Ваши конкуренты продвигаются каждый день. А вы?
      </h2>
      <p className="mb-7 text-white/65">
        Каждый день без плана — это день, когда конкуренты уходят вперёд: собирают отзывы, занимают
        места в поиске и забирают клиентов, до которых вы ещё не добрались.
      </p>
      <a
        href="#wizard"
        className="inline-block rounded-[9px] bg-brand px-7 py-3.5 text-sm font-extrabold text-ink-900 shadow-[0_10px_25px_rgba(0,0,0,0.25)] transition-transform hover:-translate-y-0.5"
      >
        Построить план — займёт 3 минуты
      </a>
      <p className="mt-4 text-xs text-white/50">Без карты и звонка · Отменить можно в любой момент</p>
    </div>
  );
}
