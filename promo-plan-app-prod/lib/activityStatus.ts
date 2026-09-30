// Статус активности по регулярности внесения данных — не по тарифу и не по
// разовому баллу, а по тому, насколько последовательно бизнес ведут в
// сервисе. Идея — как статусы "гость / друг / лучший друг" у Дикси: чем
// регулярнее, тем выше статус и тем сильнее ощущение прогресса от подписки.

export interface ActivityStatus {
  label: string;
  icon: string;
}

const TIERS: { min: number; label: string; icon: string }[] = [
  { min: 6, label: "Ветеран учёта", icon: "🏆" },
  { min: 4, label: "Опытный", icon: "⭐" },
  { min: 2, label: "Постоянный", icon: "🔥" },
  { min: 1, label: "Новичок", icon: "🌱" },
];

export function activityStatus(streak: number): ActivityStatus | null {
  if (streak <= 0) return null;
  const tier = TIERS.find((t) => streak >= t.min) ?? TIERS[TIERS.length - 1];
  return { label: tier.label, icon: tier.icon };
}
