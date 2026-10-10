import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://m-navi.ru"),
  title: "Ключевое слово — персональный план продвижения бизнеса",
  description:
    "Пошаговый план продвижения и привлечения клиентов из интернета для малого и среднего бизнеса в России. Отвечаете на 4 вопроса о бизнесе — получаете конкретный маршрут: что делать сначала, что потом и почему.",
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
  // Подтверждение прав на сайт в Яндекс Вебмастере (метатег yandex-verification)
  verification: {
    yandex: "e4ab0ee262e6629c",
    // Подтверждение прав на сайт в Google Search Console
    google: "D5oDR7WNv9NNX5R7TBZA7Z2_70D2fNkKeIV2Ei7iMD8",
  },
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
  logo: "https://m-navi.ru/logo-mark.png",
  description:
    "Сервис персональных маркетинговых планов для малого и среднего бизнеса.",
  areaServed: "RU",
  knowsLanguage: "ru",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Главные шрифты (заголовки и основной текст) грузим сразу — они в первом экране. Остальные подтянутся по мере надобности */}
        {["unbounded-cyrillic", "unbounded-latin", "manrope-cyrillic", "manrope-latin"].map((f) => (
          <link key={f} rel="preload" href={`/fonts/${f}.woff2`} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
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
