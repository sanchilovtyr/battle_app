/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Оптимизатор картинок Next.js отключён осознанно: у нас только один локальный
  // логотип, оптимизация тут не даёт выигрыша, зато у Next.js были известные
  // уязвимости (DoS и RCE) именно в этом узле — проще выключить весь класс риска
  images: {
    unoptimized: true,
  },
  // Файл-подтверждение IndexNow лежит в корне сайта под именем ключа: /<ключ>.txt
  async rewrites() {
    return [{ source: "/:key([A-Za-z0-9-]{8,128}).txt", destination: "/api/indexnow-key/:key" }];
  },
  async headers() {
    return [
      {
        // Файлы шрифтов не меняются (смена версии = новое имя файла), поэтому кэшируем на год
        source: "/fonts/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
