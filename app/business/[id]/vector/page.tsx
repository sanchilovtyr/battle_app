"use client";

import { useBusiness } from "@/components/business/BusinessContext";
import { VectorQuiz, VectorResultCard, VectorLockedTeaser } from "@/components/VectorSection";

export default function VectorPage() {
  const { business, planMeta, saveVector } = useBusiness();
  if (!business) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink-900 md:text-3xl">Ваш вектор аудитории</h1>
      <p className="mb-6 text-sm text-muted">
        Психологический профиль клиентов бизнеса «{business.name}»: боль, мечта, тон общения и рекомендации по рекламе.
      </p>

      {!planMeta.audienceVectorAccess ? (
        <VectorLockedTeaser />
      ) : business.vectorId ? (
        <>
          <VectorResultCard vectorId={business.vectorId} />
          <p className="print:hidden mt-4 text-xs text-muted">
            Вектор определяется один раз для каждого бизнеса. Для другого бизнеса можно пройти квиз отдельно.
          </p>
        </>
      ) : (
        <div className="print:hidden">
          <VectorQuiz onComplete={saveVector} />
        </div>
      )}
    </div>
  );
}
