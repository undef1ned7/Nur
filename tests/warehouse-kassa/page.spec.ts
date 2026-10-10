/**
 * E2E: касса склада.
 *
 *   /crm/warehouse/kassa       список касс (CashRegisterList): вкладки «Кассы / Запросы / Инкассация
 *                              партнёров / Настройки», поиск, итоги по кассам, «Создать кассу»
 *                              (POST warehouse/cash-registers/), подтверждение/отклонение запросов
 *                              кассы, переключатель «Требовать подтверждение», инкассация между
 *                              компаниями-партнёрами;
 *   /crm/warehouse/kassa/:id   карточка кассы (CashRegisterDetail): баланс/приход/расход, журнал
 *                              денежных документов с вкладками «Все / Расход / Приход», шесть
 *                              фильтров, серверная пагинация по 100, модалки «Приход в кассу» и
 *                              «Расход из кассы» (POST warehouse/money/documents/ → /post/).
 *
 * Как пункты общего чек-листа легли на эти страницы:
 *   «форма + отправка»   → создание кассы, приход/расход, инкассация, настройка подтверждения;
 *   «расчёты»            → остаток = приход − расход, «Баланс · Приход · Расход» в шапке карточки
 *                          после проведения документа, «Записи X–Y из N», «Страница X из Y»;
 *   «POST/PUT 500»       → 500 на создании кассы, прихода/расхода, подтверждении запроса, инкассации;
 *   «GET → null»         → null вместо списка касс, журнала, справочников, запросов, настроек;
 *   «тройной клик»       → «Сохранить» (касса) и «Создать приход/расход».
 *
 * Чего на этих страницах НЕТ (поэтому в наборе этого нет): редактирования и удаления кассы,
 * закрытия смены, внесения/изъятия, тостов. Модалки здесь самописные: без role="dialog", без <form>,
 * подписи не связаны с полями — поля ищем по секции с подписью. Оповещения и подтверждения —
 * общие React-модалки (role="dialog", кнопки «Ок» / «Отменить» / «Подтвердить»).
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** + routeWebSocket): по умолчанию фронт ходит на
 * боевой https://app.nurcrm.kg/api, и тесты не должны ни читать, ни менять продовые данные.
 * Мок хранит состояние: созданная касса появляется в списке, проведённый приход меняет баланс,
 * подтверждённый запрос исчезает из очереди.
 *
 * Тесты с комментарием «Регрессия (исправлено)» поймали дефекты при первом прогоне (08.10.2026);
 * дефекты исправлены, тесты охраняют, чтобы они не вернулись.
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer в playwright.config.js):
 *   npx playwright test tests/warehouse-kassa --project=chromium
 * Замеры раздела 5 честнее в одиночку:
 *   npx playwright test tests/warehouse-kassa -g "5. Стресс" --workers=1
 */
import {
  test as base,
  expect as baseExpect,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

// 10 с вместо 5: при полном прогоне в трёх браузерах рядом идут стресс-тесты раздела 5.
const expect = baseExpect.configure({ timeout: 10_000 });

// Первая загрузка страницы с dev-сервера Vite под параллельной нагрузкой бывает долгой.
base.describe.configure({ timeout: 60_000 });

/* ======================================================================
   Тестовые данные
   ====================================================================== */

const REGISTER_ID = "b06608a6-ed5c-44ed-8f8e-0cd924af1305";
const URLS = {
  list: "/crm/warehouse/kassa",
  detail: `/crm/warehouse/kassa/${REGISTER_ID}`,
};

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим исходники Vite
// вроде http://localhost:3100/src/api/warehouse.js.
const apiPath = (path: string): RegExp =>
  new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

const API_ANY = /^https?:\/\/[^/]+\/api\//;
const ENDPOINTS = {
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  settings: apiPath("warehouse/cash/confirmation-settings/"),
  cashRequests: apiPath("warehouse/cash/requests/"),
  requestApprove: apiPath("warehouse/cash/requests/[^/?]+/approve/"),
  requestReject: apiPath("warehouse/cash/requests/[^/?]+/reject/"),
  registers: apiPath("warehouse/cash-registers/"),
  registerOperations: apiPath("warehouse/cash-registers/[^/?]+/operations/"),
  counterparties: apiPath("warehouse/crud/counterparties/"),
  categories: apiPath("warehouse/money/categories/"),
  agents: apiPath("warehouse/agents/company-requests/"),
  moneyDocuments: apiPath("warehouse/money/documents/"),
  moneyDocumentPost: apiPath("warehouse/money/documents/[^/?]+/post/"),
  partners: apiPath("warehouse/stock-partnerships/active/"),
  partnerCatalog: apiPath("warehouse/stock-partnerships/companies/[^/?]+/warehouses/"),
  incassations: apiPath("warehouse/stock-partnerships/cash-incassations/"),
} as const;
type Endpoint = keyof typeof ENDPOINTS;

const futureDate = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const PROFILE = {
  id: "e2e-owner",
  user_id: "e2e-owner",
  email: "owner@e2e.test",
  first_name: "E2E",
  last_name: "Owner",
  role: "owner",
};
const COMPANY = {
  id: "e2e-company",
  name: "E2E Company",
  end_date: futureDate(),
  sector: { id: "s-wh", name: "Склад" },
  industry: { id: "i-wh", name: "Склад" },
  subscription_plan: { id: "p-pro", name: "Про" },
};

interface Register {
  id: string;
  name: string;
  location?: string;
  balance?: string | number | null;
  company?: string;
  is_partner?: boolean;
  receipts_total?: string | number | null;
  expenses_total?: string | number | null;
}
interface MoneyDoc {
  id: string;
  cash_register: string;
  doc_type: "MONEY_RECEIPT" | "MONEY_EXPENSE";
  number: string | null;
  date: string;
  counterparty?: string | null;
  counterparty_display_name?: string | null;
  payment_category?: string;
  payment_category_title?: string | null;
  payment_method?: string | null;
  amount: string | number;
  status: string;
  /** Документ создан через POST и проведён — участвует в пересчёте баланса. */
  applied?: boolean;
}
interface CashRequest {
  id: string;
  amount: string;
  document: Record<string, unknown>;
}
interface Totals {
  receipts: number;
  expenses: number;
}
interface Db {
  registers: Register[];
  totals: Record<string, Totals>;
  docs: MoneyDoc[];
  requests: CashRequest[];
  settingsEnabled: boolean;
  incassations: Record<string, unknown>[];
}

const OWN_REGISTER: Register = {
  id: REGISTER_ID,
  name: "Основная касса",
  location: "Точка №1",
  balance: "15000.50",
  company: "e2e-company",
};
const PARTNER_REGISTER: Register = {
  id: "cr-partner",
  name: "Касса партнёра",
  location: "Ош",
  balance: "3000",
  is_partner: true,
  company: "partner-co",
};

const CATEGORIES = [
  { id: "mc-1", title: "Оплата от клиента" },
  { id: "mc-2", title: "Аренда" },
];
const COUNTERPARTIES = [
  { id: "cp-1", name: "ОсОО Клиент" },
  { id: "cp-2", name: "ИП Поставщик" },
];
const AGENTS = [{ id: "ar-1", status: "active", user: "emp-1", user_display: "Агентов Айбек" }];

const makeDoc = (i: number, overrides: Partial<MoneyDoc> = {}): MoneyDoc => ({
  id: `md-${i}`,
  cash_register: REGISTER_ID,
  doc_type: i % 2 ? "MONEY_RECEIPT" : "MONEY_EXPENSE",
  number: `${i % 2 ? "ПКО" : "РКО"}-${i}`,
  date: "2026-10-01T10:30:00+06:00",
  counterparty: i % 2 ? "cp-1" : "cp-2",
  counterparty_display_name: i % 2 ? "ОсОО Клиент" : "ИП Поставщик",
  payment_category: i % 2 ? "mc-1" : "mc-2",
  payment_category_title: i % 2 ? "Оплата от клиента" : "Аренда",
  payment_method: i % 2 ? "cash" : "cashless",
  amount: String(1000 + i),
  status: "POSTED",
  ...overrides,
});
const makeDocs = (n: number, overrides?: Partial<MoneyDoc>): MoneyDoc[] =>
  Array.from({ length: n }, (_, i) => makeDoc(i + 1, overrides));

const defaultDocs = (): MoneyDoc[] => [
  makeDoc(1, { amount: "1000" }), // приход, наличные, проведён
  makeDoc(2, { amount: "400" }), // расход, безнал, проведён
  makeDoc(3, { amount: "250", status: "DRAFT" }), // приход, черновик
];

const defaultRequests = (): CashRequest[] => [
  {
    id: "rq-1",
    amount: "2500",
    document: {
      number: "ПР-00001",
      doc_type: "SALE",
      date: "2026-10-01T10:00:00+06:00",
      counterparty_display_name: "ОсОО Клиент",
    },
  },
  {
    id: "rq-2",
    amount: "700",
    document: {
      number: "ПР-00002",
      doc_type: "SALE",
      date: "2026-10-02T11:00:00+06:00",
      counterparty_display_name: "ИП Поставщик",
    },
  },
];

const paginated = <T,>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

/* ======================================================================
   Мок бэкенда (с состоянием)
   ====================================================================== */

interface Call {
  method: string;
  url: URL;
  body: any;
}
type Handler = (route: Route, call: Call, db: Db) => unknown;
interface Api {
  db: Db;
  on(name: Endpoint, handler: Handler): void;
  calls(name: Endpoint, method?: string): Call[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const bodyOf = (request: { postDataJSON(): unknown; postData(): string | null }) => {
  try {
    return request.postDataJSON();
  } catch {
    return request.postData();
  }
};
const lastSegment = (url: URL, fromEnd = 1): string =>
  url.pathname.split("/").filter(Boolean).at(-fromEnd) ?? "";

/** Итоги кассы: базовые + проведённые документы, созданные в тесте. */
const registerTotals = (db: Db, id: string) => {
  const reg = db.registers.find((r) => r.id === id);
  const base = db.totals[id] ?? { receipts: 0, expenses: 0 };
  let receipts = base.receipts;
  let expenses = base.expenses;
  for (const d of db.docs) {
    if (d.cash_register !== id || !d.applied) continue;
    if (d.doc_type === "MONEY_RECEIPT") receipts += Number(d.amount);
    else expenses += Number(d.amount);
  }
  const startBalance = Number(reg?.balance ?? base.receipts - base.expenses);
  return {
    name: reg?.name ?? "Касса",
    receipts_total: receipts.toFixed(2),
    expenses_total: expenses.toFixed(2),
    balance: (startBalance + (receipts - base.receipts) - (expenses - base.expenses)).toFixed(2),
  };
};

async function mockBackend(page: Page): Promise<Api> {
  const db: Db = {
    registers: [{ ...OWN_REGISTER }, { ...PARTNER_REGISTER }],
    totals: {
      [REGISTER_ID]: { receipts: 20000, expenses: 4999.5 },
      "cr-partner": { receipts: 5000, expenses: 2000 },
    },
    docs: defaultDocs(),
    requests: defaultRequests(),
    settingsEnabled: true,
    incassations: [],
  };
  const log = {} as Record<Endpoint, Call[]>;
  let seq = 0;

  const handlers: Record<Endpoint, Handler> = {
    profile: (route) => json(route, PROFILE),
    company: (route) => json(route, COMPANY),
    settings: (route, { method, body }, state) => {
      if (method === "PATCH") {
        state.settingsEnabled = Boolean(body?.enabled);
        return json(route, { enabled: state.settingsEnabled });
      }
      return json(route, { enabled: state.settingsEnabled });
    },
    cashRequests: (route, { url }, state) => {
      if (url.searchParams.get("page_size") === "1") {
        return json(route, {
          count: state.requests.length,
          next: null,
          previous: null,
          results: state.requests.slice(0, 1),
        });
      }
      return json(route, paginated(state.requests));
    },
    requestApprove: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      state.requests = state.requests.filter((r) => r.id !== id);
      return json(route, { id, status: "APPROVED" });
    },
    requestReject: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      state.requests = state.requests.filter((r) => r.id !== id);
      return json(route, { id, status: "REJECTED" });
    },
    registers: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: Register = {
          id: `cr-new-${seq}`,
          name: body?.name,
          location: body?.location,
          balance: "0",
          company: "e2e-company",
        };
        state.registers.push(created);
        return json(route, created, 201);
      }
      // Без include_partners бэкенд отдаёт только собственные кассы компании.
      const withPartners = url.searchParams.get("include_partners") === "1";
      const list = withPartners ? state.registers : state.registers.filter((r) => !r.is_partner);
      return json(route, paginated(list));
    },
    registerOperations: (route, { url }, state) =>
      json(route, registerTotals(state, lastSegment(url, 2))),
    counterparties: (route) => json(route, paginated(COUNTERPARTIES)),
    categories: (route) => json(route, paginated(CATEGORIES)),
    agents: (route) => json(route, paginated(AGENTS)),
    moneyDocuments: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: MoneyDoc = {
          id: `md-new-${seq}`,
          cash_register: body.cash_register,
          doc_type: body.doc_type,
          number: `НОВ-${seq}`,
          date: new Date().toISOString(),
          counterparty: body.counterparty,
          counterparty_display_name:
            COUNTERPARTIES.find((c) => c.id === body.counterparty)?.name ?? null,
          payment_category: body.payment_category,
          payment_category_title:
            CATEGORIES.find((c) => c.id === body.payment_category)?.title ?? null,
          payment_method: "cash",
          amount: body.amount,
          status: "DRAFT",
        };
        state.docs.unshift(created);
        return json(route, created, 201);
      }
      const q = url.searchParams;
      const page = Number(q.get("page") ?? 1);
      const size = Number(q.get("page_size") ?? 100);
      let list = state.docs.filter((d) => d.cash_register === q.get("cash_register"));
      if (q.get("doc_type")) list = list.filter((d) => d.doc_type === q.get("doc_type"));
      if (q.get("counterparty")) list = list.filter((d) => d.counterparty === q.get("counterparty"));
      if (q.get("payment_category"))
        list = list.filter((d) => d.payment_category === q.get("payment_category"));
      if (q.get("payment_method"))
        list = list.filter((d) => d.payment_method === q.get("payment_method"));
      if (q.get("date_from")) list = list.filter((d) => d.date.slice(0, 10) >= q.get("date_from")!);
      if (q.get("date_to")) list = list.filter((d) => d.date.slice(0, 10) <= q.get("date_to")!);
      return json(route, {
        count: list.length,
        next: page * size < list.length ? "next" : null,
        previous: page > 1 ? "prev" : null,
        results: list.slice((page - 1) * size, page * size),
      });
    },
    moneyDocumentPost: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      const doc = state.docs.find((d) => d.id === id);
      if (doc) {
        doc.status = "POSTED";
        doc.applied = true;
      }
      return json(route, { id, status: "POSTED" });
    },
    partners: (route) => json(route, { partners: [{ id: "pc-1", name: "ОсОО Партнёр" }] }),
    partnerCatalog: (route) =>
      json(route, {
        partner_company: { name: "ОсОО Партнёр" },
        partnership: { partner_allows_direct_pull: false },
        cash_registers: [
          {
            id: "pr-1",
            name: "Касса ОсОО Партнёр",
            location: "Бишкек",
            branch_name: "Главный филиал",
            balance: "1000.00",
          },
        ],
      }),
    incassations: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const row = { id: `inc-${seq}`, created_at: new Date().toISOString(), ...body };
        state.incassations.unshift(row);
        return json(route, row, 201);
      }
      return json(route, paginated(state.incassations));
    },
  };

  // Токены — до загрузки приложения, иначе AuthGuard уведёт на /login.
  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "e2e-access-token");
    localStorage.setItem("refreshToken", "e2e-refresh-token");
  });
  // WebSocket уведомлений: не подключаемся к боевому серверу.
  await page.routeWebSocket(/.*/, () => {});
  // Всё, что не замокано явно, — пустая пагинированная выдача.
  await page.route(API_ANY, (route) => json(route, paginated([])));

  for (const name of Object.keys(ENDPOINTS) as Endpoint[]) {
    log[name] = [];
    await page.route(ENDPOINTS[name], async (route) => {
      const request = route.request();
      const call: Call = {
        method: request.method(),
        url: new URL(request.url()),
        body: bodyOf(request),
      };
      // CORS preflight к боевому домену — просто разрешаем.
      if (call.method === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      }
      log[name].push(call);
      return handlers[name](route, call, db);
    });
  }

  return {
    db,
    on: (name, handler) => {
      handlers[name] = handler;
    },
    calls: (name, method) => log[name].filter((c) => !method || c.method === method),
  };
}

/**
 * Фикстуры:
 *  - `api`        — замоканный бэкенд (auto: поднимается в КАЖДОМ тесте);
 *  - `pageErrors` — необработанные исключения: любой крэш React (белый экран) валит тест
 *                   в teardown, даже если сам тест его не заметил.
 */
const test = base.extend<{ api: Api; pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "необработанные исключения на странице").toEqual([]);
    },
    { auto: true },
  ],
  api: [
    async ({ page }, use) => {
      await use(await mockBackend(page));
    },
    { auto: true },
  ],
});

/**
 * Санити-проверка: по baseURL отвечает именно NUR CRM, а не чужой dev-сервер
 * (например nurcrm-market) — иначе все тесты упали бы с непонятными таймаутами.
 */
test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get("/").catch((e: Error) => {
    throw new Error(`Фронт не отвечает по ${baseURL}: ${e.message}`);
  });
  expect(
    await res.text(),
    `По ${baseURL} отвечает не NUR CRM (ожидался <title>NurCrm</title>). ` +
      "Проверьте, не занят ли порт другим проектом, или задайте E2E_BASE_URL.",
  ).toContain("<title>NurCrm</title>");
});

/* ======================================================================
   Хелперы для UI
   ====================================================================== */

// Запас на холодную компиляцию ленивых чанков Vite при первом заходе.
const FIRST_RENDER = { timeout: 20_000 };

/**
 * Бюджет времени с поправкой на параллельный прогон: когда несколько воркеров гоняют три
 * браузера, CPU делится, и абсолютные замеры раздуваются. Строгий замер — с --workers=1.
 */
const perfBudget = (ms: number): number =>
  test.info().config.workers > 1 ? ms * 3 : ms;

const SEP = "[\\s\\u00a0\\u202f]";

/**
 * Регулярка для суммы в формате formatSom: «1 050,5 сом» (0–2 знака). Разделитель тысяч в разных
 * браузерах — пробел, NBSP или узкий NBSP, а четырёхзначные числа иногда не группируются вовсе,
 * поэтому разделитель необязателен.
 */
function somRe(n: number): RegExp {
  const [int, frac] = String(Number(Math.abs(n).toFixed(2))).split(".");
  let out = "";
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % 3 === 0) out += `${SEP}?`;
    out += int[i];
  }
  if (frac) out += `,${frac}`;
  // textContent строки склеивает ячейки без разделителей («Точка №1» + «20 000 сом» →
  // «№120 000 сом»), поэтому защиты от лишней цифры слева нет.
  return new RegExp(`${out}${SEP}*сом`);
}

async function expectNoRenderGarbage(page: Page): Promise<void> {
  const text = await page.locator("#root").innerText();
  expect(text).not.toMatch(/\bNaN\b/);
  expect(text).not.toMatch(/\bundefined\b/);
  expect(text).not.toContain("[object Object]");
}

async function expectNoPageHScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

/** React-модалка оповещения (GlobalAlertModal) с нужным текстом. */
const appDialog = (page: Page, text: string | RegExp) =>
  page.getByRole("dialog").filter({ hasText: text });

async function closeAlert(page: Page, text: string | RegExp): Promise<void> {
  const dlg = appDialog(page, text);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Ок" }).click();
  await expect(dlg).toBeHidden();
}

const rowWith = (page: Page, text: string | RegExp) =>
  page.getByRole("row").filter({ hasText: text });

/**
 * Самописная модалка кассы: без role="dialog" и без <form>. Находим карточку как самый вложенный
 * блок, в котором есть заголовок h3 с нужным названием и кнопка «Отмена».
 */
const modalByTitle = (page: Page, title: string) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("heading", { level: 3, name: title, exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Отмена" }) })
    .last();

/** Поле модалки: подписи не связаны с инпутами — берём контрол из секции с этой подписью. */
const field = (modal: Locator, page: Page, label: string) =>
  modal
    .locator("div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .last()
    .locator("select, input")
    .first();

/** Выбрать option по тексту (у option с остатком в названии точный label неизвестен). */
async function selectByText(select: Locator, text: string | RegExp): Promise<void> {
  const value = await select.locator("option").filter({ hasText: text }).first().getAttribute("value");
  expect(value, `option «${String(text)}» не найден`).not.toBeNull();
  await select.selectOption(value!);
}

/* ---------- Список ---------- */

const listHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Касса" });
const headerTab = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name });
const searchInput = (page: Page) =>
  page.getByPlaceholder("Поиск по названию или расположению…");
const createRegisterButton = (page: Page) => page.getByRole("button", { name: "Создать кассу" });

async function openList(page: Page): Promise<void> {
  await page.goto(URLS.list);
  await expect(listHeading(page)).toBeVisible(FIRST_RENDER);
}

const registerFields = (page: Page) => {
  const modal = modalByTitle(page, "Создать кассу");
  return {
    modal,
    name: modal.getByPlaceholder("Например: Основная касса"),
    location: modal.getByPlaceholder("Например: Точка продаж №1"),
    save: modal.getByRole("button", { name: "Сохранить" }),
    cancel: modal.getByRole("button", { name: "Отмена" }),
    close: modal.getByRole("button", { name: "Закрыть" }),
  };
};

/** Список без собственной кассы: «Создать кассу» доступна. */
async function openEmptyList(page: Page, api: Api) {
  api.db.registers = [];
  await openList(page);
  await expect(page.getByText("Нет касс")).toBeVisible();
  await createRegisterButton(page).click();
  const f = registerFields(page);
  await expect(f.name).toBeVisible();
  return f;
}

/* ---------- Карточка ---------- */

/** Счётчик журнала: число и слово «записей» лежат в соседних span. */
const docsCounter = (page: Page) => page.getByText("записей", { exact: true }).locator("..");

const detailTitle = (page: Page) =>
  page.getByRole("heading", { level: 2, name: "Основная касса" });
const subtitle = (page: Page) => page.getByText(/^Баланс:/);
const docsTab = (page: Page, name: "Все" | "Расход" | "Приход") =>
  page.getByRole("button", { name, exact: true });
const receiptButton = (page: Page) => page.getByRole("button", { name: "Приход в кассу" });
const expenseButton = (page: Page) => page.getByRole("button", { name: "Расход из кассы" });
const filtersToggle = (page: Page) => page.getByRole("button", { name: "Фильтры" });

async function openDetail(page: Page): Promise<void> {
  await page.goto(URLS.detail);
  await expect(detailTitle(page)).toBeVisible(FIRST_RENDER);
  await expect(rowWith(page, "ПКО-1")).toBeVisible(FIRST_RENDER);
}

const docFields = (page: Page, title: "Приход в кассу" | "Расход из кассы") => {
  const modal = modalByTitle(page, title);
  const kind = title === "Приход в кассу" ? "приход" : "расход";
  return {
    modal,
    counterparty: field(modal, page, "Контрагент"),
    category: field(modal, page, "Категория платежа *"),
    amount: field(modal, page, "Сумма *"),
    comment: field(modal, page, "Комментарий"),
    posted: modal.getByLabel("Провести сразу"),
    submit: modal.getByRole("button", { name: new RegExp(`^(Создать ${kind}|Сохранение…)$`) }),
    saving: modal.getByRole("button", { name: "Сохранение…" }),
    cancel: modal.getByRole("button", { name: "Отмена" }),
    close: modal.getByRole("button", { name: "Закрыть" }),
  };
};

async function openReceipt(page: Page) {
  await openDetail(page);
  await receiptButton(page).click();
  const f = docFields(page, "Приход в кассу");
  await expect(f.amount).toBeVisible();
  return f;
}

async function openExpense(page: Page) {
  await openDetail(page);
  await expenseButton(page).click();
  const f = docFields(page, "Расход из кассы");
  await expect(f.amount).toBeVisible();
  return f;
}

/** Заполнить приход валидными данными. */
async function fillDoc(f: ReturnType<typeof docFields>, page: Page, amount = "1500") {
  await selectByText(f.counterparty, "ОсОО Клиент");
  await selectByText(f.category, "Оплата от клиента");
  await f.amount.fill(amount);
  await f.comment.fill("Оплата по счёту 15");
  void page;
}

/* ======================================================================
   1. ХЕППИ-ПАТ
   ====================================================================== */

test.describe("1. Хеппи-пат: список касс (/crm/warehouse/kassa)", () => {
  test("первая загрузка: запросы владельца, собственная и партнёрская касса, итоги", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Основная касса")).toBeVisible();

    // Владелец запрашивает кассы вместе с партнёрскими, остальным include_partners не уходит.
    const reg = api.calls("registers", "GET")[0].url;
    expect(reg.searchParams.get("page_size")).toBe("200");
    expect(reg.searchParams.get("include_partners")).toBe("1");
    // Настройки подтверждения и счётчик ожидающих запросов.
    expect(api.calls("settings", "GET").length).toBeGreaterThan(0);
    expect(api.calls("cashRequests", "GET")[0].url.searchParams.get("status")).toBe("PENDING");
    // Итоги каждой кассы — отдельным запросом /operations/ (N+1).
    await expect.poll(() => api.calls("registerOperations", "GET").length).toBeGreaterThanOrEqual(2);

    await expect(page.getByText("Кассы склада — приход и расход денег")).toBeVisible();
    await expect(page.getByText("Всего: 2")).toBeVisible();

    // Остаток = приход − расход: 20 000 − 4 999,5 = 15 000,5.
    const own = rowWith(page, "Основная касса");
    await expect(own).toContainText("Точка №1");
    await expect(own).toContainText(somRe(20000));
    await expect(own).toContainText(somRe(4999.5));
    await expect(own).toContainText(somRe(15000.5));
    // Партнёрская касса помечена бейджем.
    const partner = rowWith(page, "Касса партнёра");
    await expect(partner).toContainText("Партнёр");
    await expect(partner).toContainText(somRe(3000));
    // Своя касса уже есть → создать вторую нельзя.
    await expect(createRegisterButton(page)).toHaveCount(0);
    await expectNoRenderGarbage(page);
  });

  test("единственная касса: итоги берутся из корня ответа без запроса /operations/", async ({
    page,
    api,
  }) => {
    api.db.registers = [OWN_REGISTER];
    api.on("registers", (route) =>
      json(route, {
        count: 1,
        next: null,
        previous: null,
        receipts_total: "700.00",
        expenses_total: "200.00",
        results: [{ ...OWN_REGISTER, balance: "500.00" }],
      }),
    );
    await openList(page);
    const own = rowWith(page, "Основная касса");
    await expect(own).toContainText(somRe(700));
    await expect(own).toContainText(somRe(200));
    await expect(own).toContainText(somRe(500));
    expect(api.calls("registerOperations")).toHaveLength(0);
  });

  test("поиск по названию и расположению работает на клиенте, без запросов", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Касса партнёра")).toBeVisible();
    const before = api.calls("registers", "GET").length;

    await searchInput(page).fill("основная");
    await expect(page.getByText("Всего: 1")).toBeVisible();
    await expect(rowWith(page, "Касса партнёра")).toHaveCount(0);

    // Поиск по расположению (регистр не важен).
    await searchInput(page).fill("ОШ");
    await expect(rowWith(page, "Касса партнёра")).toBeVisible();
    await expect(rowWith(page, "Основная касса")).toHaveCount(0);

    await searchInput(page).fill("нет такой");
    await expect(page.getByText("Нет касс")).toBeVisible();
    expect(api.calls("registers", "GET").length).toBe(before);
  });

  test("клик по строке и кнопка «Открыть» ведут в карточку кассы", async ({ page }) => {
    await openList(page);
    await rowWith(page, "Основная касса").getByRole("cell").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.detail}$`));
    await expect(detailTitle(page)).toBeVisible(FIRST_RENDER);

    await page.goBack();
    await expect(listHeading(page)).toBeVisible();
    await rowWith(page, "Основная касса").getByRole("button", { name: "Открыть" }).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.detail}$`));
  });

  test("вкладки владельца: Кассы, Запросы, Инкассация партнёров, Настройки", async ({
    page,
  }) => {
    await openList(page);
    for (const name of ["Кассы", /^Запросы/, "Инкассация партнёров", "Настройки"]) {
      await expect(headerTab(page, name)).toBeVisible();
    }
  });

  test("создание кассы: форма → POST → модалка закрыта, касса в списке, повторное создание недоступно", async ({
    page,
    api,
  }) => {
    const f = await openEmptyList(page, api);
    await expect(f.modal.getByRole("heading", { name: "Создать кассу" })).toBeVisible();
    await f.name.fill("Касса точки №2");
    await f.location.fill("Бишкек, Чуй 10");
    await f.save.click();

    await expect(f.name).toBeHidden();
    const posts = api.calls("registers", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ name: "Касса точки №2", location: "Бишкек, Чуй 10" });
    // Список перезагружен, у владельца теперь есть своя касса.
    await expect(rowWith(page, "Касса точки №2")).toBeVisible();
    await expect(createRegisterButton(page)).toHaveCount(0);
  });

  test("расположение необязательно: без него уходит только название", async ({ page, api }) => {
    const f = await openEmptyList(page, api);
    await f.name.fill("  Касса без адреса  ");
    await f.save.click();
    await expect(f.name).toBeHidden();
    // Название обрезается по краям, пустое расположение не отправляется.
    expect(api.calls("registers", "POST")[0].body).toEqual({ name: "Касса без адреса" });
  });

  test("запросы кассы: очередь, подтверждение через confirm и отклонение", async ({
    page,
    api,
  }) => {
    await openList(page);
    await headerTab(page, /^Запросы/).click();
    await expect(page.getByRole("heading", { name: "Запросы кассы (ожидают решения)" })).toBeVisible();
    const first = rowWith(page, "ПР-00001");
    await expect(first).toContainText("Продажа");
    await expect(first).toContainText("ОсОО Клиент");
    await expect(first).toContainText(somRe(2500));

    // «Отменить» в подтверждении ничего не шлёт.
    await first.getByRole("button", { name: "Подтвердить" }).click();
    const confirm = appDialog(page, "Подтвердите ваше действие");
    await expect(confirm).toContainText("Подтвердить запрос кассы?");
    await confirm.getByRole("button", { name: "Отменить" }).click();
    expect(api.calls("requestApprove")).toHaveLength(0);

    // Подтверждение → POST approve → «Запрос подтверждён», строка уходит из очереди.
    await first.getByRole("button", { name: "Подтвердить" }).click();
    await appDialog(page, "Подтвердите ваше действие")
      .getByRole("button", { name: "Подтвердить" })
      .click();
    await closeAlert(page, "Запрос подтверждён");
    expect(api.calls("requestApprove", "POST")).toHaveLength(1);
    expect(api.calls("requestApprove", "POST")[0].url.pathname).toContain("/rq-1/approve/");
    await expect(rowWith(page, "ПР-00001")).toHaveCount(0);

    // Отклонение оставшегося запроса.
    await rowWith(page, "ПР-00002").getByRole("button", { name: "Отклонить" }).click();
    const rejectConfirm = appDialog(page, "Подтвердите ваше действие");
    await expect(rejectConfirm).toContainText("Отклонить запрос кассы?");
    await rejectConfirm.getByRole("button", { name: "Подтвердить" }).click();
    await closeAlert(page, "Запрос отклонён");
    expect(api.calls("requestReject", "POST")).toHaveLength(1);
    await expect(page.getByText("Нет запросов")).toBeVisible();
  });

  test("настройки: переключатель «Требовать подтверждение» шлёт PATCH и сообщает результат", async ({
    page,
    api,
  }) => {
    await openList(page);
    await headerTab(page, "Настройки").click();
    const toggle = page.getByLabel("Требовать подтверждение наличных операций");
    await expect(toggle).toBeChecked();

    // Чекбокс управляется состоянием родителя и переключается только после ответа сервера,
    // поэтому click(): uncheck()/check() сразу проверяют смену состояния и падали бы.
    await toggle.click();
    await closeAlert(page, "Подтверждение кассы выключено — наличные продажи проводятся сразу.");
    expect(api.calls("settings", "PATCH")[0].body).toEqual({ enabled: false });
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await closeAlert(page, "Подтверждение кассы включено — наличные продажи будут ждать решения.");
    expect(api.calls("settings", "PATCH")[1].body).toEqual({ enabled: true });
  });
});

test.describe("1. Хеппи-пат: инкассация партнёров", () => {
  async function openPartnerPanel(page: Page) {
    await openList(page);
    await headerTab(page, "Инкассация партнёров").click();
    await expect(
      page.getByRole("heading", { name: "Инкассация между компаниями-партнёрами" }),
    ).toBeVisible();
    const partner = page
      .locator("div")
      .filter({ has: page.getByText("Компания-партнёр", { exact: true }) })
      .last()
      .locator("select");
    await selectByText(partner, "ОсОО Партнёр");
    await expect(page.getByRole("heading", { name: "Кассы партнёра: ОсОО Партнёр" })).toBeVisible();
    const panel = page.locator("body");
    return {
      from: field(panel, page, "С кассы *"),
      to: field(panel, page, "На кассу *"),
      amount: field(panel, page, "Сумма *"),
      comment: field(panel, page, "Комментарий"),
    };
  }

  test("каталог партнёра: кассы, сальдо и подсказка о подтверждении", async ({ page, api }) => {
    const f = await openPartnerPanel(page);
    await expect(rowWith(page, "Касса ОсОО Партнёр")).toContainText("Главный филиал");
    await expect(rowWith(page, "Касса ОсОО Партнёр")).toContainText(somRe(1000));
    // Подсказка о режиме подтверждения относится к паре «забираем у партнёра».
    await selectByText(f.from, "Касса ОсОО Партнёр");
    await selectByText(f.to, "Основная касса");
    await expect(page.getByText(/Партнёр получит запрос и должен его подтвердить/)).toBeVisible();
    expect(api.calls("partnerCatalog", "GET")[0].url.pathname).toContain("/companies/pc-1/");
  });

  test("отдать деньги партнёру: «Провести инкассацию» → POST с суммой строкой", async ({
    page,
    api,
  }) => {
    const f = await openPartnerPanel(page);
    await selectByText(f.from, "Основная касса");
    await selectByText(f.to, "Касса ОсОО Партнёр");
    await f.amount.fill("1 234,5");
    await f.comment.fill("Инкассация E2E");
    // Мы отдаём — проводится сразу, поэтому кнопка «Провести инкассацию».
    await page.getByRole("button", { name: "Провести инкассацию" }).click();

    await closeAlert(page, "Инкассация проведена");
    const post = api.calls("incassations", "POST");
    expect(post).toHaveLength(1);
    expect(post[0].body).toMatchObject({
      cash_register_from: REGISTER_ID,
      cash_register_to: "pr-1",
      amount: "1234.50",
      comment: "Инкассация E2E",
    });
    // История инкассаций перезапрошена.
    await expect.poll(() => api.calls("incassations", "GET").length).toBeGreaterThan(1);
  });

  test("забрать у партнёра при режиме «с подтверждением»: запрос уходит как ожидающий", async ({
    page,
    api,
  }) => {
    api.on("incassations", (route, { method, body }, db) => {
      if (method === "POST") {
        db.incassations.push(body);
        return json(route, { result: "pending" }, 202);
      }
      return json(route, paginated(db.incassations));
    });
    const f = await openPartnerPanel(page);
    await selectByText(f.from, "Касса ОсОО Партнёр");
    await selectByText(f.to, "Основная касса");
    await f.amount.fill("500");
    await page.getByRole("button", { name: "Запросить у партнёра" }).click();
    await closeAlert(
      page,
      "Запрос отправлен партнёру. Деньги поступят после его подтверждения",
    );
  });

  test("кнопка отправки заблокирована, пока нет суммы и пары касс", async ({ page, api }) => {
    const f = await openPartnerPanel(page);
    const submit = page.getByRole("button", { name: /^(Провести инкассацию|Запросить у партнёра)$/ });
    await expect(submit).toBeDisabled();
    await selectByText(f.from, "Основная касса");
    await selectByText(f.to, "Касса ОсОО Партнёр");
    await expect(submit).toBeDisabled(); // сумма не введена
    await f.amount.fill("0");
    await expect(submit).toBeDisabled();
    await f.amount.fill("10");
    await expect(submit).toBeEnabled();
    expect(api.calls("incassations", "POST")).toHaveLength(0);
  });
});

test.describe("1. Хеппи-пат: карточка кассы (/crm/warehouse/kassa/:id)", () => {
  test("загрузка: «Баланс · Приход · Расход», журнал и запросы с id кассы", async ({
    page,
    api,
  }) => {
    await openDetail(page);
    await expect(subtitle(page)).toContainText(somRe(15000.5));
    await expect(subtitle(page)).toContainText(new RegExp(`Приход:\\s*${somRe(20000).source}`));
    await expect(subtitle(page)).toContainText(new RegExp(`Расход:\\s*${somRe(4999.5).source}`));

    const docs = api.calls("moneyDocuments", "GET")[0].url;
    expect(docs.searchParams.get("cash_register")).toBe(REGISTER_ID);
    expect(docs.searchParams.get("page_size")).toBe("100");
    expect(docs.searchParams.get("page")).toBe("1");
    expect(docs.searchParams.has("doc_type")).toBe(false);
    expect(api.calls("registerOperations", "GET")[0].url.pathname).toContain(
      `/cash-registers/${REGISTER_ID}/operations/`,
    );

    // Строки журнала: тип, контрагент, категория, форма оплаты, сумма и статус по-русски.
    const receipt = rowWith(page, "ПКО-1");
    await expect(receipt).toContainText("Приход");
    await expect(receipt).toContainText("ОсОО Клиент");
    await expect(receipt).toContainText("Оплата от клиента");
    await expect(receipt).toContainText("Наличные");
    await expect(receipt).toContainText(somRe(1000));
    await expect(receipt).toContainText("Проведён");
    const expense = rowWith(page, "РКО-2");
    await expect(expense).toContainText("Расход");
    await expect(expense).toContainText("Безналичные");
    await expect(expense).toContainText(somRe(400));
    await expect(rowWith(page, "ПКО-3")).toContainText("Черновик");
    // Счётчик «N записей» — внутри панели фильтров, она закрыта по умолчанию.
    await filtersToggle(page).click();
    await expect(docsCounter(page)).toHaveText(/^3\s*записей$/);
    await expectNoRenderGarbage(page);
  });

  test("вкладки «Приход» и «Расход» фильтруют журнал серверным doc_type", async ({
    page,
    api,
  }) => {
    await openDetail(page);
    const lastDocs = () => api.calls("moneyDocuments", "GET").at(-1)!.url.searchParams;

    await docsTab(page, "Расход").click();
    await expect.poll(() => lastDocs().get("doc_type")).toBe("MONEY_EXPENSE");
    await expect(rowWith(page, "РКО-2")).toBeVisible();
    await expect(rowWith(page, "ПКО-1")).toHaveCount(0);

    await docsTab(page, "Приход").click();
    await expect.poll(() => lastDocs().get("doc_type")).toBe("MONEY_RECEIPT");
    await expect(rowWith(page, "ПКО-1")).toBeVisible();
    await expect(rowWith(page, "РКО-2")).toHaveCount(0);

    await docsTab(page, "Все").click();
    await expect.poll(() => lastDocs().has("doc_type")).toBe(false);
  });

  test("фильтры: контрагент, категория, форма оплаты, даты и «Сбросить»", async ({
    page,
    api,
  }) => {
    await openDetail(page);
    await filtersToggle(page).click();
    await expect(page.getByText("Настройка фильтров")).toBeVisible();
    const lastDocs = () => api.calls("moneyDocuments", "GET").at(-1)!.url.searchParams;

    await page.getByTitle("Фильтр по контрагенту").selectOption({ label: "ИП Поставщик" });
    await expect.poll(() => lastDocs().get("counterparty")).toBe("cp-2");
    await expect(rowWith(page, "РКО-2")).toBeVisible();
    await expect(rowWith(page, "ПКО-1")).toHaveCount(0);

    await page.getByTitle("Фильтр по категории").selectOption({ label: "Аренда" });
    await expect.poll(() => lastDocs().get("payment_category")).toBe("mc-2");
    await page.getByTitle("Фильтр по форме оплаты").selectOption("cashless");
    await expect.poll(() => lastDocs().get("payment_method")).toBe("cashless");

    await page.getByTitle("Начало периода").fill("2026-09-01");
    await page.getByTitle("Конец периода").fill("2026-10-31");
    await expect.poll(() => lastDocs().get("date_from")).toBe("2026-09-01");
    await expect.poll(() => lastDocs().get("date_to")).toBe("2026-10-31");
    await expect(docsCounter(page)).toHaveText(/^1\s*записей$/);

    // «Сбросить» очищает все шесть фильтров и возвращает общий журнал.
    await page.getByTitle("Сбросить фильтры").click();
    await expect.poll(() => lastDocs().has("counterparty")).toBe(false);
    await expect.poll(() => lastDocs().has("date_from")).toBe(false);
    await expect.poll(() => lastDocs().has("payment_method")).toBe(false);
    await expect(rowWith(page, "ПКО-1")).toBeVisible();
    await expect(page.getByTitle("Сбросить фильтры")).toHaveCount(0);
  });

  test("фильтр по агенту сбрасывает выбранного контрагента", async ({ page, api }) => {
    await openDetail(page);
    await filtersToggle(page).click();
    await page.getByTitle("Фильтр по контрагенту").selectOption({ label: "ОсОО Клиент" });
    await page.getByTitle("Фильтр по агенту").selectOption({ label: "Агентов Айбек" });
    await expect(page.getByTitle("Фильтр по контрагенту")).toHaveValue("");
    const q = api.calls("moneyDocuments", "GET").at(-1)!.url.searchParams;
    await expect.poll(() => q.get("agent") ?? api.calls("moneyDocuments", "GET").at(-1)!.url.searchParams.get("agent")).toBe("emp-1");
  });

  test("выбранная вкладка журнала сохраняется после перезагрузки страницы", async ({
    page,
    api,
  }) => {
    await openDetail(page);
    await docsTab(page, "Приход").click();
    await expect(rowWith(page, "РКО-2")).toHaveCount(0);
    await page.reload();
    await expect(detailTitle(page)).toBeVisible(FIRST_RENDER);
    await expect
      .poll(() => api.calls("moneyDocuments", "GET").at(-1)!.url.searchParams.get("doc_type"))
      .toBe("MONEY_RECEIPT");
  });

  test("«← Назад» возвращает к списку касс", async ({ page }) => {
    await openDetail(page);
    await page.getByRole("button", { name: /Назад/ }).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.list}$`));
    await expect(listHeading(page)).toBeVisible(FIRST_RENDER);
  });

  test("приход с проведением: POST → POST /post/ → баланс в шапке вырос", async ({
    page,
    api,
  }) => {
    const f = await openReceipt(page);
    await expect(f.modal.getByRole("heading", { name: "Приход в кассу" })).toBeVisible();
    await expect(f.posted).toBeChecked();
    await fillDoc(f, page, "1500");
    await f.submit.click();
    await expect(f.amount).toBeHidden();

    const created = api.calls("moneyDocuments", "POST");
    expect(created).toHaveLength(1);
    expect(created[0].body).toEqual({
      doc_type: "MONEY_RECEIPT",
      cash_register: REGISTER_ID,
      counterparty: "cp-1",
      payment_category: "mc-1",
      amount: 1500,
      comment: "Оплата по счёту 15",
    });
    const posts = api.calls("moneyDocumentPost", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toContain("/md-new-1/post/");
    // Остаток 15 000,5 + 1 500 = 16 500,5; приход 20 000 + 1 500 = 21 500.
    await expect(subtitle(page)).toContainText(somRe(16500.5));
    await expect(subtitle(page)).toContainText(new RegExp(`Приход:\\s*${somRe(21500).source}`));
  });

  test("расход с проведением: баланс в шапке уменьшился", async ({ page, api }) => {
    const f = await openExpense(page);
    await selectByText(f.category, "Аренда");
    await f.amount.fill("2 000".replace(" ", ""));
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body).toMatchObject({
      doc_type: "MONEY_EXPENSE",
      payment_category: "mc-2",
      amount: 2000,
      counterparty: null,
    });
    // 15 000,5 − 2 000 = 13 000,5; расход 4 999,5 + 2 000 = 6 999,5.
    await expect(subtitle(page)).toContainText(somRe(13000.5));
    await expect(subtitle(page)).toContainText(new RegExp(`Расход:\\s*${somRe(6999.5).source}`));
  });

  test("черновик: без «Провести сразу» документ не проводится, баланс не меняется", async ({
    page,
    api,
  }) => {
    const f = await openReceipt(page);
    await f.posted.uncheck();
    await fillDoc(f, page, "999");
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
    expect(api.calls("moneyDocumentPost")).toHaveLength(0);
    await expect(subtitle(page)).toContainText(somRe(15000.5));
  });

  test("дробная сумма и запятая принимаются", async ({ page, api }) => {
    const f = await openReceipt(page);
    await selectByText(f.category, "Оплата от клиента");
    await f.amount.fill("10.55");
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body.amount).toBe(10.55);
  });

  test("созданный документ появляется в журнале сразу после сохранения", async ({ page }) => {
    // Регрессия (исправлено): после создания перезагружается только шапка с итогами (load()), а таблица журнала и
    // счётчик «N записей» остаются старыми — новая операция не появляется, пока пользователь не
    // сменит вкладку, фильтр или страницу. Баланс в шапке при этом уже изменился.

    const f = await openReceipt(page);
    await fillDoc(f, page, "1500");
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    await expect(rowWith(page, "НОВ-1")).toBeVisible({ timeout: 3_000 });
    await filtersToggle(page).click();
    await expect(docsCounter(page)).toHaveText(/^4\s*записей$/);
  });
});

/* ======================================================================
   2. ЗАЩИТА ОТ ДУРАКА
   ====================================================================== */

test.describe("2. Защита от дурака: создание кассы", () => {
  test("тройной клик по «Сохранить»: создаётся ОДНА касса", async ({ page, api }) => {
    // Регрессия (исправлено): у «Сохранить» нет ни disabled, ни флага «идёт сохранение» — каждый клик шлёт
    // свой POST, и создаются дубли касс (в тесте — три за тройной клик).

    api.on("registers", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.registers));
      await delay(800); // медленный бэк — окно для повторных кликов
      return json(route, { id: "cr-slow", name: body.name, balance: "0", company: "e2e-company" }, 201);
    });
    const f = await openEmptyList(page, api);
    await f.name.fill("Касса-дубль");
    await f.save.click({ clickCount: 3 });
    await expect(f.name).toBeHidden({ timeout: 10_000 });
    expect(api.calls("registers", "POST")).toHaveLength(1);
  });

  test("пустое название: оповещение «Введите название кассы», запросов нет", async ({
    page,
    api,
  }) => {
    const f = await openEmptyList(page, api);
    await f.save.click();
    await closeAlert(page, "Введите название кассы");
    await expect(f.name).toBeVisible(); // модалка осталась открытой

    // Одни пробелы — то же самое.
    await f.name.fill("     ");
    await f.save.click();
    await closeAlert(page, "Введите название кассы");
    expect(api.calls("registers", "POST")).toHaveLength(0);
  });

  test("спецсимволы и XSS в названии сохраняются как текст и не исполняются", async ({
    page,
    api,
  }) => {
    const evil = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>{}&amp;&"'`;
    const f = await openEmptyList(page, api);
    await f.name.fill(evil);
    await f.location.fill(evil);
    await f.save.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("registers", "POST")[0].body.name).toBe(evil);

    const row = rowWith(page, "onerror");
    await expect(row).toBeVisible();
    // Разметка выведена буквально, «&amp;» не раскодирован.
    await expect(row.getByRole("cell").nth(1)).toContainText(evil);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("гигантское название и расположение не роняют страницу и не дают горизонтальный скролл", async ({
    page,
    api,
  }) => {
    const huge = "Ж".repeat(10_000);
    const f = await openEmptyList(page, api);
    await f.name.fill(huge);
    await f.location.fill("Х".repeat(5_000));
    await f.save.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("registers", "POST")[0].body.name).toHaveLength(10_000);
    await expect(rowWith(page, "ЖЖЖЖ")).toBeVisible();
    await expect(searchInput(page)).toBeInViewport();
  });

  test("закрытие модалки по «Отмена», крестику и оверлею не создаёт кассу", async ({
    page,
    api,
  }) => {
    const f = await openEmptyList(page, api);
    await f.name.fill("Не сохранять");
    await f.cancel.click();
    await expect(f.name).toBeHidden();

    await createRegisterButton(page).click();
    await f.close.click();
    await expect(f.name).toBeHidden();

    await createRegisterButton(page).click();
    await page.mouse.click(5, 5); // оверлей закрывает модалку
    await expect(f.name).toBeHidden();
    expect(api.calls("registers", "POST")).toHaveLength(0);
  });
});

test.describe("2. Защита от дурака: приход и расход", () => {
  test("тройной клик по «Создать приход»: уходит ОДИН документ", async ({ page, api }) => {
    api.on("moneyDocuments", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.docs));
      await delay(800);
      return json(route, { id: "md-slow", ...body, status: "DRAFT" }, 201);
    });
    const f = await openReceipt(page);
    await fillDoc(f, page);
    await f.submit.click({ clickCount: 3 });
    await expect(f.saving).toBeDisabled();
    await expect(f.amount).toBeHidden({ timeout: 10_000 });
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
    expect(api.calls("moneyDocumentPost", "POST")).toHaveLength(1);
  });

  test("пустая форма: сначала «Выберите категорию», запросов нет", async ({ page, api }) => {
    const f = await openReceipt(page);
    await f.submit.click();
    await expect(f.modal.getByText("Выберите категорию")).toBeVisible();
    await expect(f.amount).toBeVisible();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);

    // Категория выбрана, суммы нет → «Укажите сумму».
    await selectByText(f.category, "Оплата от клиента");
    await f.submit.click();
    await expect(f.modal.getByText("Укажите сумму")).toBeVisible();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  for (const amount of ["-5", "0", "-0.01", "1e999999", "9".repeat(400)]) {
    test(`некорректная сумма «${amount.slice(0, 12)}${amount.length > 12 ? "…" : ""}» отклоняется`, async ({
      page,
      api,
    }) => {
      const f = await openReceipt(page);
      await selectByText(f.category, "Оплата от клиента");
      await f.amount.fill(amount);
      await f.submit.click();
      await expect(f.modal.getByText("Укажите сумму")).toBeVisible();
      expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
    });
  }

  test("в числовое поле суммы нельзя ввести буквы и спецсимволы", async ({ page }) => {
    const f = await openReceipt(page);
    await f.amount.click();
    await page.keyboard.type("abc{}<>&");
    await expect(f.amount).toHaveValue("");
  });

  test("спецсимволы и гигантский комментарий уходят как есть и не исполняются", async ({
    page,
    api,
  }) => {
    const comment = `<script>window.__xss=1</script>{}&amp;&"' ${"Ж".repeat(10_000)}`;
    const f = await openReceipt(page);
    await selectByText(f.category, "Оплата от клиента");
    await f.amount.fill("100");
    await f.comment.fill(comment);
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body.comment).toBe(comment.trim());
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test("закрытие по «Отмена», крестику и оверлею не отправляет запросов", async ({
    page,
    api,
  }) => {
    const f = await openReceipt(page);
    await f.cancel.click();
    await expect(f.amount).toBeHidden();
    await receiptButton(page).click();
    await f.close.click();
    await expect(f.amount).toBeHidden();
    await receiptButton(page).click();
    await page.mouse.click(5, 5);
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  test("повторное открытие формы начинается с чистого листа", async ({ page }) => {
    const f = await openReceipt(page);
    await fillDoc(f, page, "321");
    await f.close.click();
    await receiptButton(page).click();
    await expect(f.amount).toHaveValue("");
    await expect(f.comment).toHaveValue("");
    await expect(f.category).toHaveValue("");
  });

  test("мусорные данные журнала: пустые поля, неизвестный статус, нечисловые суммы, XSS", async ({
    page,
    api,
  }) => {
    api.db.docs = [
      makeDoc(1, { counterparty_display_name: `<img src=x onerror="window.__xss=1">`, amount: "abc" }),
      makeDoc(2, { number: null, counterparty_display_name: null, payment_category_title: null, payment_method: null, status: "WEIRD" }),
      makeDoc(3, { date: "не дата", amount: "-250" }),
    ];
    await page.goto(URLS.detail);
    await expect(detailTitle(page)).toBeVisible(FIRST_RENDER);
    await expect(rowWith(page, "onerror")).toBeVisible(FIRST_RENDER);
    // formatSom: нечисловое значение → «0 сом», а не «NaN сом».
    await expect(rowWith(page, "onerror")).toContainText(/0\s*сом/);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expectNoRenderGarbage(page);
  });
});

/* ======================================================================
   3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: офисный ноутбук 1366×768
   ====================================================================== */

test.describe("3. Экран 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("список: вкладки, поиск и таблица на экране, без горизонтального скролла страницы", async ({
    page,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Основная касса")).toBeVisible();
    await expect(headerTab(page, "Кассы")).toBeInViewport();
    await expect(headerTab(page, "Настройки")).toBeInViewport();
    await expect(searchInput(page)).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("модалка создания кассы: «Сохранить» видна или достижима прокруткой", async ({
    page,
    api,
  }) => {
    const f = await openEmptyList(page, api);
    await expect(f.close).toBeInViewport();
    await f.save.scrollIntoViewIfNeeded();
    await expect(f.save).toBeInViewport();
    await expect(f.cancel).toBeInViewport();
  });

  test("карточка: кнопки «Приход/Расход», журнал и фильтры на экране", async ({ page }) => {
    await openDetail(page);
    await expect(receiptButton(page)).toBeInViewport();
    await expect(expenseButton(page)).toBeInViewport();
    await expect(filtersToggle(page)).toBeInViewport();
    await filtersToggle(page).click();
    await expect(page.getByTitle("Фильтр по контрагенту")).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("модалка прихода: «Создать приход» видна или достижима прокруткой", async ({ page }) => {
    const f = await openReceipt(page);
    await expect(f.close).toBeInViewport();
    await f.submit.scrollIntoViewIfNeeded();
    await expect(f.submit).toBeInViewport();
    await expect(f.cancel).toBeInViewport();
  });
});

/* ======================================================================
   4. СБОИ БЭКЕНДА
   ====================================================================== */

test.describe("4. Сбои бэкенда: отправка форм", () => {
  test("создание кассы: 500 → оповещение «Ошибка сервера», форма на месте, повтор проходит", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("registers", (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.registers));
      if (fail) return json(route, { detail: "Ошибка сервера" }, 500);
      return json(route, { id: "cr-ok", name: body.name, balance: "0", company: "e2e-company" }, 201);
    });
    const f = await openEmptyList(page, api);
    await f.name.fill("Касса сбой");
    await f.save.click();
    const dlg = appDialog(page, "Ошибка сервера");
    await expect(dlg.getByRole("heading", { name: "Ошибка" })).toBeVisible();
    await dlg.getByRole("button", { name: "Ок" }).click();
    await expect(f.name).toHaveValue("Касса сбой");
    await expect(listHeading(page)).toBeVisible();

    fail = false;
    await f.save.click();
    await expect(f.name).toBeHidden();
  });

  test("создание кассы: ошибки полей 400 и HTML 502 → запасной текст", async ({ page, api }) => {
    api.on("registers", (route, { method }, db) =>
      method === "POST"
        ? json(route, { name: ["Касса с таким названием уже есть."] }, 400)
        : json(route, paginated(db.registers)),
    );
    const f = await openEmptyList(page, api);
    await f.name.fill("Дубль");
    await f.save.click();
    // Ошибки полей DRF не показываются, остаётся общий запасной текст.
    await closeAlert(page, "Не удалось создать кассу");

    api.on("registers", (route, { method }, db) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, paginated(db.registers)),
    );
    await f.save.click();
    await closeAlert(page, "Не удалось создать кассу");
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
  });

  test("создание кассы: обрыв сети → «Network Error», модалка жива", async ({ page, api }) => {
    api.on("registers", (route, { method }, db) =>
      method === "POST"
        ? route.abort("internetdisconnected")
        : json(route, paginated(db.registers)),
    );
    const f = await openEmptyList(page, api);
    await f.name.fill("Нет сети");
    await f.save.click();
    await closeAlert(page, "Network Error");
    await expect(f.name).toHaveValue("Нет сети");
  });

  test("приход: 500 → ошибка в модалке, данные сохранены; повтор проходит", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("moneyDocuments", (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.docs));
      if (fail) return json(route, { detail: "Ошибка сервера" }, 500);
      return json(route, { id: "md-ok", ...body, status: "DRAFT" }, 201);
    });
    const f = await openReceipt(page);
    await fillDoc(f, page, "777");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(f.amount).toHaveValue("777");
    await expect(f.submit).toBeEnabled();
    await expect(detailTitle(page)).toBeVisible();

    fail = false;
    await f.submit.click();
    await expect(f.amount).toBeHidden();
  });

  test("приход: пустая ошибка, ошибки полей 400 → «Ошибка создания»; HTML выводится текстом", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", (route, { method }, db) =>
      method === "POST" ? json(route, {}, 500) : json(route, paginated(db.docs)),
    );
    const f = await openReceipt(page);
    await fillDoc(f, page);
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка создания")).toBeVisible();

    api.on("moneyDocuments", (route, { method }, db) =>
      method === "POST"
        ? json(route, { amount: ["Некорректная сумма."] }, 400)
        : json(route, paginated(db.docs)),
    );
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка создания")).toBeVisible();

    api.on("moneyDocuments", (route, { method }, db) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, paginated(db.docs)),
    );
    await f.submit.click();
    await expect(f.modal.getByText(/502 Bad Gateway/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
  });

  test("приход: документ создан, проведение упало — повтор не плодит дубли", async ({
    page,
    api,
  }) => {
    // Регрессия (исправлено): если POST документа прошёл, а /post/ упал, в базе остаётся черновик, а модалка —
    // открытой с ошибкой. Повторное «Создать приход» заново создаёт документ (второй, третий…).

    let failPost = true;
    api.on("moneyDocumentPost", (route, { url }, db) => {
      if (failPost) return json(route, { detail: "Касса закрыта" }, 400);
      const id = lastSegment(url, 2);
      const doc = db.docs.find((d) => d.id === id);
      if (doc) doc.status = "POSTED";
      return json(route, { id, status: "POSTED" });
    });
    const f = await openReceipt(page);
    await fillDoc(f, page);
    await f.submit.click();
    await expect(f.modal.getByText("Касса закрыта")).toBeVisible();

    failPost = false;
    await f.submit.click();
    await expect(f.amount).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
  });

  test("подтверждение запроса: 500 → оповещение об ошибке, запрос остаётся в очереди", async ({
    page,
    api,
  }) => {
    api.on("requestApprove", (route) => json(route, { detail: "Недостаточно средств" }, 400));
    await openList(page);
    await headerTab(page, /^Запросы/).click();
    await rowWith(page, "ПР-00001").getByRole("button", { name: "Подтвердить" }).click();
    await appDialog(page, "Подтвердите ваше действие")
      .getByRole("button", { name: "Подтвердить" })
      .click();
    const dlg = appDialog(page, "Недостаточно средств");
    await expect(dlg.getByRole("heading", { name: "Ошибка" })).toBeVisible();
    await dlg.getByRole("button", { name: "Ок" }).click();
    await expect(rowWith(page, "ПР-00001")).toBeVisible();
    // Кнопки снова доступны.
    await expect(rowWith(page, "ПР-00001").getByRole("button", { name: "Отклонить" })).toBeEnabled();
  });

  test("настройки: 500 при сохранении → ошибка, переключатель возвращается", async ({
    page,
    api,
  }) => {
    api.on("settings", (route, { method }, db) =>
      method === "PATCH"
        ? json(route, { detail: "Ошибка сервера" }, 500)
        : json(route, { enabled: db.settingsEnabled }),
    );
    await openList(page);
    await headerTab(page, "Настройки").click();
    const toggle = page.getByLabel("Требовать подтверждение наличных операций");
    await toggle.click();
    await closeAlert(page, "Ошибка сервера");
    await expect(toggle).toBeChecked(); // при ошибке состояние не меняется
  });

  test("инкассация: 400 с detail → оповещение, форма не очищается", async ({ page, api }) => {
    api.on("incassations", (route, { method }, db) =>
      method === "POST"
        ? json(route, { detail: "Недостаточно средств в кассе" }, 400)
        : json(route, paginated(db.incassations)),
    );
    await openList(page);
    await headerTab(page, "Инкассация партнёров").click();
    const partner = page
      .locator("div")
      .filter({ has: page.getByText("Компания-партнёр", { exact: true }) })
      .last()
      .locator("select");
    await selectByText(partner, "ОсОО Партнёр");
    const body = page.locator("body");
    await selectByText(field(body, page, "С кассы *"), "Основная касса");
    await selectByText(field(body, page, "На кассу *"), "Касса ОсОО Партнёр");
    await field(body, page, "Сумма *").fill("99999");
    await page.getByRole("button", { name: "Провести инкассацию" }).click();
    await closeAlert(page, "Недостаточно средств в кассе");
    await expect(field(body, page, "Сумма *")).toHaveValue("99999");
  });
});

test.describe("4. Сбои бэкенда: null и пустые ответы на GET", () => {
  test("список: кассы = null → «Нет касс» и возможность создать кассу, страница жива", async ({
    page,
    api,
  }) => {
    api.on("registers", (route) => json(route, null));
    await openList(page);
    await expect(page.getByText("Нет касс")).toBeVisible();
    await expect(createRegisterButton(page)).toBeVisible();
    await expect(searchInput(page)).toBeEditable();
    await expectNoRenderGarbage(page);
  });

  test("список: results = null и 500 → «Нет касс» / баннер ошибки", async ({ page, api }) => {
    api.on("registers", (route) => json(route, { count: 0, results: null }));
    await openList(page);
    await expect(page.getByText("Нет касс")).toBeVisible();
    // Касс нет — можно создать.
    await expect(createRegisterButton(page)).toBeVisible();

    api.on("registers", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.reload();
    await expect(page.getByText("Не удалось загрузить кассы")).toBeVisible(FIRST_RENDER);
  });

  test("список: у кассы null вместо названия, баланса и итогов", async ({ page, api }) => {
    api.db.registers = [
      { id: "n-1", name: null as unknown as string, location: undefined, balance: null, company: "e2e-company" },
      { ...PARTNER_REGISTER },
    ];
    api.on("registerOperations", (route) =>
      json(route, { receipts_total: null, expenses_total: null, balance: null }),
    );
    await openList(page);
    await expect(page.getByText("Всего: 2")).toBeVisible();
    await expect(rowWith(page, "Касса партнёра")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("список: сбой /operations/ у одной кассы не ломает остальные строки", async ({
    page,
    api,
  }) => {
    api.on("registerOperations", (route, { url }, db) =>
      lastSegment(url, 2) === "cr-partner"
        ? json(route, { detail: "Ошибка сервера" }, 500)
        : json(route, registerTotals(db, lastSegment(url, 2))),
    );
    await openList(page);
    await expect(rowWith(page, "Основная касса")).toContainText(somRe(15000.5));
    await expect(rowWith(page, "Касса партнёра")).toBeVisible();
  });

  test("список: настройки null и очередь запросов null — вкладка «Запросы» не падает", async ({
    page,
    api,
  }) => {
    api.on("settings", (route) => json(route, null));
    api.on("cashRequests", (route) => json(route, null));
    await openList(page);
    await expect(rowWith(page, "Основная касса")).toBeVisible();
    const tab = headerTab(page, /^Запросы/);
    if (await tab.count()) {
      await tab.click();
      await expect(page.getByText("Нет запросов")).toBeVisible();
    }
    await expectNoRenderGarbage(page);
  });

  test("настройки: 404 → заглушка «ещё не подключены на сервере»", async ({ page, api }) => {
    api.on("settings", (route) => json(route, { detail: "Не найдено." }, 404));
    await openList(page);
    await headerTab(page, "Настройки").click();
    await expect(page.getByText(/Настройки подтверждения кассы ещё не подключены/)).toBeVisible();
  });

  test("запросы: 500 → «Не удалось загрузить запросы»", async ({ page, api }) => {
    await openList(page);
    api.on("cashRequests", (route, { url }, db) =>
      url.searchParams.get("page_size") === "1"
        ? json(route, { count: 1, results: db.requests.slice(0, 1) })
        : json(route, { detail: "Ошибка сервера" }, 500),
    );
    await headerTab(page, /^Запросы/).click();
    await expect(page.getByText("Не удалось загрузить запросы")).toBeVisible();
  });

  test("партнёры: partners = null → «Нет активных партнёров»", async ({ page, api }) => {
    api.on("partners", (route) => json(route, { partners: null }));
    await openList(page);
    await headerTab(page, "Инкассация партнёров").click();
    await expect(page.getByText(/Нет активных партнёров/)).toBeVisible();
  });

  test("партнёры: каталог партнёра 500 → текст ошибки, панель жива", async ({ page, api }) => {
    api.on("partnerCatalog", (route) => json(route, { detail: "Каталог недоступен" }, 500));
    await openList(page);
    await headerTab(page, "Инкассация партнёров").click();
    const partner = page
      .locator("div")
      .filter({ has: page.getByText("Компания-партнёр", { exact: true }) })
      .last()
      .locator("select");
    await selectByText(partner, "ОсОО Партнёр");
    await expect(page.getByText("Каталог недоступен")).toBeVisible();
  });

  test("карточка: операции кассы null → «Баланс: 0 сом», страница жива", async ({ page, api }) => {
    api.on("registerOperations", (route) => json(route, null));
    await page.goto(URLS.detail);
    await expect(rowWith(page, "ПКО-1")).toBeVisible(FIRST_RENDER);
    await expect(subtitle(page)).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("карточка: 500 на операциях кассы → «Не удалось загрузить данные кассы»", async ({
    page,
    api,
  }) => {
    api.on("registerOperations", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.detail);
    await expect(page.getByText("Не удалось загрузить данные кассы")).toBeVisible(FIRST_RENDER);
    await expect(receiptButton(page)).toBeEnabled();
  });

  test("карточка: журнал null и results = null → «Нет операций»", async ({ page, api }) => {
    api.on("moneyDocuments", (route) => json(route, null));
    await page.goto(URLS.detail);
    await expect(page.getByText("Нет операций")).toBeVisible(FIRST_RENDER);

    api.on("moneyDocuments", (route) => json(route, { count: 5, results: null }));
    await docsTab(page, "Приход").click();
    await expect(page.getByText("Нет операций")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("карточка: 500 на журнале → «Не удалось загрузить операции», вкладки работают", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("moneyDocuments", (route, call, db) =>
      fail ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, paginated(db.docs)),
    );
    await page.goto(URLS.detail);
    await expect(page.getByText("Не удалось загрузить операции")).toBeVisible(FIRST_RENDER);
    fail = false;
    await docsTab(page, "Приход").click();
    await expect(page.getByText("Не удалось загрузить операции")).toBeHidden();
    await expect(rowWith(page, "ПКО-1")).toBeVisible();
  });

  test("карточка: справочники (контрагенты, категории, агенты) = null — модалка открывается", async ({
    page,
    api,
  }) => {
    for (const name of ["counterparties", "categories", "agents"] as const) {
      api.on(name, (route) => json(route, null));
    }
    const f = await openReceipt(page);
    await expect(f.category.locator("option")).toHaveCount(1); // только «— выбрать —»
    await expect(f.counterparty.locator("option")).toHaveCount(1);
    await expectNoRenderGarbage(page);
  });

  test("карточка: несуществующая касса — страница не падает", async ({ page, api }) => {
    api.on("registerOperations", (route) => json(route, { detail: "Не найдено." }, 404));
    api.on("moneyDocuments", (route) => json(route, paginated([])));
    await page.goto("/crm/warehouse/kassa/not-a-uuid");
    await expect(page.getByText("Не удалось загрузить данные кассы")).toBeVisible(FIRST_RENDER);
    await expect(page.getByText("Нет операций")).toBeVisible();
  });
});

/* ======================================================================
   Часовой пояс Asia/Bishkek (UTC+6 — основной рынок продукта)
   ====================================================================== */

test.describe("Часовой пояс Asia/Bishkek", () => {
  test.use({ timezoneId: "Asia/Bishkek" });

  test("даты журнала: со смещением — локальное время, «только дата» — без сдвига", async ({
    page,
    api,
  }) => {
    api.db.docs = [
      makeDoc(1, { date: "2026-10-01T10:30:00+06:00" }),
      makeDoc(2, { date: "2026-10-02" }),
      // 23:30 UTC 1 октября — это уже 05:30 2 октября в Бишкеке.
      makeDoc(3, { date: "2026-10-01T23:30:00Z" }),
    ];
    await page.goto(URLS.detail);
    await expect(rowWith(page, "ПКО-1")).toContainText("01.10.2026 10:30", FIRST_RENDER);
    await expect(rowWith(page, "РКО-2")).toContainText("02.10.2026");
    // Без времени: дата, за которой не следует «чч:мм».
    await expect(rowWith(page, "РКО-2")).not.toContainText(/02\.10\.2026\s*\d{2}:\d{2}/);
    await expect(rowWith(page, "ПКО-3")).toContainText("02.10.2026 05:30");
  });
});

/* ======================================================================
   5. СТРЕСС И ПРОИЗВОДИТЕЛЬНОСТЬ
   ====================================================================== */

test.describe("5. Стресс и производительность", () => {
  test.slow();

  /** Журнал на 3000 операций с серверной пагинацией (как у бэкенда: страницами по 100). */
  const bigDocs = () => makeDocs(3000, undefined);

  test("Big Data: журнал на 3000 операций — пагинация, вкладки и фильтры отзывчивы", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    await openDetail(page); // прогрев чанков Vite — в замер не попадает
    api.db.docs = bigDocs();
    const t0 = Date.now();
    await page.reload();
    await expect(page.getByText("Записи 1–100 из 3000")).toBeVisible({
      timeout: perfBudget(30_000),
    });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 3000 docs, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(15_000));
    await expect(page.getByText("Страница 1 из 30")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: /(ПКО|РКО)-/ })).toHaveCount(100);

    // Серверная пагинация.
    await page.getByRole("button", { name: "Следующая страница" }).click();
    await expect(page.getByText("Записи 101–200 из 3000")).toBeVisible();
    await expect(page.getByText("Страница 2 из 30")).toBeVisible();
    await page.getByRole("button", { name: "Предыдущая страница" }).click();
    await expect(page.getByText("Записи 1–100 из 3000")).toBeVisible();

    // Вкладка «Приход»: половина документов, возвращаемся на первую страницу.
    await docsTab(page, "Приход").click();
    await expect(page.getByText("Записи 1–100 из 1500")).toBeVisible({ timeout: perfBudget(15_000) });
    // Фильтр по контрагенту.
    await filtersToggle(page).click();
    await page.getByTitle("Фильтр по контрагенту").selectOption({ label: "ОсОО Клиент" });
    await expect(page.getByText("Записи 1–100 из 1500")).toBeVisible();
  });

  test("на странице >1 смена вкладки возвращает на первую страницу и показывает её данные", async ({
    page,
    api,
  }) => {
    // Регрессия (исправлено): при page > 1 смена вкладки/фильтра шлёт ДВА запроса (старая страница с новыми
    // фильтрами, затем страница 1) без отмены; медленный ответ «страницы 2» приходит позже и
    // затирает таблицу — вкладка «Приход», пагинация «Страница 1 из 2», а строки со страницы 2.

    api.db.docs = makeDocs(300);
    api.on("moneyDocuments", async (route, { url }, db) => {
      const q = url.searchParams;
      const p = Number(q.get("page") ?? 1);
      if (p === 2 && q.get("doc_type") === "MONEY_RECEIPT") await delay(1500);
      const list = db.docs.filter(
        (d) => !q.get("doc_type") || d.doc_type === q.get("doc_type"),
      );
      return json(route, {
        count: list.length,
        next: p * 100 < list.length ? "next" : null,
        previous: p > 1 ? "prev" : null,
        results: list.slice((p - 1) * 100, p * 100),
      });
    });
    await page.goto(URLS.detail);
    await expect(page.getByText("Страница 1 из 3")).toBeVisible(FIRST_RENDER);
    await page.getByRole("button", { name: "Следующая страница" }).click();
    await expect(page.getByText("Страница 2 из 3")).toBeVisible();

    await docsTab(page, "Приход").click();
    await expect(page.getByText("Страница 1 из 2")).toBeVisible();
    await page.waitForTimeout(2_000); // дольше самого медленного ответа
    await expect(page.getByText("Страница 1 из 2")).toBeVisible();
    // Строки — со страницы 1: у неё первая запись ПКО-1 (нумерация делает ПКО нечётными).
    await expect(page.getByRole("cell", { name: "ПКО-1", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "ПКО-201", exact: true })).toHaveCount(0);
  });

  test("Big Data: 300 касс в списке — рендер и поиск отзывчивы", async ({ page, api }) => {
    test.setTimeout(perfBudget(90_000));
    await openList(page); // прогрев
    api.db.registers = [
      { ...OWN_REGISTER },
      ...Array.from({ length: 299 }, (_, i) => ({
        id: `bulk-${i + 1}`,
        name: `Касса нагрузка ${i + 1}`,
        location: `Адрес ${i + 1}`,
        balance: String(1000 + i),
        is_partner: true,
        company: "partner-co",
      })),
    ];
    const t0 = Date.now();
    await page.reload();
    await expect(page.getByText("Всего: 300")).toBeVisible({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 300 registers, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(20_000));

    await searchInput(page).fill("нагрузка 299");
    await expect(page.getByText("Всего: 1")).toBeVisible({ timeout: perfBudget(10_000) });
    await expect(rowWith(page, "Касса нагрузка 299")).toBeVisible();
    await searchInput(page).fill("");
    await expect(page.getByText("Всего: 300")).toBeVisible();
  });

  test("Big Data: очередь на 2000 запросов кассы отрисовывается и подтверждается", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    api.db.requests = Array.from({ length: 2000 }, (_, i) => ({
      id: `rq-${i + 1}`,
      amount: String(100 + i),
      document: {
        number: `ПР-${String(i + 1).padStart(5, "0")}`,
        doc_type: "SALE",
        date: "2026-10-01T10:00:00+06:00",
        counterparty_display_name: `Клиент ${i + 1}`,
      },
    }));
    await openList(page);
    await headerTab(page, /^Запросы/).click();
    await expect(rowWith(page, "ПР-02000")).toBeAttached({ timeout: perfBudget(30_000) });
    // Подтверждение первой строки работает на большой очереди.
    await rowWith(page, "ПР-00001").getByRole("button", { name: "Подтвердить" }).click();
    await appDialog(page, "Подтвердите ваше действие")
      .getByRole("button", { name: "Подтвердить" })
      .click();
    await closeAlert(page, "Запрос подтверждён");
    await expect(rowWith(page, "ПР-00001")).toHaveCount(0);
  });

  /* ---------- CPU ×6 через Chrome DevTools Protocol ---------- */

  async function throttleCpu(page: Page, rate: number) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    return cdp;
  }

  async function measure(action: () => Promise<unknown>, done: () => Promise<unknown>) {
    const t = Date.now();
    await action();
    await done();
    return Date.now() - t;
  }

  test("CPU ×6 (CDP): журнал — вкладки, пагинация и модалка прихода с 1000 справочниками", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    api.on("counterparties", (route) =>
      json(
        route,
        paginated(Array.from({ length: 1000 }, (_, i) => ({ id: `cp-${i}`, name: `Контрагент ${i}` }))),
      ),
    );
    api.on("categories", (route) =>
      json(
        route,
        paginated(Array.from({ length: 1000 }, (_, i) => ({ id: `mc-${i}`, title: `Категория ${i}` }))),
      ),
    );
    await openDetail(page); // прогрев чанков без замедления
    api.db.docs = makeDocs(1000);
    await page.reload();
    await expect(page.getByText("Записи 1–100 из 1000")).toBeVisible({ timeout: perfBudget(30_000) });

    const cdp = await throttleCpu(page, 6);
    const tabMs = await measure(
      () => docsTab(page, "Приход").click(),
      () => expect(page.getByText("Записи 1–100 из 500")).toBeVisible(),
    );
    const pagerMs = await measure(
      () => page.getByRole("button", { name: "Следующая страница" }).click(),
      () => expect(page.getByText("Страница 2 из 5")).toBeVisible(),
    );
    const modalMs = await measure(
      () => receiptButton(page).click(),
      () => expect(docFields(page, "Приход в кассу").amount).toBeVisible(),
    );
    const f = docFields(page, "Приход в кассу");
    const selectMs = await measure(
      () => selectByText(f.counterparty, "Контрагент 999"),
      () => expect(f.counterparty).toHaveValue("cp-999"),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 kassa, ms",
      description: JSON.stringify({ tabMs, pagerMs, modalMs, selectMs }),
    });
    expect(tabMs).toBeLessThan(perfBudget(4_000));
    expect(pagerMs).toBeLessThan(perfBudget(4_000));
    expect(modalMs).toBeLessThan(perfBudget(3_000));
    expect(selectMs).toBeLessThan(perfBudget(2_000));
  });

  test("CPU ×6 (CDP): список на 300 касс — поиск и открытие модалки без лагов", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    await openList(page); // прогрев
    api.db.registers = Array.from({ length: 300 }, (_, i) => ({
      id: `bulk-${i + 1}`,
      name: `Касса нагрузка ${i + 1}`,
      location: `Адрес ${i + 1}`,
      balance: String(1000 + i),
      is_partner: true,
      company: "partner-co",
    }));
    await page.reload();
    await expect(page.getByText("Всего: 300")).toBeVisible({ timeout: perfBudget(30_000) });

    const cdp = await throttleCpu(page, 6);
    const searchMs = await measure(
      () => searchInput(page).fill("нагрузка 29"),
      () => expect(page.getByText("Всего: 11")).toBeVisible(),
    );
    const clearMs = await measure(
      () => searchInput(page).fill(""),
      () => expect(page.getByText("Всего: 300")).toBeVisible(),
    );
    const modalMs = await measure(
      () => createRegisterButton(page).click(),
      () => expect(registerFields(page).name).toBeVisible(),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 registers, ms",
      description: JSON.stringify({ searchMs, clearMs, modalMs }),
    });
    expect(searchMs).toBeLessThan(perfBudget(3_000));
    expect(clearMs).toBeLessThan(perfBudget(4_000));
    expect(modalMs).toBeLessThan(perfBudget(3_000));
  });
});
