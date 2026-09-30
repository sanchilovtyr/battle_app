import Link from "next/link";
import { DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";

export default function DisclaimerSection() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-5 font-display text-xl text-ink-900 md:text-2xl">
        Ограничение ответственности
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        {DISCLAIMER_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">
        Полный текст условий использования сервиса —{" "}
        <Link href="/oferta" className="text-violet underline underline-offset-4">
          договор публичной оферты
        </Link>
        , условия обработки данных —{" "}
        <Link href="/privacy" className="text-violet underline underline-offset-4">
          политика обработки персональных данных
        </Link>
        .
      </p>
    </div>
  );
}

