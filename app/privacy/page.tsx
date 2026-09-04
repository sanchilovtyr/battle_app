import SiteHeader from "@/components/SiteHeader";
import { PRIVACY_SECTIONS } from "@/lib/privacy";
import { EXECUTOR, OFFER_PUBLISHED } from "@/lib/offer";

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <h1 className="mb-2 font-display text-2xl text-ink-900 md:text-3xl">
          Политика обработки персональных данных
        </h1>
        <p className="mb-10 text-sm text-muted">Действующая редакция опубликована {OFFER_PUBLISHED}</p>

        <div className="space-y-8">
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 font-display text-lg text-ink-900">{section.title}</h2>
              <div className="space-y-3 text-sm leading-relaxed text-muted">
                {section.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-3 font-display text-lg text-ink-900">10. Реквизиты Оператора</h2>
            <div className="rounded-2xl border border-line bg-soft p-5 text-sm text-ink-900">
              <p className="font-medium">{EXECUTOR.fullName}</p>
              <p className="mt-1 text-muted">
                {EXECUTOR.country}, г. {EXECUTOR.city}
              </p>
              <p className="mt-3 text-muted">ОГРНИП: {EXECUTOR.ogrnip}</p>
              <p className="text-muted">ИНН: {EXECUTOR.inn}</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
