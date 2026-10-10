// @ts-check
/**
 * E2E: аналитика склада и партнёров.
 *
 *   /crm/warehouse/analytics                      — WarehouseAnalytics (владелец/админ)
 *   /crm/warehouse/partners/analytics             — PartnerAnalyticsList
 *   /crm/warehouse/partners/:partnerId/analytics  — PartnerAnalyticsDetail
 *
 * ВАЖНО про специфику страниц. Это read-only дашборды: формы и POST/PUT на них
 * нет. Всё общение с бэком — GET-запросы, а роль «кнопки отправки» играют:
 *   - кнопка «Обновить» (перезапрос; disabled, пока идёт загрузка);
 *   - табы периода «День / Неделя / Месяц / Период» (role="tab");
 *   - поля дат «С / По / Дата» и select «Филиал партнёра» (параметры запроса).
 * Поэтому пункты ТЗ про «submit / POST 500 / пустую форму» адаптированы к этим
 * элементам и к GET-запросам, которые они отправляют.
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** и routeWebSocket):
 * по умолчанию фронт ходит на боевой https://app.nurcrm.kg/api, и тесты не
 * должны ни читать, ни трогать продовые данные. Реальный логин не нужен —
 * токен кладётся в localStorage, а /users/profile/ и /users/company/ отдают
 * владельца компании сектора «Склад».
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer
 * в playwright.config.js):
 *   npx playwright test tests/warehouse-analytics --project=chromium
 * Другой адрес фронта — через E2E_BASE_URL.
 */
import { test as base, expect } from "@playwright/test";

const PARTNER_ID = "3bf19465-d8c0-46c0-85aa-e4d17d9439a7";

const URLS = {
  owner: "/crm/warehouse/analytics",
  partners: "/crm/warehouse/partners/analytics",
  partner: `/crm/warehouse/partners/${PARTNER_ID}/analytics`,
};

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим
// исходники Vite вроде http://localhost:3000/src/api/warehouse.js.
const apiPath = (path) =>
  new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

const API = {
  any: /^https?:\/\/[^/]+\/api\//,
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  ownerAnalytics: apiPath("warehouse/owner/analytics/"),
  partnersAnalytics: apiPath("warehouse/owner/partners/analytics/"),
  partnerAnalytics: apiPath("warehouse/owner/partners/[^/?]+/analytics/"),
  activePartners: apiPath("warehouse/stock-partnerships/active/"),
};

/* ------------------------------------------------------------------------ */
/* Тестовые данные                                                          */
/* ------------------------------------------------------------------------ */

const PROFILE = {
  id: "e2e-owner",
  user_id: "e2e-owner",
  email: "owner@e2e.test",
  first_name: "E2E",
  last_name: "Owner",
  role: "owner",
  company: "E2E Company",
};

const futureDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const COMPANY = {
  id: "e2e-company",
  name: "E2E Company",
  end_date: futureDate(),
  sector: { id: "s-wh", name: "Склад" },
  industry: { id: "i-wh", name: "Склад" },
  // Не «Старт» — иначе KPI/колонки продаж агентов скрыты тарифом.
  subscription_plan: { id: "p-pro", name: "Про" },
};

/** Форматирование чисел ровно как во фронте (formatNum → Intl ru-RU). */
const ru = (n) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);

/** Локальная дата YYYY-MM-DD (как toLocalISODate во фронте). */
const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const makeWarehouses = (n) =>
  Array.from({ length: n }, (_, i) => ({
    warehouse_id: `wh-${i + 1}`,
    warehouse_name: `Склад №${i + 1}`,
    requests_approved: i,
    items_approved: i * 2,
    sales_count: i * 3,
    sales_amount: i * 1000,
    warehouse_on_hand_qty: 100 + i,
    warehouse_on_hand_amount: 50_000 + i,
    warehouse_on_hand_purchase_amount: 40_000 + i,
    agent_on_hand_qty: i,
  }));

const makeProducts = (n) =>
  Array.from({ length: n }, (_, i) => ({
    product_id: `p-${i + 1}`,
    product_name: `Товар ${i + 1}`,
    qty: i + 1,
    amount: (i + 1) * 150,
  }));

const makeSalesByDate = (n) => {
  const start = new Date();
  start.setDate(start.getDate() - n);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: localISO(d), sum: 1000 + i * 10, count: 1 + (i % 7) };
  });
};

/**
 * Ответ owner/analytics и partners/{id}/analytics (формат одинаковый).
 * money_net_amount намеренно НЕ передаём: фронт обязан сам посчитать
 * «Сальдо» = приход − расход. Это и есть клиентский расчёт, который проверяем.
 */
const ownerAnalytics = (overrides = {}) => ({
  period: "month",
  date_from: localISO(new Date(Date.now() - 30 * 864e5)),
  date_to: localISO(),
  summary: {
    requests_approved: 42,
    items_approved: 1234,
    sales_count: 87,
    sales_amount: 1_250_000,
    money_docs_count: 15,
    money_receipt_amount: 300_000,
    money_expense_amount: 120_500,
    money_debt_receipt_amount: 10_000,
    money_debt_expense_amount: 2_000,
    money_counterparty_receipt_amount: 5_000,
    money_counterparty_expense_amount: 1_000,
    warehouse_on_hand_qty: 5000,
    warehouse_on_hand_amount: 2_500_000,
    agent_on_hand_qty: 320,
    agent_on_hand_amount: 96_000,
    ...overrides.summary,
  },
  charts: {
    sales_by_date: makeSalesByDate(7),
    money_by_date: [],
    ...overrides.charts,
  },
  top_agents: { by_sales: [], by_received: [], ...overrides.top_agents },
  details: {
    warehouses: makeWarehouses(12), // 12 > pageSize(10) → есть пагинация
    sales_by_product: makeProducts(3),
    ...overrides.details,
  },
});

const partnersList = (n = 2) => ({
  partners: Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? PARTNER_ID : `partner-${i}`,
    name: i === 0 ? "ОсОО Партнёр Альфа" : `Партнёр ${i}`,
  })),
});

const partnersAnalytics = (n = 2) => ({
  date_from: localISO(new Date(Date.now() - 30 * 864e5)),
  date_to: localISO(),
  partners: Array.from({ length: n }, (_, i) => ({
    partner_company_id: i === 0 ? PARTNER_ID : `partner-${i}`,
    partner_company_name: i === 0 ? "ОсОО Партнёр Альфа" : `Партнёр ${i}`,
    summary: {
      requests_approved: 10 + i,
      items_approved: 200 + i,
      sales_count: 30 + i,
      sales_amount: 450_000 + i,
      warehouse_on_hand_qty: 700 + i,
      warehouse_on_hand_amount: 350_000 + i,
      agent_on_hand_qty: 40 + i,
      money_receipt_amount: 100_000,
      money_expense_amount: 25_000,
      money_net_amount: 75_000,
      money_counterparty_net_amount: 3_000,
    },
  })),
});

const partnerAnalytics = (overrides = {}) => ({
  ...ownerAnalytics(overrides),
  partner_company: { id: PARTNER_ID, name: "ОсОО Партнёр Альфа" },
  all_branches: true,
  partner_branches: [
    { id: "br-1", name: "Филиал Бишкек" },
    { id: "br-2", name: "Филиал Ош" },
  ],
  ...overrides.root,
});

/* ------------------------------------------------------------------------ */
/* Мок бэкенда                                                              */
/* ------------------------------------------------------------------------ */

const json = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Поднимает фейковый бэкенд и возвращает журнал запросов к аналитике.
 * Конкретный тест может переопределить ответ через `api.on(name, handler)` —
 * обработчик получает (route, url) и должен сам вызвать fulfill/abort.
 */
async function mockBackend(page) {
  const calls = {
    ownerAnalytics: /** @type {URL[]} */ ([]),
    partnersAnalytics: /** @type {URL[]} */ ([]),
    partnerAnalytics: /** @type {URL[]} */ ([]),
    activePartners: /** @type {URL[]} */ ([]),
  };
  /** @type {Record<string, (route: import('@playwright/test').Route, url: URL) => any>} */
  const handlers = {
    ownerAnalytics: (route) => json(route, ownerAnalytics()),
    partnersAnalytics: (route) => json(route, partnersAnalytics()),
    partnerAnalytics: (route) => json(route, partnerAnalytics()),
    activePartners: (route) => json(route, partnersList()),
  };

  // Токены — до загрузки приложения, иначе AuthGuard уведёт на /login.
  await page.addInitScript(() => {
    localStorage.setItem("accessToken", "e2e-access-token");
    localStorage.setItem("refreshToken", "e2e-refresh-token");
  });

  // WebSocket уведомлений/чатов: не подключаемся к боевому серверу.
  await page.routeWebSocket(/.*/, () => {});

  // Всё, что не замокано явно, — безопасная пустая пагинированная выдача.
  // Маршруты, добавленные позже, имеют приоритет над этим catch-all.
  await page.route(API.any, (route) =>
    json(route, { count: 0, next: null, previous: null, results: [] }),
  );
  await page.route(API.profile, (route) => json(route, PROFILE));
  await page.route(API.company, (route) => json(route, COMPANY));

  for (const name of Object.keys(calls)) {
    await page.route(API[name], async (route) => {
      const url = new URL(route.request().url());
      calls[name].push(url);
      return handlers[name](route, url);
    });
  }

  return {
    calls,
    /** @param {keyof typeof handlers} name */
    on(name, handler) {
      handlers[name] = handler;
    },
  };
}

/**
 * Фикстуры:
 *  - `api`        — замоканный бэкенд (поднимается до page.goto в каждом тесте);
 *  - `pageErrors` — необработанные исключения страницы. Любой крэш React
 *                   (белый экран) валит тест в teardown, даже если сам тест
 *                   его не заметил.
 */
const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      /** @type {string[]} */
      const errors = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "необработанные исключения на странице").toEqual([]);
    },
    { auto: true },
  ],
  // auto: моки поднимаются в КАЖДОМ тесте, даже если он не трогает `api`,
  // иначе страница уйдёт на боевой бэк и редиректнет на /login.
  api: [
    async ({ page }, use) => {
      await use(await mockBackend(page));
    },
    { auto: true },
  ],
});

/**
 * Санити-проверка: по baseURL отвечает именно NUR CRM. На порту может
 * оказаться чужой dev-сервер (например, nurcrm-market) — тогда все тесты
 * падали бы с непонятными таймаутами. Падаем сразу и с понятным текстом.
 */
test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get("/").catch((e) => {
    throw new Error(`Фронт не отвечает по ${baseURL}: ${e.message}`);
  });
  const html = await res.text();
  expect(
    html,
    `По ${baseURL} отвечает не NUR CRM (ожидался <title>NurCrm</title>). ` +
      "Проверьте, не занят ли порт другим проектом, или задайте E2E_BASE_URL.",
  ).toContain("<title>NurCrm</title>");
});

/* ------------------------------------------------------------------------ */
/* Хелперы для UI                                                           */
/* ------------------------------------------------------------------------ */

/** KPI-карточка: подпись и значение лежат в одном родителе. */
// Подпись — div; .and(div) отсекает одноимённые <th> таблиц и легенды графиков.
const kpi = (page, label) =>
  page.getByText(label, { exact: true }).and(page.locator("div")).locator("..");

const refreshBtn = (page) => page.getByRole("button", { name: "Обновить" });
const periodTab = (page, name) =>
  page.getByRole("tablist", { name: "Период" }).getByRole("tab", { name });

/** Кнопка аккордеона (у неё в имени ещё и бейдж-счётчик). */
const accordion = (page, title) =>
  page.getByRole("button", { name: new RegExp(`^${title}`) });

/** Таблица внутри раскрытого аккордеона. */
const accordionTable = (page, title) =>
  page.getByRole("region", { name: new RegExp(`^${title}`) }).getByRole("table");

/** Страница отрисовалась (не белый экран): заголовок h2 на месте. */
async function expectPageAlive(page, heading) {
  // Запас по времени: в dev-режиме Vite компилирует ленивые чанки при первом заходе.
  // .last(): Layout дублирует название раздела в своей шапке (тоже h2).
  await expect(page.getByRole("heading", { level: 2, name: heading }).last()).toBeVisible({
    timeout: 15_000,
  });
}

/** Типичные артефакты небезопасного рендера чисел/объектов. */
async function expectNoRenderGarbage(page) {
  const text = await page.locator("main, #root").first().innerText();
  expect(text).not.toMatch(/\bNaN\b/);
  expect(text).not.toMatch(/\bundefined\b/);
  expect(text).not.toContain("[object Object]");
  expect(text).not.toMatch(/\bInfinity\b/);
}

/* ======================================================================== */
/* 1. ХЕППИ-ПАТ: бизнес-логика                                              */
/* ======================================================================== */

test.describe("1. Хеппи-пат: аналитика склада (/crm/warehouse/analytics)", () => {
  test("первичная загрузка: запрос за текущий месяц и корректные KPI", async ({
    page,
    api,
  }) => {
    // Заходим на страницу и ждём ровно тот GET, который строит дашборд.
    const req = page.waitForRequest(API.ownerAnalytics);
    await page.goto(URLS.owner);
    const url = new URL((await req).url());

    // Период по умолчанию — «Месяц», дата — сегодняшняя ЛОКАЛЬНАЯ дата
    // (регрессия: toISOString() в UTC+6 давал «вчера» до 06:00).
    expect(url.searchParams.get("period")).toBe("month");
    expect(url.searchParams.get("date")).toBe(localISO());

    await expectPageAlive(page, "Аналитика склада");
    await expect(periodTab(page, "Месяц")).toHaveAttribute("aria-selected", "true");

    // KPI из summary, отформатированные по ru-RU (неразрывные пробелы).
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
    await expect(kpi(page, "Выдано агентам, шт")).toContainText(ru(1234));
    await expect(kpi(page, "Сумма продаж")).toContainText(`${ru(1_250_000)} сом`);
    await expect(kpi(page, "На складах, шт")).toContainText(ru(5000));
    // Ровно один ЛОГИЧЕСКИЙ запрос. В dev React.StrictMode (src/main.jsx)
    // монтирует эффекты дважды → допускаем 2 одинаковых GET, но не больше.
    const unique = new Set(api.calls.ownerAnalytics.map(String));
    expect(unique.size).toBe(1);
    expect(api.calls.ownerAnalytics.length).toBeLessThanOrEqual(2);
    await expectNoRenderGarbage(page);
  });

  test("клиентские расчёты по кассе: сальдо и «всего» считаются на фронте", async ({
    page,
  }) => {
    // money_net_amount в ответе нет → «Сальдо» = 300 000 − 120 500.
    // «Всего пришло» = касса + долги + взаиморасчёты = 300 000 + 10 000 + 5 000.
    // «Всего вышло»  = 120 500 + 2 000 + 1 000.
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");

    await expect(kpi(page, "Сальдо")).toContainText(`${ru(179_500)} сом`);
    await expect(kpi(page, "Нетто по долгам")).toContainText(`${ru(8_000)} сом`);
    await expect(kpi(page, "Нетто по взаиморасчётам")).toContainText(
      `${ru(4_000)} сом`,
    );
    await expect(kpi(page, "Всего пришло в кассу")).toContainText(
      `${ru(315_000)} сом`,
    );
    await expect(kpi(page, "Всего вышло из кассы")).toContainText(
      `${ru(123_500)} сом`,
    );
  });

  test("смена периода (табы) перезапрашивает данные и обновляет KPI", async ({
    page,
    api,
  }) => {
    // Для недели отдаём другие цифры, чтобы увидеть, что UI реально перерисовался.
    api.on("ownerAnalytics", (route, url) =>
      json(
        route,
        url.searchParams.get("period") === "week"
          ? ownerAnalytics({ summary: { requests_approved: 7, items_approved: 99 } })
          : ownerAnalytics(),
      ),
    );
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");

    const req = page.waitForRequest(
      (r) => API.ownerAnalytics.test(r.url()) && r.url().includes("period=week"),
    );
    await periodTab(page, "Неделя").click();
    await req;

    await expect(periodTab(page, "Неделя")).toHaveAttribute("aria-selected", "true");
    await expect(periodTab(page, "Месяц")).toHaveAttribute("aria-selected", "false");
    await expect(kpi(page, "Одобрено заявок")).toContainText("7");
    await expect(kpi(page, "Выдано агентам, шт")).toContainText("99");
  });

  test("произвольный период: поля «С/По» уходят в date_from/date_to", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");

    // До выбора «Период» поля дат не показываются.
    await expect(page.getByLabel("С", { exact: true })).toHaveCount(0);
    await periodTab(page, "Период").click();

    const from = page.getByLabel("С", { exact: true });
    const to = page.getByLabel("По", { exact: true });
    await expect(from).toBeVisible();
    await expect(to).toBeVisible();

    await from.fill("2026-01-01");
    const req = page.waitForRequest(
      (r) =>
        API.ownerAnalytics.test(r.url()) &&
        r.url().includes("date_from=2026-01-01") &&
        r.url().includes("date_to=2026-01-31"),
    );
    await to.fill("2026-01-31");
    const url = new URL((await req).url());

    expect(url.searchParams.get("period")).toBe("custom");
    // Для custom параметр date не нужен — проверяем, что он не «протекает».
    expect(url.searchParams.has("date")).toBe(false);
    expect(api.calls.ownerAnalytics.length).toBeGreaterThanOrEqual(3);
  });

  test("кнопка «Обновить» перезапрашивает данные и показывает свежие цифры", async ({
    page,
    api,
  }) => {
    // Версию ответа переключаем вручную, а не счётчиком запросов:
    // в dev StrictMode делает два стартовых GET.
    let version = 1;
    api.on("ownerAnalytics", (route) =>
      json(route, ownerAnalytics({ summary: { requests_approved: version * 100 } })),
    );
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("100");

    const before = api.calls.ownerAnalytics.length;
    version = 2;
    await refreshBtn(page).click();
    await expect(kpi(page, "Одобрено заявок")).toContainText("200");
    expect(api.calls.ownerAnalytics.length - before).toBe(1);
  });

  test("аккордеон «Склады»: раскрытие, таблица и пагинация", async ({ page }) => {
    await page.goto(URLS.owner);
    const btn = accordion(page, "Склады");

    // Свёрнут по умолчанию, бейдж показывает количество складов (12).
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(btn).toContainText("12");

    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    const table = accordionTable(page, "Склады");
    await expect(table.getByRole("row")).toHaveCount(11); // заголовок + 10 строк
    await expect(table).toContainText("Склад №1");
    await expect(table).not.toContainText("Склад №11");

    // Вторая страница пагинации — оставшиеся 2 склада.
    const region = page.getByRole("region", { name: /^Склады/ });
    await region.getByRole("button", { name: "2", exact: true }).click();
    await expect(
      region.getByRole("button", { name: "2", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(table.getByRole("row")).toHaveCount(3);
    await expect(table).toContainText("Склад №12");

    // Повторный клик сворачивает панель.
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(region).toBeHidden();
  });
});

test.describe("1. Хеппи-пат: список партнёров (/crm/warehouse/partners/analytics)", () => {
  test("таблица партнёров заполняется и ведёт в детальную аналитику", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.partners);
    await expectPageAlive(page, "Аналитика партнёров");

    // Сначала грузится список активных партнёров, потом аналитика по ним.
    await expect.poll(() => api.calls.activePartners.length).toBeGreaterThan(0);
    await expect.poll(() => api.calls.partnersAnalytics.length).toBe(1);
    expect(api.calls.partnersAnalytics[0].searchParams.get("period")).toBe("month");

    const row = page.getByRole("button", { name: /ОсОО Партнёр Альфа/ });
    await expect(row).toContainText(`${ru(450_000)} сом`);
    await expect(row).toContainText(`${ru(75_000)} сом`);
    await expect(page.getByRole("button", { name: /Партнёр 1/ })).toBeVisible();

    // Клик по строке → детальная страница партнёра.
    await row.click();
    await expect(page).toHaveURL(new RegExp(`${URLS.partner}$`));
    await expectPageAlive(page, "Аналитика: ОсОО Партнёр Альфа");
  });

  test("строка партнёра открывается с клавиатуры (Enter)", async ({ page }) => {
    await page.goto(URLS.partners);
    const row = page.getByRole("button", { name: /ОсОО Партнёр Альфа/ });
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${URLS.partner}$`));
  });

  test("смена периода на «День» отправляет date и обновляет таблицу", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.partners);
    await expect(page.getByRole("button", { name: /ОсОО Партнёр Альфа/ })).toBeVisible();

    api.on("partnersAnalytics", (route) => json(route, partnersAnalytics(1)));
    const req = page.waitForRequest(
      (r) => API.partnersAnalytics.test(r.url()) && r.url().includes("period=day"),
    );
    await periodTab(page, "День").click();
    const url = new URL((await req).url());
    expect(url.searchParams.get("date")).toBe(localISO());

    // На списке партнёров для «День» есть отдельное поле «Дата».
    await expect(page.getByLabel("Дата", { exact: true })).toHaveValue(localISO());
    await expect(page.getByRole("button", { name: /Партнёр 1/ })).toHaveCount(0);
  });

  test("нет активных партнёров: понятная заглушка и ссылка на партнёрства", async ({
    page,
    api,
  }) => {
    api.on("activePartners", (route) => json(route, { partners: [] }));
    await page.goto(URLS.partners);

    await expect(page.getByText(/Нет активных партнёров/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Перейти к партнёрствам" }),
    ).toHaveAttribute("href", "/crm/warehouse/warehouses?tab=partnerships");
    // Без партнёров аналитику запрашивать бессмысленно.
    expect(api.calls.partnersAnalytics).toHaveLength(0);
  });
});

test.describe("1. Хеппи-пат: аналитика партнёра (/crm/warehouse/partners/:id/analytics)", () => {
  test("заголовок, ссылки и запрос по id партнёра из URL", async ({ page, api }) => {
    await page.goto(URLS.partner);
    await expectPageAlive(page, "Аналитика: ОсОО Партнёр Альфа");

    expect(api.calls.partnerAnalytics[0].pathname).toContain(
      `/warehouse/owner/partners/${PARTNER_ID}/analytics/`,
    );
    await expect(page.getByText("Все филиалы партнёра")).toBeVisible();
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");

    await expect(
      page.getByRole("link", { name: "История продаж" }),
    ).toHaveAttribute("href", `/crm/warehouse/partners/${PARTNER_ID}/sales`);

    await page.getByRole("link", { name: "К списку партнёров" }).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.partners}$`));
  });

  test("выбор филиала: query-параметр в URL, в запросе и в ссылке истории", async ({
    page,
    api,
  }) => {
    api.on("partnerAnalytics", (route, url) => {
      const branch = url.searchParams.get("partner_branch");
      return json(
        route,
        branch
          ? partnerAnalytics({
              summary: { requests_approved: 5 },
              root: { all_branches: false, branch_id: branch },
            })
          : partnerAnalytics(),
      );
    });
    await page.goto(URLS.partner);

    const select = page.getByLabel("Филиал партнёра");
    await expect(select).toBeEnabled();
    const req = page.waitForRequest(
      (r) => API.partnerAnalytics.test(r.url()) && r.url().includes("partner_branch=br-2"),
    );
    await select.selectOption({ label: "Филиал Ош" });
    await req;

    await expect(page).toHaveURL(/partner_branch=br-2/);
    await expect(page.getByText("Филиал: Филиал Ош")).toBeVisible();
    await expect(kpi(page, "Одобрено заявок")).toContainText("5");
    await expect(
      page.getByRole("link", { name: "История продаж" }),
    ).toHaveAttribute("href", /partner_branch=br-2/);

    // Возврат к «Все филиалы» убирает параметр.
    await page.getByLabel("Филиал партнёра").selectOption({ label: "Все филиалы" });
    await expect(page).not.toHaveURL(/partner_branch=/);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
  });
});

/* ======================================================================== */
/* 2. ЗАЩИТА ОТ ДУРАКА                                                      */
/* ======================================================================== */

test.describe("2. Защита от дурака", () => {
  test("тройной клик по «Обновить»: кнопка блокируется, уходит ОДИН запрос", async ({
    page,
    api,
  }) => {
    // Медленный бэк, чтобы окно «в полёте» было заметным.
    api.on("ownerAnalytics", async (route) => {
      await delay(800);
      return json(route, ownerAnalytics());
    });
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
    const before = api.calls.ownerAnalytics.length;

    // clickCount: 3 — три реальных клика мышью подряд без пауз (как «дятел»).
    await refreshBtn(page).click({ clickCount: 3 });

    await expect(refreshBtn(page)).toBeDisabled();
    await expect(page.getByText("Загрузка…")).toBeVisible();
    await expect(refreshBtn(page)).toBeEnabled({ timeout: 5_000 });

    expect(api.calls.ownerAnalytics.length - before).toBe(1);
  });

  test("быстрое переключение периодов: побеждает последний выбор, а не самый медленный ответ", async ({
    page,
    api,
  }) => {
    // Регрессия: раньше поздний ответ «День» перетирал уже показанную «Неделю»
    // (таб «Неделя», а цифры дневные). Теперь load() игнорирует ответы на
    // устаревшие запросы (useLatestRequest).

    // «День» отвечает медленно, «Неделя» — быстро. Если фронт не отменяет
    // устаревшие запросы, поздний ответ «День» перетрёт данные «Недели».
    api.on("ownerAnalytics", async (route, url) => {
      const period = url.searchParams.get("period");
      if (period === "day") {
        await delay(1500);
        return json(route, ownerAnalytics({ summary: { requests_approved: 1 } }));
      }
      if (period === "week") {
        return json(route, ownerAnalytics({ summary: { requests_approved: 7 } }));
      }
      return json(route, ownerAnalytics());
    });
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");

    const dayResponse = page.waitForResponse(
      (r) => API.ownerAnalytics.test(r.url()) && r.url().includes("period=day"),
    );
    await periodTab(page, "День").click();
    await periodTab(page, "Неделя").click();
    await dayResponse.catch(() => {}); // запрос может быть и отменён — это ок
    await page.waitForTimeout(300);

    await expect(periodTab(page, "Неделя")).toHaveAttribute("aria-selected", "true");
    await expect(kpi(page, "Одобрено заявок")).toHaveText(/Одобрено заявок\s*7\b/);
  });

  test("пустой/инвертированный произвольный период не роняет страницу", async ({
    page,
    api,
  }) => {
    // Аналог «пустой формы»: очищаем обе даты и ставим «С» позже «По».
    // Запрос с пустыми датами не должен ломать UI; бэк вернёт 400 — фронт
    // обязан показать ошибку, а не белый экран.
    api.on("ownerAnalytics", (route, url) => {
      const from = url.searchParams.get("date_from");
      const to = url.searchParams.get("date_to");
      if (url.searchParams.get("period") === "custom" && (!from || !to || from > to)) {
        return json(route, { detail: "Некорректный период" }, 400);
      }
      return json(route, ownerAnalytics());
    });
    await page.goto(URLS.owner);
    await periodTab(page, "Период").click();

    await page.getByLabel("С", { exact: true }).fill("");
    await page.getByLabel("По", { exact: true }).fill("");
    await expect(page.getByText("Некорректный период")).toBeVisible();
    await expectPageAlive(page, "Аналитика склада");

    await page.getByLabel("С", { exact: true }).fill("2026-12-31");
    await page.getByLabel("По", { exact: true }).fill("2026-01-01");
    await expect(page.getByText("Некорректный период")).toBeVisible();
    await expect(periodTab(page, "Период")).toBeEnabled();

    // Валидный период снимает ошибку.
    await page.getByLabel("С", { exact: true }).fill("2026-01-01");
    await page.getByLabel("По", { exact: true }).fill("2026-01-31");
    await expect(page.getByText("Некорректный период")).toBeHidden();
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
  });

  test("отрицательные, строковые и пустые числа рендерятся без NaN/undefined", async ({
    page,
    api,
  }) => {
    api.on("ownerAnalytics", (route) =>
      json(
        route,
        ownerAnalytics({
          summary: {
            requests_approved: -5,
            items_approved: "abc",
            sales_amount: "-1500.5",
            money_receipt_amount: -100,
            money_expense_amount: 50,
            warehouse_on_hand_qty: "",
            agent_on_hand_qty: null,
          },
          details: {
            warehouses: [
              { warehouse_name: "Минус", sales_amount: -999, warehouse_on_hand_qty: -3 },
            ],
          },
        }),
      ),
    );
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");

    await expect(kpi(page, "Одобрено заявок")).toContainText(ru(-5));
    await expect(kpi(page, "Сумма продаж")).toContainText(`${ru(-1500.5)} сом`);
    // Сальдо = −100 − 50 = −150
    await expect(kpi(page, "Сальдо")).toContainText(`${ru(-150)} сом`);

    await accordion(page, "Склады").click();
    await expect(accordionTable(page, "Склады")).toContainText(`${ru(-999)} сом`);
    await expectNoRenderGarbage(page);
  });

  test("XSS и спецсимволы из данных бэка выводятся как текст", async ({
    page,
    api,
  }) => {
    const evil = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>{}&amp;&"'`;
    api.on("activePartners", (route) =>
      json(route, { partners: [{ id: PARTNER_ID, name: evil }] }),
    );
    api.on("partnersAnalytics", (route) => {
      const body = partnersAnalytics(1);
      body.partners[0].partner_company_name = evil;
      return json(route, body);
    });
    await page.goto(URLS.partners);

    const row = page.getByRole("button", { name: /onerror/ });
    await expect(row).toBeVisible();
    // Строка отрисована буквально — в т.ч. «&amp;» не раскодирован в «&».
    await expect(row.getByRole("cell").first()).toHaveText(evil);
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("гигантская строка в названии не ломает вёрстку и не даёт горизонтальный скролл страницы", async ({
    page,
    api,
  }) => {
    const huge = "Ж".repeat(10_000);
    const hugeWord = `ОченьДлинноеНазваниеБезПробелов${"X".repeat(5_000)}`;
    api.on("ownerAnalytics", (route) =>
      json(
        route,
        ownerAnalytics({
          details: {
            warehouses: [
              { warehouse_name: huge, sales_amount: 1 },
              { warehouse_name: hugeWord, sales_amount: 2 },
            ],
          },
        }),
      ),
    );
    await page.goto(URLS.owner);
    await accordion(page, "Склады").click();
    await expect(accordionTable(page, "Склады")).toContainText("ЖЖЖЖ");

    // Таблица может скроллиться внутри своей обёртки, но не вся страница.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Шапка с контролами не уехала вбок: длинная строка не растянула контейнер.
    // (Страница скроллится во внутреннем контейнере Layout, поэтому сначала
    // возвращаемся к кнопке, а затем проверяем её горизонтальные границы.)
    const btn = refreshBtn(page);
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport();
    const box = await btn.boundingBox();
    const vw = page.viewportSize()?.width ?? 0;
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vw);
  });

  test("пагинация на 200 страниц: до первых страниц можно доскроллить", async ({
    page,
    api,
  }) => {
    // Регрессия: раньше рисовались все 200 кнопок в один ряд с центрированием,
    // и левый край обрезался — «1», «2»… уезжали за x < 0. Теперь пагинация
    // показывает «окно» страниц (1 … 199 200) и переносится по строкам.

    api.on("ownerAnalytics", (route) =>
      json(route, ownerAnalytics({ details: { warehouses: makeWarehouses(2000) } })),
    );
    await page.goto(URLS.owner);
    await accordion(page, "Склады").click();
    const region = page.getByRole("region", { name: /^Склады/ });

    // Уходим на последнюю страницу (она справа и достижима)…
    const last = region.getByRole("button", { name: "200", exact: true });
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(accordionTable(page, "Склады")).toContainText("Склад №2000");

    // …и проверяем, что кнопка «1» не уехала левее блока пагинации.
    // Геометрия, а не клик: WebKit кликает и по элементу за краем экрана,
    // и проверка через click() давала бы в разных браузерах разный результат.
    const first = region.getByRole("button", { name: "1", exact: true });
    await first.scrollIntoViewIfNeeded();
    const firstBox = await first.boundingBox();
    const regionBox = await region.boundingBox();
    expect(firstBox?.x ?? -Infinity).toBeGreaterThanOrEqual(regionBox?.x ?? 0);
  });

  test("мусорный partner_branch в URL уходит закодированным и не исполняется", async ({
    page,
    api,
  }) => {
    const payload = `"><script>window.__xss=1</script>`;
    await page.goto(`${URLS.partner}?partner_branch=${encodeURIComponent(payload)}`);
    await expectPageAlive(page, /Аналитика:/);

    await expect.poll(() => api.calls.partnerAnalytics.length).toBeGreaterThan(0);
    expect(api.calls.partnerAnalytics[0].searchParams.get("partner_branch")).toBe(payload);
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  });

  test("несуществующий partnerId: бэк 404 → сообщение, а не белый экран", async ({
    page,
    api,
  }) => {
    api.on("partnerAnalytics", (route) =>
      json(route, { detail: "Партнёр не найден." }, 404),
    );
    await page.goto("/crm/warehouse/partners/not-a-uuid/analytics");

    // Запас на холодную компиляцию ленивого чанка в dev (как в expectPageAlive).
    await expect(page.getByText("Партнёр не найден.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "К списку партнёров" })).toBeVisible();
  });
});

/* ======================================================================== */
/* 3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: офисный ноутбук 1366×768                        */
/* ======================================================================== */

test.describe("3. Экран 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const [name, url, heading] of [
    ["склад", URLS.owner, "Аналитика склада"],
    ["список партнёров", URLS.partners, "Аналитика партнёров"],
    ["партнёр", URLS.partner, "Аналитика: ОсОО Партнёр Альфа"],
  ]) {
    test(`${name}: «Обновить» и табы периода видны без скролла`, async ({ page }) => {
      await page.goto(url);
      await expectPageAlive(page, heading);

      // Главные контролы — в первом экране, без прокрутки.
      await expect(refreshBtn(page)).toBeInViewport();
      for (const tab of ["День", "Неделя", "Месяц", "Период"]) {
        await expect(periodTab(page, tab)).toBeInViewport();
      }
      // Нет горизонтального скролла всей страницы.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("склад: нижний аккордеон доступен скроллом и раскрывается", async ({ page }) => {
    await page.goto(URLS.owner);
    const btn = accordion(page, "Склады");
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport();
    await btn.click();
    await expect(accordionTable(page, "Склады")).toBeVisible();

    // Пагинация под таблицей тоже достижима.
    const pageBtn = page
      .getByRole("region", { name: /^Склады/ })
      .getByRole("button", { name: "2", exact: true });
    await pageBtn.scrollIntoViewIfNeeded();
    await expect(pageBtn).toBeInViewport();
  });
});

/* ======================================================================== */
/* 4. СБОИ БЭКЕНДА                                                          */
/* ======================================================================== */

test.describe("4. Сбои бэкенда", () => {
  test("500 с detail: показываем «Ошибка сервера», страница жива и восстанавливается", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("ownerAnalytics", (route) =>
      fail
        ? json(route, { detail: "Ошибка сервера" }, 500)
        : json(route, ownerAnalytics()),
    );
    await page.goto(URLS.owner);

    await expect(page.getByText("Ошибка сервера")).toBeVisible();
    await expectPageAlive(page, "Аналитика склада");
    await expect(refreshBtn(page)).toBeEnabled();
    await expect(periodTab(page, "Месяц")).toBeVisible();

    // Бэк «ожил» → «Обновить» убирает ошибку и рисует данные.
    fail = false;
    await refreshBtn(page).click();
    await expect(page.getByText("Ошибка сервера")).toBeHidden();
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
  });

  test("500 с HTML от nginx: показываем запасной текст ошибки", async ({
    page,
    api,
  }) => {
    api.on("ownerAnalytics", (route) =>
      route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<html><body><h1>502 Bad Gateway</h1></body></html>",
      }),
    );
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");
    // HTML от прокси не должен вываливаться пользователю как разметка.
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
    await expect(page.getByText(/Не удалось загрузить аналитику|Request failed/)).toBeVisible();
  });

  test("обрыв сети при загрузке аналитики: сообщение и рабочие контролы", async ({
    page,
    api,
  }) => {
    api.on("ownerAnalytics", (route) => route.abort("internetdisconnected"));
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");
    await expect(page.getByText(/Network Error|Не удалось загрузить аналитику/)).toBeVisible();
    await expect(refreshBtn(page)).toBeEnabled();
  });

  test("500 на списке партнёров и на сводке партнёров обрабатываются раздельно", async ({
    page,
    api,
  }) => {
    api.on("activePartners", (route) =>
      json(route, { detail: "Ошибка сервера" }, 500),
    );
    await page.goto(URLS.partners);
    await expectPageAlive(page, "Аналитика партнёров");
    await expect(page.getByText("Ошибка сервера")).toBeVisible();
    // Партнёров «нет» → аналитику не дёргаем.
    expect(api.calls.partnersAnalytics).toHaveLength(0);

    // Партнёры загрузились, а сводка упала.
    api.on("activePartners", (route) => json(route, partnersList()));
    api.on("partnersAnalytics", (route) =>
      json(route, { detail: "Сводка недоступна" }, 500),
    );
    await refreshBtn(page).click();
    await expect(page.getByText("Сводка недоступна")).toBeVisible();
    await expect(page.getByText("Ошибка сервера")).toBeHidden();
  });

  test("500 на аналитике партнёра: ошибка видна, навигация назад работает", async ({
    page,
    api,
  }) => {
    api.on("partnerAnalytics", (route) =>
      json(route, { detail: "Ошибка сервера" }, 500),
    );
    await page.goto(URLS.partner);
    await expect(page.getByText("Ошибка сервера")).toBeVisible();
    // Имя партнёра ещё неизвестно → нейтральный заголовок.
    await expectPageAlive(page, "Аналитика: Партнёр");
    await page.getByRole("link", { name: "К списку партнёров" }).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.partners}$`));
  });

  /* ---------- null вместо данных: безопасные проверки в рендере ---------- */

  test("owner/analytics вернул null целиком — страница жива, без ошибок", async ({
    page,
    api,
  }) => {
    api.on("ownerAnalytics", (route) => json(route, null));
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");
    await expect(page.getByText("Загрузка…")).toBeHidden();
    await expect(refreshBtn(page)).toBeEnabled();
  });

  test("owner/analytics: все массивы и объекты пришли null", async ({ page, api }) => {
    api.on("ownerAnalytics", (route) =>
      json(route, {
        summary: null,
        charts: { sales_by_date: null, money_by_date: null, purchases_by_date: null },
        top_agents: { by_sales: null, by_received: null },
        details: {
          warehouses: null,
          sales_by_product: null,
          sales_by_group: null,
          cash_by_register: null,
          money_receipts_by_category: null,
          money_expenses_by_category: null,
          purchases_by_supplier: null,
          salary_by_agent: null,
          profit_by_product: null,
          profit_by_agent: null,
        },
      }),
    );
    await page.goto(URLS.owner);
    await expectPageAlive(page, "Аналитика склада");
    await expect(kpi(page, "Одобрено заявок")).toContainText("0");

    const btn = accordion(page, "Склады");
    await expect(btn).toContainText("0");
    await btn.click();
    await expect(page.getByText("Нет данных по складам за период.")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("owner/analytics: charts/details/top_agents = null на верхнем уровне", async ({
    page,
    api,
  }) => {
    api.on("ownerAnalytics", (route) =>
      json(route, { summary: { requests_approved: 3 }, charts: null, details: null, top_agents: null }),
    );
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("3");
    await expectNoRenderGarbage(page);
  });

  test("список партнёров: partners = null и в списке, и в сводке", async ({
    page,
    api,
  }) => {
    api.on("activePartners", (route) => json(route, { partners: null }));
    await page.goto(URLS.partners);
    await expect(page.getByText(/Нет активных партнёров/)).toBeVisible();

    api.on("activePartners", (route) => json(route, partnersList()));
    api.on("partnersAnalytics", (route) => json(route, { partners: null }));
    await refreshBtn(page).click();
    await expect(page.getByText("Нет данных за выбранный период.")).toBeVisible();
  });

  test("список партнёров: summary партнёра = null", async ({ page, api }) => {
    api.on("partnersAnalytics", (route) =>
      json(route, {
        partners: [{ partner_company_id: PARTNER_ID, partner_company_name: "Пустой", summary: null }],
      }),
    );
    await page.goto(URLS.partners);
    const row = page.getByRole("button", { name: /Пустой/ });
    await expect(row).toBeVisible();
    // Без summary — прочерки, а не NaN.
    await expect(row).toContainText("—");
    await expectNoRenderGarbage(page);
  });

  test("аналитика партнёра: partner_branches/partner_company = null", async ({
    page,
    api,
  }) => {
    api.on("partnerAnalytics", (route) =>
      json(route, {
        ...ownerAnalytics(),
        partner_company: null,
        partner_branches: null,
        all_branches: null,
      }),
    );
    await page.goto(URLS.partner);
    await expectPageAlive(page, "Аналитика: Партнёр");
    // Без списка филиалов select не рендерится.
    await expect(page.getByLabel("Филиал партнёра")).toHaveCount(0);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
  });
});

/* ======================================================================== */
/* 5. СТРЕСС-ТЕСТ И ПРОИЗВОДИТЕЛЬНОСТЬ                                      */
/* ======================================================================== */

test.describe("5. Стресс и производительность", () => {
  // Генерация и рендер больших данных — даём запас на медленные CI.
  test.slow();

  /**
   * Бюджет времени с поправкой на параллельный прогон: когда несколько
   * воркеров одновременно гоняют три браузера, CPU делится, и абсолютные
   * замеры раздуваются в разы. Строгий замер — с --workers=1.
   */
  const perfBudget = (ms) => (test.info().config.workers > 1 ? ms * 3 : ms);

  test("Big Data: 5000 складов, 5000 товаров, 2000 точек графика", async ({
    page,
    api,
  }) => {
    const big = ownerAnalytics({
      summary: { requests_approved: 4242 },
      charts: { sales_by_date: makeSalesByDate(2000) },
      details: { warehouses: makeWarehouses(5000), sales_by_product: makeProducts(5000) },
    });

    // Сначала открываем страницу с обычными данными: так в замер не попадёт
    // компиляция чанков Vite при первом заходе (в Firefox это до 10+ с).
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");

    // Меряем именно рендер тяжёлого ответа: от «Обновить» до новых KPI.
    api.on("ownerAnalytics", (route) => json(route, big));
    const t0 = Date.now();
    await refreshBtn(page).click();
    await expect(kpi(page, "Одобрено заявок")).toContainText(ru(4242), { timeout: 15_000 });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 5000 rows, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(15_000));

    // Бейдж честно показывает весь объём.
    const btn = accordion(page, "Склады");
    await expect(btn).toContainText("5000");

    // Раскрытие: отрисована только текущая страница (10 строк), а не 5000.
    await btn.click();
    const table = accordionTable(page, "Склады");
    await expect(table.getByRole("row")).toHaveCount(11);

    // Последняя страница пагинации (500) кликается и показывает последний склад.
    const region = page.getByRole("region", { name: /^Склады/ });
    const last = region.getByRole("button", { name: "500", exact: true });
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(table).toContainText("Склад №5000");

    // UI остаётся отзывчивым: табы переключаются, «Обновить» работает.
    await periodTab(page, "Неделя").click();
    await expect(periodTab(page, "Неделя")).toHaveAttribute("aria-selected", "true");
    await expect(refreshBtn(page)).toBeEnabled({ timeout: 10_000 });
    await refreshBtn(page).click();
    await expect(kpi(page, "Одобрено заявок")).toContainText("42");
  });

  test("Big Data: 3000 партнёров в таблице сводки", async ({ page, api }) => {
    const N = 3000;
    api.on("activePartners", (route) => json(route, partnersList(N)));
    api.on("partnersAnalytics", (route) => json(route, partnersAnalytics(N)));

    const t0 = Date.now();
    await page.goto(URLS.partners);
    // Таблица без пагинации — рендерятся все строки (+ строка заголовка).
    // Строки таблицы имеют role="button" (кликабельны), поэтому считаем их так.
    await expect(page.getByRole("table").getByRole("button")).toHaveCount(N, {
      timeout: 20_000,
    });
    test.info().annotations.push({
      type: "render 3000 partners, ms",
      description: String(Date.now() - t0),
    });

    // Последний партнёр доступен скроллом и кликается.
    const lastRow = page.getByRole("button", { name: new RegExp(`Партнёр ${N - 1}\\b`) });
    await lastRow.scrollIntoViewIfNeeded();
    await lastRow.click();
    await expect(page).toHaveURL(/\/partners\/partner-2999\/analytics$/);
  });

  /* ---------- CPU ×6 через Chrome DevTools Protocol ---------- */

  /** «Тяжёлый» ответ: год точек на графике и по 2000 строк в таблицах. */
  const heavyAnalytics = () =>
    ownerAnalytics({
      charts: { sales_by_date: makeSalesByDate(365) },
      details: { warehouses: makeWarehouses(2000), sales_by_product: makeProducts(2000) },
    });

  /**
   * Замедляет CPU страницы в `rate` раз и включает журнал long tasks
   * (блокировки главного потока > 50 мс) в window.__longTasks.
   */
  async function throttleCpu(page, rate) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await page.addInitScript(() => {
      /** @type {any} */ (window).__longTasks = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            /** @type {any} */ (window).__longTasks.push(e.duration);
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        /* longtask не поддерживается */
      }
    });
    return cdp;
  }

  const resetLongTasks = (page) =>
    page.evaluate(() => {
      /** @type {any} */ (window).__longTasks = [];
    });
  const maxLongTask = (page) =>
    page.evaluate(() => Math.max(0, .../** @type {any} */ (window).__longTasks));

  /** Время от действия до видимого результата, мс. */
  async function measure(action, done) {
    const t = Date.now();
    await action();
    await done();
    return Date.now() - t;
  }

  test("CPU ×6 (CDP): загрузка, аккордеон и пагинация укладываются в бюджет", async ({
    page,
    api,
    browserName,
  }) => {
    // Emulation.setCPUThrottlingRate есть только в Chromium.
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    api.on("ownerAnalytics", (route) => json(route, heavyAnalytics()));
    const cdp = await throttleCpu(page, 6);

    const loadMs = await measure(
      () => page.goto(URLS.owner),
      () => expect(kpi(page, "Одобрено заявок")).toContainText("42", { timeout: 30_000 }),
    );

    // Дальше меряем только взаимодействия, без стартовой загрузки.
    await resetLongTasks(page);

    const accordionMs = await measure(
      () => accordion(page, "Склады").click(),
      () => expect(accordionTable(page, "Склады").getByRole("row")).toHaveCount(11),
    );
    // Последняя страница: левые кнопки при 200 страницах недостижимы
    // (см. тест «пагинация на 200 страниц» в разделе 2).
    const pagerMs = await measure(
      async () => {
        const last = page
          .getByRole("region", { name: /^Склады/ })
          .getByRole("button", { name: "200", exact: true });
        await last.scrollIntoViewIfNeeded();
        await last.click();
      },
      () => expect(accordionTable(page, "Склады")).toContainText("Склад №2000"),
    );
    // Аккордеон «Продажи по товарам» (2000 строк): переключается быстро.
    const products = accordion(page, "Продажи по товарам");
    const wasOpen = (await products.getAttribute("aria-expanded")) === "true";
    const productsMs = await measure(
      () => products.click(),
      () => expect(products).toHaveAttribute("aria-expanded", String(!wasOpen)),
    );
    const longTask = await maxLongTask(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6, ms",
      description: JSON.stringify({ loadMs, accordionMs, pagerMs, productsMs, longTask }),
    });

    // Бюджеты с запасом под ×6: интерфейс не «замерзает» на секунды.
    // Замер на M-серии Mac: load ≈ 4 с, аккордеон ≈ 0.2 с, пагинация ≈ 0.3 с.
    expect(loadMs).toBeLessThan(15_000);
    expect(accordionMs).toBeLessThan(1_500);
    expect(pagerMs).toBeLessThan(1_500);
    expect(productsMs).toBeLessThan(1_500);
    expect(longTask).toBeLessThan(1_000);
  });

  test("CPU ×6 (CDP): переключение периода на тяжёлых данных без фриза", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    // Регрессия производительности. Было (×6, M-серия Mac): клик по табу ≈ 4.4 с,
    // long task ≈ 2 с. Причины: formatNum создавал new Intl.NumberFormat на
    // каждую ячейку (десятки тысяч раз), контент не был мемоизирован и на время
    // загрузки размонтировался. Стало: клик ≈ 0.35 с, long task ≈ 0.16 с.

    api.on("ownerAnalytics", (route) => json(route, heavyAnalytics()));
    const cdp = await throttleCpu(page, 6);
    await page.goto(URLS.owner);
    await expect(kpi(page, "Одобрено заявок")).toContainText("42", { timeout: 30_000 });
    await resetLongTasks(page);

    const tabMs = await measure(
      () => periodTab(page, "Неделя").click(),
      () => expect(periodTab(page, "Неделя")).toHaveAttribute("aria-selected", "true"),
    );
    const refetchMs = await measure(
      () => Promise.resolve(),
      () => expect(kpi(page, "Одобрено заявок")).toContainText("42", { timeout: 30_000 }),
    );
    const longTask = await maxLongTask(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 period switch, ms",
      description: JSON.stringify({ tabMs, refetchMs, longTask }),
    });

    // Отклик на клик (подсветка таба) — не дольше 1 с даже на слабом CPU,
    // главный поток не блокируется дольше 1 с подряд.
    expect(tabMs).toBeLessThan(1_000);
    expect(longTask).toBeLessThan(1_000);
  });
});
