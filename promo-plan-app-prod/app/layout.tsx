import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://m-navi.ru"),
  title: "Ключевое слово — персональный план продвижения бизнеса",
  description:
    "Пошаговый план продвижения и привлечения клиентов из интернета для малого и среднего бизнеса в России. Отвечаете на 7 вопросов о бизнесе — получаете конкретный маршрут: что делать сначала, что потом и почему.",
  keywords: [
    "маркетинговый план",
    "план продвижения бизнеса",
    "привлечение клиентов",
    "продвижение малого бизнеса",
    "маркетинг для бизнеса",
    "план рекламы",
  ],
  authors: [{ name: "ИП Санчилов Антон Михайлович" }],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Ключевое слово",
    title: "Ключевое слово — персональный план продвижения бизнеса",
    description:
      "Пошаговый план продвижения и привлечения клиентов из интернета для малого и среднего бизнеса в России.",
    url: "https://m-navi.ru",
  },
  twitter: {
    card: "summary",
    title: "Ключевое слово — персональный план продвижения бизнеса",
    description:
      "Пошаговый план продвижения и привлечения клиентов из интернета для малого и среднего бизнеса в России.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ключевое слово",
  url: "https://m-navi.ru",
  description:
    "Сервис персональных маркетинговых планов для малого и среднего бизнеса.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {/* Yandex.Metrika counter */}
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(m,e,t,r,i,k,a){
                  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                  m[i].l=1*new Date();
                  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
              })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=112483717', 'ym');

              ym(112483717, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
            `,
          }}
        />
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/112483717"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}
      </head>
      <body className="overflow-x-hidden font-body bg-paper text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
