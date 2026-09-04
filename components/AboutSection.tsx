const POINTS = [
  "куда двигаться бизнесу",
  "какие инструменты использовать",
  "на чём сосредоточить усилия в первую очередь",
  "как распределять бюджет и ресурсы",
  "какие действия помогут привлечь больше клиентов",
];

export default function AboutSection() {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-900/15 px-3 py-1.5 text-xs font-bold text-ink-900/70 before:h-[7px] before:w-[7px] before:rounded-full before:bg-violet">
          15+ лет практики в маркетинге
        </span>
        <h2 className="my-5 font-display text-2xl leading-tight tracking-tight text-ink-900 md:text-3xl">
          Маркетинговый план, который превращает идеи в понятную стратегию роста
        </h2>
        <div className="space-y-4 text-[15px] leading-relaxed text-muted md:text-base">
          <p>
            За 15+ лет практической работы в маркетинге мы увидели одну закономерность:
            большинство владельцев малого и среднего бизнеса знают, что им нужно развивать
            рекламу и продажи, но часто сталкиваются с хаосом — десятки задач, разрозненные
            каналы продвижения, непонятные приоритеты и отсутствие чёткого плана действий.
          </p>
          <p>
            Именно поэтому мы создали этот сервис — универсального помощника по составлению
            маркетингового плана.
          </p>
          <p>
            Он поможет вам системно разобрать все ключевые этапы продвижения бизнеса: от
            анализа текущей ситуации и определения целей до выбора эффективных каналов
            рекламы, планирования активностей и оценки результатов.
          </p>
          <p>
            Сервис создан на основе реального опыта маркетинговой работы с проектами из разных
            сфер и учитывает практические задачи предпринимателей. Неважно, запускаете ли вы
            новый бизнес, хотите увеличить продажи или привести в порядок уже существующее
            продвижение — маркетинговый план поможет собрать все элементы в единую систему.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-line bg-white p-6 md:p-7">
          <p className="mb-4 font-display text-base text-ink-900">
            Вместо бесконечного списка задач вы получите структурированную схему работы, где
            понятно:
          </p>
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm text-ink-900/85 md:text-base">
                <span className="mt-0.5 shrink-0 text-violet">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-ink-900 p-6 md:p-7">
          <p className="font-display text-lg leading-snug text-white md:text-xl">
            Превратите маркетинг из хаотичного набора действий в понятный маршрут к росту
            бизнеса.
          </p>
        </div>
      </div>
    </div>
  );
}
