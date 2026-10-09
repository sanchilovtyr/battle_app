/**
 * Определение поисковых и ИИ-роботов по User-Agent. Файл без зависимостей — его
 * можно подключать и в middleware (Edge), и в серверных маршрутах, и в тестах.
 * Порядок записей важен: более конкретные идут раньше общих (YandexAdditional раньше YandexBot).
 */

export type BotKind = "search" | "ai";

export interface BotDef {
  id: string;
  label: string;
  kind: BotKind;
  /** Часть User-Agent, по которой узнаём бота (без учёта регистра) */
  match: RegExp;
  /** Что за бот и зачем нужен — для подсказки в админке */
  note: string;
  /** Токен для robots.txt (User-agent) */
  robotsToken?: string;
}

export const BOTS: BotDef[] = [
  { id: "yandex-additional", label: "Яндекс (ИИ: Алиса, YandexGPT)", kind: "ai", match: /YandexAdditional/i, robotsToken: "YandexAdditional", note: "Берёт страницы для ответов Алисы и нейропоиска Яндекса" },
  { id: "yandex", label: "Яндекс (YandexBot)", kind: "search", match: /YandexBot|YandexMobileBot|YandexWebmaster|YandexImages/i, robotsToken: "Yandex", note: "Основной поисковый робот Яндекса" },
  { id: "google", label: "Google (Googlebot)", kind: "search", match: /Googlebot|Google-InspectionTool|GoogleOther/i, robotsToken: "Googlebot", note: "Основной поисковый робот Google" },
  { id: "bing", label: "Bing (Bingbot)", kind: "search", match: /bingbot|BingPreview/i, robotsToken: "Bingbot", note: "Поиск Bing, а также часть ответов ChatGPT и Copilot" },
  { id: "gptbot", label: "OpenAI GPTBot", kind: "ai", match: /GPTBot/i, robotsToken: "GPTBot", note: "Сбор страниц для моделей OpenAI" },
  { id: "oai-search", label: "OpenAI OAI-SearchBot", kind: "ai", match: /OAI-SearchBot/i, robotsToken: "OAI-SearchBot", note: "Поиск внутри ChatGPT — именно он отвечает за показ сайта в рекомендациях" },
  { id: "chatgpt-user", label: "ChatGPT-User", kind: "ai", match: /ChatGPT-User/i, robotsToken: "ChatGPT-User", note: "Заходит, когда пользователь просит ChatGPT открыть страницу" },
  { id: "claude-search", label: "Claude-SearchBot", kind: "ai", match: /Claude-SearchBot/i, robotsToken: "Claude-SearchBot", note: "Поиск Claude" },
  { id: "claude-user", label: "Claude-User", kind: "ai", match: /Claude-User/i, robotsToken: "Claude-User", note: "Заходит, когда пользователь просит Claude открыть страницу" },
  { id: "claudebot", label: "ClaudeBot (Anthropic)", kind: "ai", match: /ClaudeBot|anthropic-ai/i, robotsToken: "ClaudeBot", note: "Сбор страниц для моделей Anthropic" },
  { id: "perplexity", label: "PerplexityBot", kind: "ai", match: /PerplexityBot|Perplexity-User/i, robotsToken: "PerplexityBot", note: "Ответы Perplexity со ссылками на источники" },
  { id: "google-ai", label: "Google-Extended / Gemini", kind: "ai", match: /Google-Extended|Google-CloudVertexBot/i, robotsToken: "Google-Extended", note: "Разрешение использовать страницы в Gemini" },
  { id: "applebot", label: "Applebot", kind: "ai", match: /Applebot/i, robotsToken: "Applebot", note: "Siri, Spotlight и Apple Intelligence" },
  { id: "meta-ai", label: "Meta AI", kind: "ai", match: /meta-externalagent|FacebookBot/i, robotsToken: "meta-externalagent", note: "Ассистент Meta AI" },
  { id: "amazonbot", label: "Amazonbot", kind: "ai", match: /Amazonbot/i, robotsToken: "Amazonbot", note: "Alexa и ИИ-сервисы Amazon" },
  { id: "ccbot", label: "CCBot (Common Crawl)", kind: "ai", match: /CCBot/i, robotsToken: "CCBot", note: "Открытый архив, на нём учатся многие модели" },
  { id: "bytespider", label: "Bytespider (ByteDance)", kind: "ai", match: /Bytespider/i, robotsToken: "Bytespider", note: "ИИ-сервисы ByteDance" },
];

export function detectBot(userAgent: string | null | undefined): BotDef | null {
  if (!userAgent) return null;
  for (const b of BOTS) if (b.match.test(userAgent)) return b;
  return null;
}

/** ИИ-боты, которым в robots.txt явно разрешён доступ к публичным страницам */
// CCBot (архив для обучения) и Bytespider (агрессивный сборщик) намеренно не добавляем в разрешённые: рекомендаций они не дают
export const AI_ROBOTS_TOKENS = BOTS.filter((b) => b.kind === "ai" && b.robotsToken && !["ccbot", "bytespider"].includes(b.id)).map((b) => b.robotsToken as string);

/** Роботы, чей визит можно проверить по обратному DNS */
export const VERIFY_SUFFIXES: Record<string, string[]> = {
  yandex: [".yandex.ru", ".yandex.net", ".yandex.com"],
  google: [".googlebot.com", ".google.com"],
  bing: [".search.msn.com"],
};

/** Роботы, о визитах которых монитор следит в первую очередь */
export const WATCHED_SEARCH = ["yandex", "google"] as const;
