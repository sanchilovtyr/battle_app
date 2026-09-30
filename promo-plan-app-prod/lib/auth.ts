import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import YandexProvider from "next-auth/providers/yandex";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { checkRateLimit } from "./rateLimit";

// Вход через Яндекс ID — опциональный провайдер: если переменные окружения
// не заданы (например, в локальной разработке), просто не подключаем его,
// а не падаем при старте. Кнопка "Войти через Яндекс" на сайте сама не
// показывается, пока провайдер не настроен (см. AuthGate в PlanBuilder).
const yandexProvider =
  process.env.YANDEX_ID_CLIENT_ID && process.env.YANDEX_ID_CLIENT_SECRET
    ? [
        YandexProvider({
          clientId: process.env.YANDEX_ID_CLIENT_ID,
          clientSecret: process.env.YANDEX_ID_CLIENT_SECRET,
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Лимит привязан к email, а не к IP — защищает конкретный аккаунт от
        // перебора пароля, даже если атакующий меняет IP-адреса
        if (!checkRateLimit(`login:${email}`, 10, 15 * 60 * 1000)) {
          throw new Error("Слишком много попыток входа. Попробуйте позже.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        if (!user.passwordHash) {
          throw new Error(
            "Этот аккаунт создан через вход по Яндекс ID. Войдите через кнопку «Войти через Яндекс» или задайте пароль через «Забыли пароль»."
          );
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name || user.email };
      },
    }),
    ...yandexProvider,
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Для OAuth (Яндекс ID) своей таблицы аккаунтов нет — сессия работает
      // на JWT, поэтому пользователя в нашей БД находим/создаём здесь сами,
      // по email из профиля Яндекса, и дальше передаём его id в jwt-колбэк.
      if (account?.provider === "yandex") {
        if (!user.email) return false;
        const email = user.email.trim().toLowerCase();

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          user.id = existing.id;
        } else {
          const created = await prisma.user.create({
            data: { email, passwordHash: null, name: user.name || "" },
          });
          user.id = created.id;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    // своих отдельных страниц входа не делаем — форма встроена прямо в анкету и в ЛК
    error: "/",
  },
};
