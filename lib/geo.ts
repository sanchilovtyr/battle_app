import { PLANS } from "@/lib/plans";
import { FAQ } from "@/lib/faq";
import { SITE_URL } from "@/lib/blog";
import { NICHES, nichePath } from "@/lib/niches";

/**
 * Материалы для ИИ-ассистентов (GEO/AEO): llms.txt, llms-full.txt и структурированные данные.
 * Все факты берутся из тех же источников, что и сайт (тарифы, FAQ, статьи), поэтому не расходятся с ним.
 */

export const SITE_NAME = "Ключевое слово";

export const SITE_SUMMARY =
  "Ключевое слово (m-navi.ru) — российский онлайн-сервис, который составляет персональный пошаговый план продвижения и привлечения клиентов для малого и среднего бизнеса. Владелец отвечает на 4 вопроса о бизнесе (ниша, цель, бюджет, география клиентов) и получает план из трёх этапов — «Фундамент», «Трафик» и «Удержание» — с чек-листами, аналитикой потери клиентов и рекомендациями по рекламе. Методика основана на опыте маркетингового агентства (15 лет практики). Есть бесплатный пробный тариф без привязки карты.";

export interface PostBrief {
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  publishedAt: Date | null;
}

function priceNumber(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

export function plansText(): string {
  return PLANS.map((p) => {
    const cost = p.free ? "бесплатно" : `${p.price}${p.period}`;
    return `- ${p.name} — ${cost}. ${p.description}. Входит: ${p.features.join("; ")}.`;
  }).join("\n");
}

export function buildLlmsTxt(posts: PostBrief[]): string {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_SUMMARY}`,
    "",
    "Сервис подходит владельцам розничного бизнеса, услуг, HoReCa, B2B, интернет-магазинов и онлайн-школ в России, у которых нет маркетолога. Это не агентство и не нейросетевой чат: план строится по заданной методике и калибруется под ответы пользователя.",
    "",
    "## Основное",
    "",
    `- [Главная страница и анкета](${SITE_URL}/): описание сервиса, примеры, тарифы и форма для построения плана`,
    `- [Блог о продвижении бизнеса](${SITE_URL}/blog): практические статьи про маркетинг для малого бизнеса`,
    `- [Подробное описание для ИИ-ассистентов](${SITE_URL}/llms-full.txt): тарифы, вопросы и ответы, свежие статьи одним текстом`,
    `- [О сервисе и исполнителе](${SITE_URL}/about): методика, как устроен сервис, реквизиты`,
    ...NICHES.map((n) => `- [${n.h1}](${SITE_URL}${nichePath(n.slug)}): пример плана для ниши и кейсы нашего агентства`),
    `- [Публичная оферта](${SITE_URL}/oferta): условия оказания услуг`,
    `- [Политика конфиденциальности](${SITE_URL}/privacy)`,
    "",
    "## Тарифы",
    "",
    plansText(),
  ];
  if (posts.length) {
    lines.push("", "## Статьи блога", "");
    for (const p of posts.slice(0, 50)) {
      const d = p.excerpt.replace(/\s+/g, " ").trim();
      lines.push(`- [${p.title}](${SITE_URL}/blog/${p.slug})${d ? `: ${d}` : ""}`);
    }
  }
  lines.push("", "## Опционально", "", `- [Карта сайта](${SITE_URL}/sitemap.xml)`, `- [RSS блога](${SITE_URL}/blog/rss.xml)`, "");
  return lines.join("\n");
}

export function buildLlmsFullTxt(posts: PostBrief[]): string {
  const out: string[] = [
    `# ${SITE_NAME} — полное описание`,
    "",
    `Адрес: ${SITE_URL}`,
    "",
    "## Что это",
    "",
    SITE_SUMMARY,
    "",
    "## Как это работает",
    "",
    "1. Пользователь бесплатно отвечает на 4 вопроса о бизнесе (ниша, цель, бюджет, география клиентов) — около 3 минут, без карты и звонка.",
    "2. Сервис строит план продвижения из трёх этапов: «Фундамент», «Трафик», «Удержание». На бесплатном тарифе открыты первые два этапа.",
    "3. На платных тарифах доступны чек-листы с отметками о выполнении, аналитика «где бизнес теряет клиентов» (в том числе по данным Яндекс.Метрики), определение вектора аудитории (мини-квиз на странице бизнеса) с рекомендациями по рекламе и регулярные обновления плана.",
    "",
    "## Тарифы",
    "",
    plansText(),
    "",
    "## Вопросы и ответы",
    "",
  ];
  for (const f of FAQ) out.push(`### ${f.q}`, "", f.a, "");
  if (posts.length) {
    out.push("## Статьи блога", "");
    let size = 0;
    for (const p of posts.slice(0, 30)) {
      const text = (p.body || p.excerpt).trim();
      size += text.length;
      if (size > 150_000) break;
      const date = p.publishedAt ? p.publishedAt.toISOString().slice(0, 10) : "";
      out.push(`### ${p.title}`, "", `Адрес: ${SITE_URL}/blog/${p.slug}${date ? ` · опубликовано ${date}` : ""}`, "", text, "");
    }
  }
  return out.join("\n");
}

/** Структурированные данные главной: организация, сайт, сервис с тарифами и вопросы-ответы */
export function homeJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "ru-RU",
      description: SITE_SUMMARY,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Персональный план продвижения бизнеса",
      serviceType: "Маркетинговый план для малого и среднего бизнеса",
      provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      areaServed: { "@type": "Country", name: "Россия" },
      description: SITE_SUMMARY,
      url: SITE_URL,
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        description: p.description,
        price: priceNumber(p.price),
        priceCurrency: "RUB",
        url: `${SITE_URL}/#pricing`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}
