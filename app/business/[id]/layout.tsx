"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { BusinessProvider, useBusiness } from "@/components/business/BusinessContext";
import BusinessNav from "@/components/business/BusinessNav";

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="mb-2 font-display text-2xl text-ink-900">{title}</h1>
      <p className="mb-6 text-muted">{text}</p>
      <Link
        href="/account"
        className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800"
      >
        Личный кабинет
      </Link>
    </div>
  );
}

function Frame({ id, children }: { id: string; children: React.ReactNode }) {
  const { status, loaded, business } = useBusiness();

  let body: React.ReactNode = children;
  if (status === "loading" || !loaded) body = null;
  else if (status !== "authenticated") body = <Message title="Личный кабинет" text="Войдите, чтобы посмотреть план бизнеса." />;
  else if (!business || !business.plan)
    body = (
      <Message
        title="План не найден"
        text={
          business
            ? "Этот бизнес создан до того, как планы стали сохраняться — постройте план заново."
            : "Возможно, бизнес был удалён. Если вы только что вошли с другого устройства, подождите несколько секунд и обновите страницу."
        }
      />
    );

  const showNav = status === "authenticated" && loaded && !!business?.plan;

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        {showNav ? (
          <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 lg:py-12">
            <BusinessNav businessId={id} businessName={business?.name} />
            <div className="min-w-0 py-6 lg:py-0">{body}</div>
          </div>
        ) : (
          body
        )}
      </div>
    </main>
  );
}

export default function BusinessLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  return (
    <BusinessProvider id={params.id}>
      <Frame id={params.id}>{children}</Frame>
    </BusinessProvider>
  );
}
