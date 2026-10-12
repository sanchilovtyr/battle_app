import { MetadataRoute } from "next";
import { AI_ROBOTS_TOKENS } from "@/lib/bots";

const PRIVATE = ["/admin", "/account", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      // ИИ-ассистентам явно разрешены публичные страницы и блог. Группа для конкретного бота
      // заменяет общую, поэтому закрытые разделы повторяем и здесь.
      { userAgent: AI_ROBOTS_TOKENS, allow: ["/", "/blog", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
    ],
    sitemap: "https://m-navi.ru/sitemap.xml",
  };
}
