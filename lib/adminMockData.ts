import { PlanId } from "./plans";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  planId: PlanId;
  status: "active" | "cancelled";
  registeredAt: string; // ISO
  downloadedFiles: string[]; // названия скачанных PDF-планов
}

/**
 * ВАЖНО: это демонстрационные данные, а не реальные пользователи.
 * В текущей архитектуре (без бэкенда) данные каждого посетителя живут только
 * в его собственном браузере — у админа физически нет доступа к чужим данным.
 * Список ниже показывает, как будет выглядеть эта вкладка после подключения
 * базы данных на сервере (см. README).
 */
export const MOCK_USERS: MockUser[] = [
  {
    id: "u1",
    email: "anna.retail@example.com",
    name: "Анна Соколова",
    phone: "+7 900 111-22-33",
    planId: "business",
    status: "active",
    registeredAt: "2026-06-02T10:00:00.000Z",
    downloadedFiles: ["План — Цветочный магазин.pdf", "План — Шоурум одежды.pdf"],
  },
  {
    id: "u2",
    email: "dmitry.horeca@example.com",
    name: "Дмитрий Волков",
    phone: "+7 900 222-33-44",
    planId: "start",
    status: "active",
    registeredAt: "2026-07-14T10:00:00.000Z",
    downloadedFiles: ["План — Кофейня на Ленина.pdf"],
  },
  {
    id: "u3",
    email: "irina.beauty@example.com",
    name: "Ирина Петрова",
    phone: "+7 900 333-44-55",
    planId: "trial",
    status: "active",
    registeredAt: "2026-08-20T10:00:00.000Z",
    downloadedFiles: [],
  },
  {
    id: "u4",
    email: "sergey.b2b@example.com",
    name: "Сергей Кузнецов",
    phone: "+7 900 444-55-66",
    planId: "agency",
    status: "active",
    registeredAt: "2026-05-11T10:00:00.000Z",
    downloadedFiles: [
      "План — IT-аутсорс.pdf",
      "План — Клининг для офисов.pdf",
      "План — Юридические услуги.pdf",
    ],
  },
  {
    id: "u5",
    email: "olga.shop@example.com",
    name: "Ольга Смирнова",
    phone: "+7 900 555-66-77",
    planId: "business",
    status: "cancelled",
    registeredAt: "2026-04-28T10:00:00.000Z",
    downloadedFiles: ["План — Магазин украшений.pdf"],
  },
  {
    id: "u6",
    email: "pavel.school@example.com",
    name: "Павел Егоров",
    phone: "+7 900 666-77-88",
    planId: "start",
    status: "active",
    registeredAt: "2026-07-30T10:00:00.000Z",
    downloadedFiles: [],
  },
  {
    id: "u7",
    email: "maria.fitness@example.com",
    name: "Мария Новикова",
    phone: "+7 900 777-88-99",
    planId: "trial",
    status: "active",
    registeredAt: "2026-08-25T10:00:00.000Z",
    downloadedFiles: [],
  },
  {
    id: "u8",
    email: "alexey.auto@example.com",
    name: "Алексей Морозов",
    phone: "+7 900 888-99-00",
    planId: "agency",
    status: "active",
    registeredAt: "2026-03-15T10:00:00.000Z",
    downloadedFiles: ["План — Автосервис.pdf", "План — Шиномонтаж.pdf"],
  },
  {
    id: "u9",
    email: "ekaterina.cafe@example.com",
    name: "Екатерина Белова",
    phone: "+7 900 999-00-11",
    planId: "business",
    status: "active",
    registeredAt: "2026-06-19T10:00:00.000Z",
    downloadedFiles: ["План — Пекарня.pdf"],
  },
];
