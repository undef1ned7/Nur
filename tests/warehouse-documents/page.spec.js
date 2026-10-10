// @ts-check
/**
 * E2E: складские документы.
 *
 *   /crm/warehouse/documents/          → редирект на /all — список документов (Documents.jsx)
 *   /crm/warehouse/documents/create    — создание документа (CreateSaleDocument.jsx)
 *   /crm/warehouse/documents/money/... — денежные документы (MoneyDocumentsPage.jsx)
 *
 * Про URL денежных документов: маршрут — `money/:docType` (receipt | expense).
 * «Голый» /crm/warehouse/documents/money/ под него НЕ попадает: его ловит
 * `:docType` = "money", и открывается обычный список (откат на «Все»). Тесты
 * проверяют и это поведение, и настоящие страницы /money/receipt и /money/expense.
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** + routeWebSocket):
 * по умолчанию фронт ходит на боевой https://app.nurcrm.kg/api. Логин не нужен —
 * токен кладётся в localStorage, профиль — владелец компании сектора «Склад».
 *
 * Как UI сообщает о результате (важно для проверок):
 *  - список и форма создания — React-модалка alert (role="dialog", кнопка «Ок»)
 *    и confirm («Подтвердите ваше действие», кнопки «Отменить»/«Подтвердить»);
 *  - денежные документы — ошибки формы внутри модалки, а успех проведения и
 *    ошибки действий — НАТИВНЫЙ window.alert (ловим через page.on("dialog")).
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer
 * в playwright.config.js):
 *   npx playwright test tests/warehouse-documents --project=chromium
 * Другой адрес фронта — через E2E_BASE_URL.
 */
import { test as base, expect } from "@playwright/test";

const URLS = {
  documents: "/crm/warehouse/documents/",
  documentsAll: "/crm/warehouse/documents/all",
  documentsSale: "/crm/warehouse/documents/sale",
  create: "/crm/warehouse/documents/create",
  moneyBare: "/crm/warehouse/documents/money/",
  moneyReceipt: "/crm/warehouse/documents/money/receipt",
  moneyExpense: "/crm/warehouse/documents/money/expense",
};

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим
// исходники Vite вроде http://localhost:3100/src/api/warehouse.js.
const apiPath = (path) => new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

/**
 * Реестр замоканных эндпоинтов. Порядок важен: Playwright проверяет маршруты
 * в обратном порядке регистрации, поэтому более специфичные идут НИЖЕ.
 */
const ENDPOINTS = {
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  employees: apiPath("users/employees/"),
  warehouses: apiPath("warehouse/crud/warehouses/"),
  counterparties: apiPath("warehouse/crud/counterparties/"),
  // Список документов: GET warehouse/documents/
  documents: apiPath("warehouse/documents/"),
  // POST warehouse/documents/{sale|purchase|...}/ — создание;
  // GET/DELETE/PUT warehouse/documents/{id}/ — документ по id.
  documentItem: apiPath("warehouse/documents/[^/?]+/"),
  documentPost: apiPath("warehouse/documents/[^/?]+/post/"),
  documentUnpost: apiPath("warehouse/documents/[^/?]+/unpost/"),
  // Каталог: поиск по всем складам и товары конкретного склада.
  productsSearch: apiPath("warehouse/products/"),
  warehouseProducts: apiPath("warehouse/[^/?]+/products/"),
  groups: apiPath("warehouse/[^/?]+/groups/"),
  // Деньги
  cashRegisters: apiPath("warehouse/cash-registers/"),
  moneyCategories: apiPath("warehouse/money/categories/"),
  moneyDocuments: apiPath("warehouse/money/documents/"),
  moneyItem: apiPath("warehouse/money/documents/[^/?]+/"),
  moneyPost: apiPath("warehouse/money/documents/[^/?]+/post/"),
};

/* ------------------------------------------------------------------------ */
/* Тестовые данные                                                          */
/* ------------------------------------------------------------------------ */

const futureDate = () => {
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

const WAREHOUSES = [
  { id: "wh-1", name: "Основной склад", address: "Бишкек" },
  { id: "wh-2", name: "Склад №2", address: "Ош" },
];

const COUNTERPARTIES = [
  { id: "cp-1", name: "ОсОО Клиент", type: "CLIENT" },
  { id: "cp-2", name: "ОсОО Поставщик", type: "SUPPLIER" },
  { id: "cp-3", name: "ИП Универсал", type: "BOTH" },
];

const PRODUCTS = [
  {
    id: "p-1",
    name: "Молоко 1л",
    unit: "шт",
    price: "150.00",
    purchase_price: "100.00",
    quantity: "50",
    warehouse: "wh-1",
    warehouse_name: "Основной склад",
    product_group: null,
  },
  {
    id: "p-2",
    name: "Хлеб белый",
    unit: "шт",
    price: "40.00",
    purchase_price: "25.00",
    quantity: "200",
    warehouse: "wh-1",
    warehouse_name: "Основной склад",
    product_group: null,
  },
];

const paginated = (results) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

/** Складской документ для списка. */
const makeDoc = (i, overrides = {}) => ({
  id: `doc-${i}`,
  number: `ПР-${String(i).padStart(5, "0")}`,
  doc_type: "SALE",
  status: i % 2 ? "DRAFT" : "POSTED",
  date: "2026-10-01T10:30:00+06:00",
  counterparty: { id: "cp-1", name: `Клиент ${i}` },
  items: [{ product: "p-1", qty: "2", price: "617.28" }],
  total: "1234.56",
  discount_percent: "0",
  discount_amount: "0",
  payment_kind: "cash",
  ...overrides,
});
const makeDocs = (n, overrides) =>
  Array.from({ length: n }, (_, i) => makeDoc(i + 1, overrides));

const CASH_REGISTERS = [
  { id: "cr-1", name: "Касса магазина" },
  { id: "cr-2", name: "Расчётный счёт" },
];
const MONEY_CATEGORIES = [
  { id: "mc-1", title: "Оплата от клиента" },
  { id: "mc-2", title: "Аренда" },
];

const makeMoneyDoc = (i, overrides = {}) => ({
  id: `md-${i}`,
  number: `ПКО-${i}`,
  doc_type: "MONEY_RECEIPT",
  date: "2026-10-01T09:00:00+06:00",
  counterparty_display_name: `Контрагент ${i}`,
  payment_category_title: "Оплата от клиента",
  amount: String(1000 + i),
  status: i % 2 ? "DRAFT" : "POSTED",
  comment: `Комментарий ${i}`,
  ...overrides,
});
const makeMoneyDocs = (n, overrides) =>
  Array.from({ length: n }, (_, i) => makeMoneyDoc(i + 1, overrides));

/** Сумма как во фронте документов: 2 знака + « сом» (U+00A0 в тысячах). */
const som = (n) =>
  `${Number(n).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} сом`;

/** Сумма как в денежных документах: 0–2 знака + « сом». */
const somShort = (n) =>
  `${Number(n).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} сом`;

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

/** Тело запроса как объект (или null). */
const bodyOf = (request) => {
  try {
    return request.postDataJSON();
  } catch {
    return request.postData();
  }
};

/**
 * Поднимает фейковый бэкенд. Возвращает:
 *  - `on(name, handler)` — переопределить ответ эндпоинта; handler получает
 *    (route, { method, url, body }) и сам вызывает fulfill/abort;
 *  - `calls(name, method?)` — журнал запросов к эндпоинту.
 */
async function mockBackend(page) {
  /** @type {Record<string, {method: string, url: URL, body: any}[]>} */
  const log = {};
  let createdSeq = 0;

  /** @type {Record<string, (route: import('@playwright/test').Route, req: {method: string, url: URL, body: any}) => any>} */
  const handlers = {
    profile: (route) => json(route, PROFILE),
    company: (route) => json(route, COMPANY),
    employees: (route) => json(route, paginated([])),
    warehouses: (route) => json(route, paginated(WAREHOUSES)),
    counterparties: (route) => json(route, paginated(COUNTERPARTIES)),
    documents: (route) => json(route, paginated(makeDocs(3))),
    documentItem: (route, { method, url }) => {
      if (method === "POST") {
        // Создание: POST warehouse/documents/sale/ и т.п.
        createdSeq += 1;
        return json(route, { id: `new-doc-${createdSeq}`, status: "DRAFT" }, 201);
      }
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
      const id = url.pathname.split("/").filter(Boolean).pop();
      return json(route, makeDoc(1, { id }));
    },
    documentPost: (route, { url }) => {
      const id = url.pathname.split("/").filter(Boolean).at(-2);
      return json(route, { id, status: "POSTED" });
    },
    documentUnpost: (route, { url }) => {
      const id = url.pathname.split("/").filter(Boolean).at(-2);
      return json(route, { id, status: "DRAFT" });
    },
    productsSearch: (route) => json(route, paginated(PRODUCTS)),
    warehouseProducts: (route) => json(route, paginated(PRODUCTS)),
    groups: (route) => json(route, []),
    cashRegisters: (route) => json(route, paginated(CASH_REGISTERS)),
    moneyCategories: (route) => json(route, paginated(MONEY_CATEGORIES)),
    moneyDocuments: (route, { method, body }) => {
      if (method === "POST") {
        createdSeq += 1;
        return json(route, { id: `new-md-${createdSeq}`, ...body, status: "DRAFT" }, 201);
      }
      return json(route, paginated(makeMoneyDocs(3)));
    },
    moneyItem: (route, { method, url }) => {
      if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
      const id = url.pathname.split("/").filter(Boolean).pop();
      return json(route, makeMoneyDoc(1, { id }));
    },
    moneyPost: (route, { url }) => {
      const id = url.pathname.split("/").filter(Boolean).at(-2);
      return json(route, { id, status: "POSTED" });
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
  await page.route(/^https?:\/\/[^/]+\/api\//, (route) => json(route, paginated([])));

  for (const [name, re] of Object.entries(ENDPOINTS)) {
    log[name] = [];
    await page.route(re, async (route) => {
      const request = route.request();
      const entry = {
        method: request.method(),
        url: new URL(request.url()),
        body: bodyOf(request),
      };
      // CORS preflight к боевому домену — просто разрешаем.
      if (entry.method === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
      }
      log[name].push(entry);
      return handlers[name](route, entry);
    });
  }

  return {
    /** @param {keyof typeof handlers} name */
    on(name, handler) {
      handlers[name] = handler;
    },
    /** @param {keyof typeof ENDPOINTS} name @param {string} [method] */
    calls(name, method) {
      return log[name].filter((c) => !method || c.method === method);
    },
  };
}

/**
 * Фикстуры:
 *  - `api`           — замоканный бэкенд (auto: поднимается в КАЖДОМ тесте);
 *  - `nativeDialogs` — тексты нативных window.alert/confirm (auto-accept);
 *  - `pageErrors`    — необработанные исключения: любой крэш React (белый
 *                      экран) валит тест в teardown, даже если тест его не заметил.
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
  nativeDialogs: [
    async ({ page }, use) => {
      /** @type {string[]} */
      const messages = [];
      page.on("dialog", async (dialog) => {
        messages.push(dialog.message());
        await dialog.accept().catch(() => {});
      });
      await use(messages);
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
 * Санити-проверка: по baseURL отвечает именно NUR CRM (а не, например,
 * dev-сервер nurcrm-market, который тоже любит порт 3000).
 */
test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get("/").catch((e) => {
    throw new Error(`Фронт не отвечает по ${baseURL}: ${e.message}`);
  });
  expect(
    await res.text(),
    `По ${baseURL} отвечает не NUR CRM (ожидался <title>NurCrm</title>). ` +
      "Проверьте, не занят ли порт другим проектом, или задайте E2E_BASE_URL.",
  ).toContain("<title>NurCrm</title>");
});

/* ------------------------------------------------------------------------ */
/* Хелперы для UI                                                           */
/* ------------------------------------------------------------------------ */

// Запас на холодную компиляцию ленивых чанков Vite при первом заходе.
const FIRST_RENDER = { timeout: 20_000 };

/** React-модалка оповещения (GlobalAlertModal) с нужным текстом. */
const appAlert = (page, text) =>
  page.getByRole("dialog").filter({ hasText: text });

/** Закрыть React-оповещение кнопкой «Ок». */
async function closeAlert(page, text) {
  const dlg = appAlert(page, text);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Ок" }).click();
  await expect(dlg).toBeHidden();
}

/** React-модалка подтверждения. */
const confirmDialog = (page) =>
  page.getByRole("dialog").filter({ hasText: "Подтвердите ваше действие" });

/** Строка таблицы, содержащая текст. */
const rowWith = (page, text) => page.getByRole("row").filter({ hasText: text });

/** Значение строки итогов «Метка: значение» (метка и значение — соседи). */
const summaryRow = (page, label) =>
  page.getByText(label, { exact: true }).locator("..");

/** Типичные артефакты небезопасного рендера. */
async function expectNoRenderGarbage(page) {
  const text = await page.locator("#root").innerText();
  expect(text).not.toMatch(/\bNaN\b/);
  expect(text).not.toMatch(/\bundefined\b/);
  expect(text).not.toContain("[object Object]");
}

/** Нет горизонтального скролла всей страницы. */
async function expectNoPageHScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

/* ---------- Форма создания документа ---------- */

const createHeading = (page) =>
  page.getByRole("heading", { level: 1, name: "Продажа · новый документ" });

const saveBtn = (page) =>
  page.getByRole("button", { name: "Сохранить", exact: true }).first();

/** Найти товар через поиск каталога и добавить кликом (qty = 1). */
async function addProduct(page, name, query = name.split(" ")[0]) {
  const search = page.getByPlaceholder("Поиск товара...");
  await search.fill(query);
  // В результатах поиска одиночный клик добавляет товар в документ.
  const item = page.getByText(name, { exact: true }).first();
  await expect(item).toBeVisible();
  await item.click();
  await expect(itemsRow(page, name)).toBeVisible();
}

/** Строка товара в таблице «Товары в документе». */
const itemsRow = (page, name) =>
  page.getByRole("row").filter({ hasText: name }).filter({ has: page.getByRole("textbox") });

/** Поля строки: [0] — количество, [1] — цена, [2] — скидка строки, %. */
const qtyInput = (page, name) => itemsRow(page, name).getByRole("textbox").nth(0);
const priceInput = (page, name) => itemsRow(page, name).getByRole("textbox").nth(1);
const lineDiscountInput = (page, name) => itemsRow(page, name).getByRole("textbox").nth(2);

/**
 * Тумблер «Документ проведён»: настоящий <input type=checkbox> скрыт под
 * стилизованным треком, поэтому кликаем по подписи — как пользователь.
 */
async function setPosted(page, value) {
  const box = page.getByLabel("Документ проведён");
  if ((await box.isChecked()) !== value) {
    await page.getByText("Документ проведён", { exact: true }).click();
  }
  await expect(box).toBeChecked({ checked: value });
}

/**
 * «В долг» НЕ переключается сразу: клик открывает модалку предоплаты, и режим
 * включается только по её «Сохранить». Поэтому click(), а не check() —
 * check() ждал бы checked=true и висел до таймаута.
 */
async function chooseCredit(page) {
  await page.getByText("В долг", { exact: true }).click();
  await expect(page.getByText("Предоплата по документу")).toBeVisible();
}

async function openCreate(page) {
  await page.goto(URLS.create);
  await expect(createHeading(page)).toBeVisible(FIRST_RENDER);
}

/* ---------- Денежные документы ---------- */

const moneyDialog = (page) => page.getByRole("dialog").filter({ has: page.locator("#money-doc-modal-title") });

async function openMoneyCreate(page) {
  await page.goto(URLS.moneyReceipt);
  await expect(page.getByRole("heading", { level: 1, name: "Приход в кассу" })).toBeVisible(
    FIRST_RENDER,
  );
  await page.getByRole("button", { name: "Создать приход в кассу" }).click();
  const dlg = moneyDialog(page);
  await expect(dlg).toBeVisible();
  return dlg;
}

async function fillMoneyForm(dlg, { amount = "1500", comment } = {}) {
  await dlg.getByLabel("Касса *").selectOption({ label: "Касса магазина" });
  await dlg.getByLabel("Контрагент").selectOption({ label: "ОсОО Клиент" });
  await dlg.getByLabel("Категория платежа *").selectOption({ label: "Оплата от клиента" });
  await dlg.getByLabel("Сумма, сом *").fill(amount);
  if (comment != null) await dlg.getByLabel("Комментарий").fill(comment);
}

/* ======================================================================== */
/* 1. ХЕППИ-ПАТ                                                             */
/* ======================================================================== */

test.describe("1. Хеппи-пат: список документов (/crm/warehouse/documents/)", () => {
  test("корень раздела редиректит на «Все» и грузит первую страницу", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.documents);
    await expect(page).toHaveURL(/\/crm\/warehouse\/documents\/all$/);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);

    // Для «Все» doc_type не передаётся, страница 1 по 100 строк.
    const url = api.calls("documents", "GET")[0].url;
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("page_size")).toBe("100");
    expect(url.searchParams.has("doc_type")).toBe(false);

    // Строка: номер, контрагент, сумма в формате ru-RU, статус.
    const row = rowWith(page, "ПР-00001");
    await expect(row).toContainText("Клиент 1");
    await expect(row).toContainText(som(1234.56));
    await expect(row).toContainText("Черновик");
    await expect(rowWith(page, "ПР-00002")).toContainText("Проведён");
    await expectNoRenderGarbage(page);
  });

  test("тип документа из URL уходит в doc_type", async ({ page, api }) => {
    await page.goto(URLS.documentsSale);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);
    expect(api.calls("documents", "GET")[0].url.searchParams.get("doc_type")).toBe("SALE");
  });

  test("поиск и фильтр по датам перезапрашивают список с параметрами", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.documentsAll);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);

    // Поиск — с debounce 300 мс, затем GET с search=.
    const searchReq = page.waitForRequest(
      (r) => ENDPOINTS.documents.test(r.url()) && r.url().includes("search=%D0%9F%D0%A0-7"),
    );
    await page.getByPlaceholder("Поиск по номеру или контрагенту...").fill("ПР-7");
    await searchReq;

    // Даты: поля без label, находим по title.
    const dateReq = page.waitForRequest(
      (r) =>
        ENDPOINTS.documents.test(r.url()) &&
        r.url().includes("date_from=2026-01-01") &&
        r.url().includes("date_to=2026-01-31"),
    );
    await page.getByTitle("Дата от").fill("2026-01-01");
    await page.getByTitle("Дата до").fill("2026-01-31");
    await dateReq;

    // «Сбросить» появляется только при заданной дате и очищает фильтр.
    await page.getByRole("button", { name: "Сбросить" }).click();
    await expect(page.getByTitle("Дата от")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Сбросить" })).toHaveCount(0);
    const last = api.calls("documents", "GET").at(-1)?.url;
    await expect.poll(() => api.calls("documents", "GET").at(-1)?.url.searchParams.has("date_from")).toBe(false);
    expect(last).toBeTruthy();
  });

  test("«Создать» ведёт на форму продажи", async ({ page }) => {
    await page.goto(URLS.documentsAll);
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(page).toHaveURL(/\/documents\/create\?doc_type=SALE$/);
    await expect(createHeading(page)).toBeVisible(FIRST_RENDER);
  });

  test("проведение черновика: confirm → POST /post/ → оповещение → перезапрос", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.documentsAll);
    const row = rowWith(page, "ПР-00001");
    await expect(row).toBeVisible(FIRST_RENDER);
    const before = api.calls("documents", "GET").length;

    await row.getByTitle("Провести документ").click();
    const confirm = confirmDialog(page);
    await expect(confirm).toContainText("Провести документ ПР-00001?");
    await confirm.getByRole("button", { name: "Подтвердить" }).click();

    await closeAlert(page, "Документ успешно проведен");
    const posts = api.calls("documentPost", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toContain("/warehouse/documents/doc-1/post/");
    expect(posts[0].body).toEqual({ allow_negative: false });
    // Список перезапрошен после успешного действия.
    expect(api.calls("documents", "GET").length).toBeGreaterThan(before);
  });

  test("удаление черновика: «Отменить» ничего не шлёт, «Подтвердить» — DELETE", async ({
    page,
    api,
  }) => {
    await page.goto(URLS.documentsAll);
    const row = rowWith(page, "ПР-00001");
    await expect(row).toBeVisible(FIRST_RENDER);

    await row.getByTitle("Удалить черновик").click();
    await confirmDialog(page).getByRole("button", { name: "Отменить" }).click();
    await expect(confirmDialog(page)).toBeHidden();
    expect(api.calls("documentItem", "DELETE")).toHaveLength(0);

    await row.getByTitle("Удалить черновик").click();
    await expect(confirmDialog(page)).toContainText("Удалить черновик ПР-00001? Действие необратимо.");
    await confirmDialog(page).getByRole("button", { name: "Подтвердить" }).click();
    await closeAlert(page, "Черновик удалён");
    expect(api.calls("documentItem", "DELETE")).toHaveLength(1);
  });
});

test.describe("1. Хеппи-пат: создание документа (/crm/warehouse/documents/create)", () => {
  test("без параметров открывается продажа, URL дописывается ?doc_type=SALE", async ({
    page,
    api,
  }) => {
    await openCreate(page);
    await expect(page).toHaveURL(/\/create\?doc_type=SALE$/);
    // На старте — справочники, товары НЕ грузятся до поиска.
    await expect.poll(() => api.calls("warehouses").length).toBeGreaterThan(0);
    await expect.poll(() => api.calls("counterparties").length).toBeGreaterThan(0);
    expect(api.calls("productsSearch")).toHaveLength(0);
    await expect(page.getByText("Нет товаров в документе")).toBeVisible();
    await expect(page.getByLabel("Документ проведён")).toBeChecked();
  });

  test("расчёты: количество, скидка строки, скидка документа и суммой", async ({
    page,
  }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");

    // 1 шт × 150 = 150
    await expect(summaryRow(page, "Подытог:")).toContainText(som(150));

    // 3 шт × 150 = 450; скидка строки 10% → строка и итог 405
    await qtyInput(page, "Молоко 1л").fill("3");
    await lineDiscountInput(page, "Молоко 1л").fill("10");
    await expect(itemsRow(page, "Молоко 1л")).toContainText(som(405));
    await expect(summaryRow(page, "Всего товаров:")).toContainText("3 ед.");
    await expect(summaryRow(page, "Подытог:")).toContainText(som(450));
    await expect(summaryRow(page, "Итого:")).toContainText(som(405));
    // Документ проводится и оплачивается «Сразу» → оплачено всё.
    await expect(summaryRow(page, "Оплачено:")).toContainText(som(405));
    await expect(summaryRow(page, "К оплате:")).toContainText(som(0));

    // Скидка документа 10% считается от суммы ПОСЛЕ скидок строк: 405 − 40,5.
    const docPct = summaryRow(page, "Скидка документа:").getByRole("textbox");
    await docPct.fill("10");
    await expect(summaryRow(page, "Итого:")).toContainText(som(364.5));

    // Плюс фиксированная скидка суммой 14,5 → 350.
    await summaryRow(page, "Скидка суммой:").getByRole("textbox").fill("14.5");
    await expect(summaryRow(page, "Итого:")).toContainText(som(350));

    // Второй товар добавляется отдельной строкой и входит в подытог.
    await addProduct(page, "Хлеб белый");
    await expect(summaryRow(page, "Подытог:")).toContainText(som(490));
  });

  test("сохранение с проведением: POST sale → POST post → оповещение → список", async ({
    page,
    api,
  }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await qtyInput(page, "Молоко 1л").fill("3");
    await lineDiscountInput(page, "Молоко 1л").fill("10");

    // Клиент: в выпадашке для продажи нет чистого поставщика.
    await page.getByPlaceholder("Выберите клиента (необязательно)").click();
    await expect(page.getByRole("button", { name: "ОсОО Поставщик" })).toHaveCount(0);
    await page.getByRole("button", { name: "ОсОО Клиент" }).click();

    await page.getByPlaceholder("Добавить комментарий к документу...").fill("E2E продажа");
    await saveBtn(page).click();

    await expect(appAlert(page, "Документ успешно сохранен и проведен")).toBeVisible();
    await expect(page).toHaveURL(/\/crm\/warehouse\/documents\/sale$/);

    const created = api.calls("documentItem", "POST");
    expect(created).toHaveLength(1);
    expect(created[0].url.pathname).toContain("/warehouse/documents/sale/");
    const body = created[0].body;
    expect(body).toMatchObject({
      doc_type: "SALE",
      payment_kind: "cash",
      payment_method: "cash",
      counterparty: "cp-1",
      comment: "E2E продажа",
    });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      product: "p-1",
      qty: "3",
      discount_percent: "10.00",
      line_total: "405.00",
    });
    // Созданный документ тут же проводится.
    const posts = api.calls("documentPost", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toContain("/new-doc-1/post/");
    await closeAlert(page, "Документ успешно сохранен и проведен");
  });

  test("черновик: без «Документ проведён» уходит только создание", async ({
    page,
    api,
  }) => {
    await openCreate(page);
    await addProduct(page, "Хлеб белый");
    await setPosted(page, false);
    await saveBtn(page).click();

    await expect(appAlert(page, "Документ успешно сохранен")).toBeVisible();
    expect(api.calls("documentItem", "POST")).toHaveLength(1);
    expect(api.calls("documentPost")).toHaveLength(0);
  });

  test("продажа в долг: предоплата меняет «Оплачено» и «К оплате»", async ({
    page,
    api,
  }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await qtyInput(page, "Молоко 1л").fill("3"); // 450

    // «В долг» открывает модалку предоплаты; режим включается только по «Сохранить».
    await chooseCredit(page);
    await page.getByPlaceholder("0").last().fill("100");
    await page.getByRole("button", { name: "Сохранить", exact: true }).last().click();

    await expect(summaryRow(page, "Предоплата:")).toContainText(som(100));
    await expect(summaryRow(page, "Оплачено:")).toContainText(som(100));
    await expect(summaryRow(page, "К оплате:")).toContainText(som(350));

    // В долг без клиента нельзя.
    await saveBtn(page).click();
    await closeAlert(page, "Выберите клиента");
    expect(api.calls("documentItem", "POST")).toHaveLength(0);

    await page.getByPlaceholder("Выберите клиента").click();
    await page.getByRole("button", { name: "ОсОО Клиент" }).click();
    await saveBtn(page).click();
    await expect(appAlert(page, "Документ успешно сохранен")).toBeVisible();
    expect(api.calls("documentItem", "POST")[0].body).toMatchObject({
      payment_kind: "credit",
      prepayment_amount: "100.00",
      counterparty: "cp-1",
    });
  });
});

test.describe("1. Хеппи-пат: денежные документы (/crm/warehouse/documents/money/...)", () => {
  test("голый /money/ не падает: открывается общий список документов", async ({
    page,
    api,
  }) => {
    // Маршрута money/ без типа нет — его ловит :docType="money" и откатывает
    // на «Все». Главное — не белый экран и не запрос «doc_type=money».
    await page.goto(URLS.moneyBare);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);
    expect(api.calls("documents", "GET")[0].url.searchParams.has("doc_type")).toBe(false);
  });

  test("приход в кассу: список, поиск на клиенте и счётчики", async ({ page, api }) => {
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByRole("heading", { level: 1, name: "Приход в кассу" })).toBeVisible(
      FIRST_RENDER,
    );
    // Заголовок может отрисоваться раньше, чем мок зафиксирует запрос.
    await expect
      .poll(() => api.calls("moneyDocuments", "GET")[0]?.url.searchParams.get("doc_type"))
      .toBe("MONEY_RECEIPT");

    const row = rowWith(page, "ПКО-1");
    await expect(row).toContainText("Контрагент 1");
    await expect(row).toContainText(somShort(1001));
    await expect(row).toContainText("Черновик");
    await expect(page.getByText(/Всего: 3 • Найдено: 3/)).toBeVisible();

    // Поиск — на клиенте: новых запросов нет, строк меньше.
    const before = api.calls("moneyDocuments", "GET").length;
    await page.getByPlaceholder("Поиск по номеру, комментарию, контрагенту...").fill("контрагент 2");
    await expect(page.getByText(/Всего: 3 • Найдено: 1/)).toBeVisible();
    await expect(rowWith(page, "ПКО-2")).toBeVisible();
    await expect(rowWith(page, "ПКО-1")).toHaveCount(0);
    expect(api.calls("moneyDocuments", "GET").length).toBe(before);
  });

  test("расход из кассы: свой doc_type и своя кнопка создания", async ({ page, api }) => {
    await page.goto(URLS.moneyExpense);
    await expect(page.getByRole("heading", { level: 1, name: "Расход в кассу" })).toBeVisible(
      FIRST_RENDER,
    );
    await expect(page.getByRole("button", { name: "Создать расход из кассы" })).toBeVisible();
    await expect
      .poll(() => api.calls("moneyDocuments", "GET")[0]?.url.searchParams.get("doc_type"))
      .toBe("MONEY_EXPENSE");
  });

  test("неизвестный тип денег редиректит на приход", async ({ page }) => {
    await page.goto("/crm/warehouse/documents/money/whatever");
    await expect(page).toHaveURL(/\/money\/receipt$/, FIRST_RENDER);
  });

  test("создание прихода с проведением: POST → POST post → alert → список", async ({
    page,
    api,
    nativeDialogs,
  }) => {
    const dlg = await openMoneyCreate(page);
    await expect(dlg.getByRole("switch", { name: "Документ проведён" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await fillMoneyForm(dlg, { amount: "1 500,50", comment: "Оплата по счёту 15" });
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();

    await expect(dlg).toBeHidden();
    await expect.poll(() => nativeDialogs).toContain("Документ успешно проведён");

    const created = api.calls("moneyDocuments", "POST");
    expect(created).toHaveLength(1);
    // Пробелы в сумме вырезаются, запятая → точка, сумма уходит числом.
    expect(created[0].body).toMatchObject({
      doc_type: "MONEY_RECEIPT",
      cash_register: "cr-1",
      counterparty: "cp-1",
      payment_category: "mc-1",
      amount: 1500.5,
      comment: "Оплата по счёту 15",
    });
    expect(api.calls("moneyPost", "POST")).toHaveLength(1);
  });

  test("создание черновика: выключенный тумблер — без проведения", async ({
    page,
    api,
    nativeDialogs,
  }) => {
    const dlg = await openMoneyCreate(page);
    const sw = dlg.getByRole("switch", { name: "Документ проведён" });
    await sw.click();
    await expect(dlg.getByRole("switch", { name: "Черновик" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await fillMoneyForm(dlg);
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
    expect(api.calls("moneyPost")).toHaveLength(0);
    expect(nativeDialogs).toEqual([]);
  });
});

/* ======================================================================== */
/* 2. ЗАЩИТА ОТ ДУРАКА                                                      */
/* ======================================================================== */

test.describe("2. Защита от дурака: форма создания документа", () => {
  test("тройной клик по «Сохранить»: документ создаётся ОДИН раз", async ({
    page,
    api,
  }) => {
    // Регрессия: раньше «Сохранить» никогда не блокировалась, и тройной клик
    // создавал 3 документа (и проводил каждый). Теперь handleSave под замком:
    // кнопка disabled с текстом «Сохранение…», повторные клики игнорируются.

    api.on("documentItem", async (route, { method }) => {
      if (method !== "POST") return json(route, {});
      await delay(800); // медленный бэк — окно для повторных кликов
      return json(route, { id: "new-doc-1", status: "DRAFT" }, 201);
    });
    await openCreate(page);
    await addProduct(page, "Молоко 1л");

    await saveBtn(page).click({ clickCount: 3 });
    await expect(page.getByRole("button", { name: "Сохранение…" })).toBeDisabled();
    await expect(appAlert(page, "Документ успешно сохранен").first()).toBeVisible({
      timeout: 10_000,
    });
    expect(api.calls("documentItem", "POST")).toHaveLength(1);
  });

  test("пустая форма: понятное сообщение и никаких запросов", async ({ page, api }) => {
    await openCreate(page);
    await saveBtn(page).click();
    await closeAlert(page, "Нельзя провести документ без строк. Добавьте хотя бы один товар.");

    // Без проведения — другой текст.
    await setPosted(page, false);
    await saveBtn(page).click();
    await closeAlert(page, "Нельзя сохранить пустой документ. Добавьте хотя бы один товар.");
    expect(api.calls("documentItem", "POST")).toHaveLength(0);
  });

  test("отрицательное и нулевое количество блокируют сохранение", async ({
    page,
    api,
  }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    const msg = 'Укажите количество больше 0 для товара "Молоко 1л" или удалите строку';

    await qtyInput(page, "Молоко 1л").fill("-5");
    await saveBtn(page).click();
    await closeAlert(page, msg);

    await qtyInput(page, "Молоко 1л").fill("0");
    await saveBtn(page).click();
    await closeAlert(page, msg);
    expect(api.calls("documentItem", "POST")).toHaveLength(0);
  });

  test("количество больше остатка урезается до остатка с подсказкой", async ({
    page,
  }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    const qty = qtyInput(page, "Молоко 1л");
    await qty.fill("999");
    // Остаток 50: значение урезано, поле помечено aria-invalid, есть role=status.
    await expect(qty).toHaveValue("50");
    await expect(qty).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("status").filter({ hasText: /Доступно 50/ })).toBeVisible();
  });

  test("отрицательная цена и скидка >100% не принимаются", async ({ page }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");

    const price = priceInput(page, "Молоко 1л");
    const before = await price.inputValue();
    await price.fill("-100");
    // Ввод отрицательной цены игнорируется — значение не меняется.
    await expect(price).toHaveValue(before);

    // Скидка строки клампится в 0..100.
    const disc = lineDiscountInput(page, "Молоко 1л");
    await disc.fill("150");
    await expect(disc).toHaveValue("100");
    await expect(summaryRow(page, "Итого:")).toContainText(som(0));

    // Скидка документа вне 0..100 не вводится.
    const docPct = summaryRow(page, "Скидка документа:").getByRole("textbox");
    await disc.fill("0");
    await docPct.fill("250");
    await expect(docPct).not.toHaveValue("250");
    await expectNoRenderGarbage(page);
  });

  test("скидка суммой больше подытога блокирует сохранение", async ({ page, api }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л"); // 150
    await summaryRow(page, "Скидка суммой:").getByRole("textbox").fill("500");
    await saveBtn(page).click();
    await closeAlert(
      page,
      "Скидка по документу (% и суммой) не может превышать подытог после скидок по позициям",
    );
    expect(api.calls("documentItem", "POST")).toHaveLength(0);
  });

  test("спецсимволы и гигантский комментарий уходят как есть и не исполняются", async ({
    page,
    api,
  }) => {
    const evil = `<script>window.__xss=1</script><img src=x onerror="window.__xss=2">{}&amp;&"'`;
    const huge = "Ж".repeat(10_000);
    await openCreate(page);
    await addProduct(page, "Хлеб белый");
    await page.getByPlaceholder("Добавить комментарий к документу...").fill(evil + huge);
    await saveBtn(page).click();

    await expect(appAlert(page, "Документ успешно сохранен")).toBeVisible();
    expect(api.calls("documentItem", "POST")[0].body.comment).toBe(evil + huge);
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  });

  test("XSS в названиях товара и контрагента из бэка выводится текстом", async ({
    page,
    api,
  }) => {
    const evilName = `<img src=x onerror="window.__xss=1">Товар & {}`;
    api.on("productsSearch", (route) =>
      json(route, paginated([{ ...PRODUCTS[0], name: evilName }])),
    );
    api.on("counterparties", (route) =>
      json(route, paginated([{ id: "cp-x", name: `<script>window.__xss=2</script>`, type: "CLIENT" }])),
    );
    await openCreate(page);
    await page.getByPlaceholder("Поиск товара...").fill("Товар");
    await page.getByText(evilName, { exact: true }).first().click();
    await expect(itemsRow(page, evilName)).toBeVisible();

    await page.getByPlaceholder("Выберите клиента (необязательно)").click();
    await expect(page.getByRole("button", { name: "<script>window.__xss=2</script>" })).toBeVisible();
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("«Назад» с товарами спрашивает подтверждение выхода", async ({ page }) => {
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await page.getByRole("button", { name: "Назад к списку документов" }).click();
    await expect(page.getByText("В документе есть добавленные товары")).toBeVisible();
    await page.getByRole("button", { name: "Выйти без сохранения" }).click();
    await expect(page).toHaveURL(/\/crm\/warehouse\/documents\/sale$/);
  });
});

test.describe("2. Защита от дурака: список документов", () => {
  test("тройной клик по «Провести»: одно подтверждение и один POST", async ({
    page,
    api,
  }) => {
    api.on("documentPost", async (route) => {
      await delay(600);
      return json(route, { id: "doc-1", status: "POSTED" });
    });
    await page.goto(URLS.documentsAll);
    const row = rowWith(page, "ПР-00001");
    await expect(row).toBeVisible(FIRST_RENDER);

    await row.getByTitle("Провести документ").click({ clickCount: 3 });
    await expect(confirmDialog(page)).toHaveCount(1);
    await confirmDialog(page).getByRole("button", { name: "Подтвердить" }).click();
    await closeAlert(page, "Документ успешно проведен");
    expect(api.calls("documentPost", "POST")).toHaveLength(1);
  });

  test("черновик без строк: проведение блокируется на клиенте", async ({ page, api }) => {
    api.on("documents", (route) =>
      json(route, paginated([makeDoc(1, { items: [], total: "0" })])),
    );
    await page.goto(URLS.documentsAll);
    const row = rowWith(page, "ПР-00001");
    await expect(row).toBeVisible(FIRST_RENDER);
    await row.getByTitle("Провести документ").click();
    await closeAlert(
      page,
      "Нельзя провести документ без строк. Откройте черновик и добавьте хотя бы один товар.",
    );
    expect(api.calls("documentPost")).toHaveLength(0);
  });

  test("мусор в данных строк: отрицательные/строковые суммы, XSS, гигантские имена", async ({
    page,
  }) => {
    const huge = "Ж".repeat(5_000);
    await page.route(ENDPOINTS.documents, (route) =>
      json(
        route,
        paginated([
          makeDoc(1, { total: "-500", counterparty: { name: `<img src=x onerror="window.__xss=1">` } }),
          makeDoc(2, { total: "abc", items: null, counterparty: null, number: null }),
          makeDoc(3, { counterparty: { name: huge }, date: "не дата" }),
        ]),
      ),
    );
    await page.goto(URLS.documentsAll);
    await expect(rowWith(page, "onerror")).toBeVisible(FIRST_RENDER);
    // total ≤ 0 фронт по задумке пересчитывает из строк (2 × 617,28),
    // а не показывает отрицательную сумму.
    await expect(rowWith(page, "onerror")).toContainText(som(1234.56));
    // Без номера — «Черновик <id>», без контрагента — заглушка.
    await expect(page.getByText("Без контрагента").first()).toBeVisible();
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
    await expectNoRenderGarbage(page);
  });
});

test.describe("2. Защита от дурака: денежные документы", () => {
  test("тройной клик по «Сохранить»: один POST, кнопка в состоянии «Сохранение…»", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", async (route, { method, body }) => {
      if (method !== "POST") return json(route, paginated(makeMoneyDocs(3)));
      await delay(800);
      return json(route, { id: "new-md-1", ...body }, 201);
    });
    const dlg = await openMoneyCreate(page);
    await fillMoneyForm(dlg);

    const submit = dlg.getByRole("button", { name: "Сохранить", exact: true });
    await submit.click({ clickCount: 3 });
    await expect(dlg.getByRole("button", { name: "Сохранение…" })).toBeDisabled();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
  });

  test("пустая форма: браузерная валидация required не пускает запрос", async ({
    page,
    api,
  }) => {
    const dlg = await openMoneyCreate(page);
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
    // Обязательные поля невалидны (нативный :invalid), модалка открыта.
    for (const label of ["Касса *", "Категория платежа *", "Сумма, сом *"]) {
      expect(
        await dlg.getByLabel(label).evaluate((el) => /** @type {HTMLInputElement} */ (el).validity.valid),
        label,
      ).toBe(false);
    }
    await expect(dlg).toBeVisible();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  test("пустая форма в обход required: JS-валидация показывает ошибку", async ({
    page,
    api,
  }) => {
    const dlg = await openMoneyCreate(page);
    // Имитируем браузер без поддержки required / снятый атрибут.
    await dlg.locator("[required]").evaluateAll((els) => els.forEach((e) => e.removeAttribute("required")));
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(dlg.getByText("Заполните кассу, категорию и сумму")).toBeVisible();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  for (const amount of ["-100", "0", "abc", "{}", "<script>"]) {
    test(`некорректная сумма «${amount}» отклоняется`, async ({ page, api }) => {
      const dlg = await openMoneyCreate(page);
      await fillMoneyForm(dlg, { amount });
      await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
      await expect(dlg.getByText("Укажите корректную сумму")).toBeVisible();
      expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
    });
  }

  test("спецсимволы и гигантский комментарий уходят как есть", async ({ page, api }) => {
    const comment = `<script>window.__xss=1</script>{}&amp;&"' ${"Ж".repeat(10_000)}`;
    const dlg = await openMoneyCreate(page);
    await fillMoneyForm(dlg, { comment });
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(dlg).toBeHidden();
    // Фронт обрезает только пробелы по краям.
    expect(api.calls("moneyDocuments", "POST")[0].body.comment).toBe(comment.trim());
    expect(await page.evaluate(() => /** @type {any} */ (window).__xss)).toBeUndefined();
  });

  test("поиск не падает, если номер или комментарий пришли числом", async ({
    page,
    api,
  }) => {
    // Регрессия: бэк иногда отдаёт number/comment числом. Фильтр поиска
    // приводит поля к строке, иначе toLowerCase() уронил бы страницу целиком.
    api.on("moneyDocuments", (route) =>
      json(route, paginated([makeMoneyDoc(1, { number: 123, comment: 456 })])),
    );
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByRole("heading", { level: 1, name: "Приход в кассу" })).toBeVisible(
      FIRST_RENDER,
    );
    await page.getByPlaceholder("Поиск по номеру, комментарию, контрагенту...").fill("12");
    await expect(page.getByText(/Найдено: 1/)).toBeVisible();
  });
});

/* ======================================================================== */
/* 3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: офисный ноутбук 1366×768                        */
/* ======================================================================== */

test.describe("3. Экран 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("форма создания: «Сохранить» видна сразу, итоги доступны скроллом", async ({
    page,
  }) => {
    await openCreate(page);
    await expect(saveBtn(page)).toBeInViewport();

    await addProduct(page, "Молоко 1л");
    await addProduct(page, "Хлеб белый");
    const total = summaryRow(page, "Итого:");
    await total.scrollIntoViewIfNeeded();
    await expect(total).toBeInViewport();
    // После прокрутки «Сохранить» по-прежнему достижима и кликабельна.
    await saveBtn(page).scrollIntoViewIfNeeded();
    await expect(saveBtn(page)).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("список: «Создать», поиск и действия строки на экране", async ({ page }) => {
    await page.goto(URLS.documentsAll);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Создать", exact: true })).toBeInViewport();
    await expect(page.getByPlaceholder("Поиск по номеру или контрагенту...")).toBeInViewport();
    const post = rowWith(page, "ПР-00001").getByTitle("Провести документ");
    await post.scrollIntoViewIfNeeded();
    await expect(post).toBeInViewport();
  });

  test("модалка денежного документа: «Сохранить» видна или доскролливается", async ({
    page,
  }) => {
    const dlg = await openMoneyCreate(page);
    // Шапка модалки (крестик) видна сразу после открытия…
    await expect(dlg.getByRole("button", { name: "Закрыть" })).toBeInViewport();
    // …а кнопка отправки видна или достижима прокруткой модалки.
    const submit = dlg.getByRole("button", { name: "Сохранить", exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
  });
});

/* ======================================================================== */
/* 4. СБОИ БЭКЕНДА                                                          */
/* ======================================================================== */

test.describe("4. Сбои бэкенда: отправка форм", () => {
  test("создание документа: 500 → «Ошибка: Ошибка сервера», форма и товары на месте", async ({
    page,
    api,
  }) => {
    api.on("documentItem", (route, { method }) =>
      method === "POST" ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, {}),
    );
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await qtyInput(page, "Молоко 1л").fill("3");
    await saveBtn(page).click();

    await closeAlert(page, "Ошибка: Ошибка сервера");
    await expect(page).toHaveURL(/\/create/);
    await expect(createHeading(page)).toBeVisible();
    await expect(qtyInput(page, "Молоко 1л")).toHaveValue("3");
    expect(api.calls("documentPost")).toHaveLength(0);

    // Бэк ожил — повторная отправка проходит.
    api.on("documentItem", (route) => json(route, { id: "new-doc-9" }, 201));
    await saveBtn(page).click();
    await expect(appAlert(page, "Документ успешно сохранен и проведен")).toBeVisible();
  });

  test("создание документа: ошибки полей 400 собираются в читаемый текст", async ({
    page,
    api,
  }) => {
    api.on("documentItem", (route, { method }) =>
      method === "POST"
        ? json(route, { counterparty: ["Обязательное поле."], items: ["Неверный товар."] }, 400)
        : json(route, {}),
    );
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await saveBtn(page).click();
    await closeAlert(page, "counterparty: Обязательное поле.; items: Неверный товар.");
  });

  test("создание документа: 502 с HTML → запасной текст, без разметки nginx", async ({
    page,
    api,
  }) => {
    api.on("documentItem", (route, { method }) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, {}),
    );
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await saveBtn(page).click();
    await closeAlert(page, "Ошибка: Ошибка при сохранении документа");
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
  });

  test("документ создан, но проведение упало: честное сообщение и переход в список", async ({
    page,
    api,
  }) => {
    api.on("documentPost", (route) => json(route, { detail: "Недостаточно остатка" }, 400));
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await saveBtn(page).click();
    await expect(appAlert(page, "Документ создан, но не проведен: Недостаточно остатка")).toBeVisible();
    await expect(page).toHaveURL(/\/crm\/warehouse\/documents\/sale$/);
  });

  test("проведение из списка: 500 → оповещение с текстом бэка, список жив", async ({
    page,
    api,
  }) => {
    api.on("documentPost", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.documentsAll);
    const row = rowWith(page, "ПР-00001");
    await expect(row).toBeVisible(FIRST_RENDER);
    await row.getByTitle("Провести документ").click();
    await confirmDialog(page).getByRole("button", { name: "Подтвердить" }).click();
    await closeAlert(page, "Ошибка: Ошибка сервера");
    await expect(row).toContainText("Черновик");
  });

  test("денежный документ: 500 → ошибка в модалке, данные формы сохранены", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", (route, { method }) =>
      method === "POST"
        ? json(route, { detail: "Ошибка сервера" }, 500)
        : json(route, paginated(makeMoneyDocs(3))),
    );
    const dlg = await openMoneyCreate(page);
    await fillMoneyForm(dlg, { amount: "777" });
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();

    await expect(dlg.getByText("Ошибка сервера")).toBeVisible();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByLabel("Сумма, сом *")).toHaveValue("777");
    // Кнопка снова активна — можно повторить.
    await expect(dlg.getByRole("button", { name: "Сохранить", exact: true })).toBeEnabled();
  });

  test("денежный документ: пустое тело ошибки → запасной текст", async ({ page, api }) => {
    api.on("moneyDocuments", (route, { method }) =>
      method === "POST" ? json(route, {}, 500) : json(route, paginated([])),
    );
    const dlg = await openMoneyCreate(page);
    await fillMoneyForm(dlg);
    await dlg.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(dlg.getByText("Ошибка при создании документа")).toBeVisible();
  });

  test("обрыв сети при создании документа: сообщение, а не белый экран", async ({
    page,
    api,
  }) => {
    api.on("documentItem", (route, { method }) =>
      method === "POST" ? route.abort("internetdisconnected") : json(route, {}),
    );
    await openCreate(page);
    await addProduct(page, "Молоко 1л");
    await saveBtn(page).click();
    await expect(page.getByRole("dialog").filter({ hasText: /Ошибка/ })).toBeVisible();
    await expect(createHeading(page)).toBeVisible();
  });
});

test.describe("4. Сбои бэкенда: null и пустые ответы на GET", () => {
  test("список документов: null целиком → «Документы не найдены»", async ({ page, api }) => {
    api.on("documents", (route) => json(route, null));
    await page.goto(URLS.documentsAll);
    await expect(page.getByText("Документы не найдены").first()).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Создать", exact: true })).toBeEnabled();
  });

  test("список документов: results = null и {} вместо массива", async ({ page, api }) => {
    api.on("documents", (route) => json(route, { count: 5, results: null }));
    await page.goto(URLS.documentsAll);
    await expect(page.getByText("Документы не найдены").first()).toBeVisible(FIRST_RENDER);

    api.on("documents", (route) => json(route, {}));
    await page.getByPlaceholder("Поиск по номеру или контрагенту...").fill("x");
    await expect(page.getByText("Документы не найдены").first()).toBeVisible();
  });

  test("список документов: 500 на загрузке — страница жива", async ({ page, api }) => {
    // Замечание: ошибка загрузки списка в UI не выводится (только пустой список).
    api.on("documents", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.documentsAll);
    await expect(page.getByText("Документы не найдены").first()).toBeVisible(FIRST_RENDER);
    await expect(page.getByPlaceholder("Поиск по номеру или контрагенту...")).toBeEditable();
  });

  test("форма создания: все справочники пришли null", async ({ page, api }) => {
    for (const name of ["warehouses", "counterparties", "employees", "groups", "productsSearch", "warehouseProducts"]) {
      api.on(/** @type {any} */ (name), (route) => json(route, null));
    }
    await openCreate(page);
    await page.getByPlaceholder("Поиск товара...").fill("Молоко");
    await page.getByPlaceholder("Выберите клиента (необязательно)").click();
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();
    await expect(page.getByText("Нет товаров в документе")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("форма создания: results = null внутри пагинации", async ({ page, api }) => {
    for (const name of ["warehouses", "counterparties", "productsSearch"]) {
      api.on(/** @type {any} */ (name), (route) => json(route, { count: 0, next: null, results: null }));
    }
    await openCreate(page);
    await page.getByPlaceholder("Поиск товара...").fill("Молоко");
    await expect(page.getByText("Нет товаров в документе")).toBeVisible();
  });

  test("денежные документы: список null → «Нет документов»", async ({ page, api }) => {
    api.on("moneyDocuments", (route) => json(route, null));
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByText("Нет документов")).toBeVisible(FIRST_RENDER);
    await expect(page.getByText(/Всего: 0/)).toBeVisible();
  });

  test("денежные документы: справочники null — модалка открывается с пустыми списками", async ({
    page,
    api,
  }) => {
    for (const name of ["cashRegisters", "moneyCategories", "counterparties", "employees"]) {
      api.on(/** @type {any} */ (name), (route) => json(route, null));
    }
    const dlg = await openMoneyCreate(page);
    // Только пустая опция-заглушка.
    await expect(dlg.getByLabel("Касса *").locator("option")).toHaveCount(1);
    await expect(dlg.getByLabel("Категория платежа *").locator("option")).toHaveCount(1);
  });

  test("денежные документы: 500 на списке → понятное сообщение", async ({ page, api }) => {
    api.on("moneyDocuments", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByText("Не удалось загрузить список документов")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Создать приход в кассу" })).toBeEnabled();
  });
});

/* ======================================================================== */
/* 5. СТРЕСС И ПРОИЗВОДИТЕЛЬНОСТЬ                                           */
/* ======================================================================== */

test.describe("5. Стресс и производительность", () => {
  test.slow();

  /**
   * Бюджет времени с поправкой на параллельный прогон: когда несколько
   * воркеров одновременно гоняют три браузера, CPU делится, и абсолютные
   * замеры раздуваются в разы. Строгий замер — с --workers=1.
   */
  const perfBudget = (ms) => (test.info().config.workers > 1 ? ms * 3 : ms);

  test("Big Data: 3000 документов в одном ответе списка", async ({ page, api }) => {
    // 3000 строк × иконки действий — самый тяжёлый рендер в наборе; при
    // параллельном прогоне трёх браузеров даём пропорциональный запас.
    test.setTimeout(perfBudget(90_000));
    const N = 3000;
    const docs = makeDocs(N);

    // Прогрев: первый заход компилирует чанки Vite (на холодном сервере в
    // Firefox это десятки секунд) — в замер рендера это попадать не должно.
    await page.goto(URLS.documentsAll);
    await expect(rowWith(page, "ПР-00001")).toBeVisible(FIRST_RENDER);

    api.on("documents", (route, { url }) => {
      const q = url.searchParams.get("search");
      return json(route, paginated(q ? docs.filter((d) => d.number.includes(q)) : docs));
    });
    const t0 = Date.now();
    await page.reload();
    await expect(rowWith(page, `ПР-0${N}`)).toBeAttached({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 3000 docs, ms", description: String(renderMs) });
    // Замер на M-серии Mac: Chromium ≈ 3 с, Firefox/WebKit ≈ 4.5 с.
    expect(renderMs).toBeLessThan(perfBudget(15_000));

    // Отзывчивость: поиск сужает список, табы переключаются.
    await page.getByPlaceholder("Поиск по номеру или контрагенту...").fill("ПР-02999");
    await expect(page.getByRole("row").filter({ hasText: /ПР-0\d{4}/ })).toHaveCount(1, {
      timeout: perfBudget(15_000),
    });
    await page.getByRole("button", { name: "Чеки" }).click();
    await expect(page).toHaveURL(/tab=receipts/);
  });

  test("Big Data: серверная пагинация на 5000 документов", async ({ page, api }) => {
    api.on("documents", (route, { url }) => {
      const p = Number(url.searchParams.get("page") || 1);
      return json(route, {
        count: 5000,
        next: p < 50 ? `?page=${p + 1}` : null,
        previous: p > 1 ? `?page=${p - 1}` : null,
        results: makeDocs(100).map((d, i) => ({ ...d, id: `doc-${p}-${i}`, number: `П${p}-${i + 1}` })),
      });
    });
    await page.goto(URLS.documentsAll);
    await expect(page.getByText("Страница 1 из 50 (5000 документов)")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Назад" })).toBeDisabled();
    // «Вперед» сразу после загрузки: debounce поиска больше не откатывает
    // страницу на 1 (см. тест «прямая ссылка на ?page=2» ниже).
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 50 (5000 документов)")).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("cell", { name: "П2-1", exact: true })).toBeVisible();
  });

  test("прямая ссылка на ?page=2 не сбрасывается на первую страницу", async ({
    page,
    api,
  }) => {
    // Регрессия: раньше debounce поиска через 300 мс после монтирования
    // безусловно делал setCurrentPage(1), и ссылка «…/all?page=2» откатывалась
    // на первую страницу. Теперь страница сбрасывается только при смене поиска.

    api.on("documents", (route, { url }) => {
      const p = Number(url.searchParams.get("page") || 1);
      return json(route, {
        count: 5000,
        next: `?page=${p + 1}`,
        previous: p > 1 ? `?page=${p - 1}` : null,
        results: makeDocs(100).map((d, i) => ({ ...d, id: `doc-${p}-${i}`, number: `П${p}-${i + 1}` })),
      });
    });
    await page.goto(`${URLS.documentsAll}?page=2`);
    await expect(page.getByText("Страница 2 из 50 (5000 документов)")).toBeVisible(FIRST_RENDER);
    await page.waitForTimeout(800); // дольше debounce
    await expect(page.getByText("Страница 2 из 50 (5000 документов)")).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    expect(api.calls("documents", "GET").every((c) => c.url.searchParams.get("page") === "2")).toBe(true);
  });

  test("Big Data: 3000 товаров в каталоге формы создания", async ({ page, api }) => {
    const many = Array.from({ length: 3000 }, (_, i) => ({
      ...PRODUCTS[0],
      id: `bp-${i}`,
      name: `Товар нагрузочный ${i}`,
    }));
    api.on("productsSearch", (route) => json(route, paginated(many)));
    api.on("warehouseProducts", (route) => json(route, paginated(many)));

    await openCreate(page);
    const t0 = Date.now();
    await page.getByPlaceholder("Поиск товара...").fill("Товар");
    await expect(page.getByText("Товар нагрузочный 2999", { exact: true })).toBeAttached({
      timeout: 30_000,
    });
    test.info().annotations.push({ type: "search 3000 products, ms", description: String(Date.now() - t0) });

    // Кликнуть товар из середины списка и пересчитать сумму — UI отзывчив.
    const item = page.getByText("Товар нагрузочный 1500", { exact: true }).first();
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await expect(itemsRow(page, "Товар нагрузочный 1500")).toBeVisible();
    await qtyInput(page, "Товар нагрузочный 1500").fill("2");
    await expect(summaryRow(page, "Итого:")).toContainText(som(300), { timeout: 10_000 });
  });

  test("Big Data: 3000 денежных документов — пагинация и поиск на клиенте", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", (route) => json(route, paginated(makeMoneyDocs(3000))));
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByText(/Всего: 3000 • Найдено: 3000/)).toBeVisible(FIRST_RENDER);
    await expect(page.getByText(/Страница 1 из 30/)).toBeVisible();

    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText(/Страница 2 из 30/)).toBeVisible();

    await page.getByPlaceholder("Поиск по номеру, комментарию, контрагенту...").fill("ПКО-2999");
    await expect(page.getByText(/Найдено: 1/)).toBeVisible();
    await expect(rowWith(page, "ПКО-2999")).toBeVisible();
  });

  /* ---------- CPU ×6 через Chrome DevTools Protocol ---------- */

  async function throttleCpu(page, rate) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    return cdp;
  }

  async function measure(action, done) {
    const t = Date.now();
    await action();
    await done();
    return Date.now() - t;
  }

  test("CPU ×6 (CDP): форма создания — добавление товаров и пересчёт без лагов", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    await openCreate(page); // прогрев чанков без замедления
    const cdp = await throttleCpu(page, 6);

    const addMs = await measure(
      () => addProduct(page, "Молоко 1л"),
      () => expect(summaryRow(page, "Итого:")).toContainText(som(150)),
    );
    const recalcMs = await measure(
      () => qtyInput(page, "Молоко 1л").fill("7"),
      () => expect(summaryRow(page, "Итого:")).toContainText(som(1050)),
    );
    const modalMs = await measure(
      () => chooseCredit(page),
      () => expect(page.getByText("Предоплата по документу")).toBeVisible(),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 create, ms",
      description: JSON.stringify({ addMs, recalcMs, modalMs }),
    });
    expect(addMs).toBeLessThan(5_000);
    expect(recalcMs).toBeLessThan(2_000);
    expect(modalMs).toBeLessThan(1_500);
  });

  test("CPU ×6 (CDP): модалка денежного документа с 1000 контрагентов", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    api.on("counterparties", (route) =>
      json(
        route,
        paginated(
          Array.from({ length: 1000 }, (_, i) => ({ id: `cp-${i}`, name: `Контрагент ${i}`, type: "CLIENT" })),
        ),
      ),
    );
    api.on("moneyDocuments", (route) => json(route, paginated(makeMoneyDocs(500))));
    await page.goto(URLS.moneyReceipt);
    await expect(page.getByText(/Всего: 500/)).toBeVisible(FIRST_RENDER);
    const cdp = await throttleCpu(page, 6);

    const openMs = await measure(
      () => page.getByRole("button", { name: "Создать приход в кассу" }).click(),
      () => expect(moneyDialog(page)).toBeVisible(),
    );
    const selectMs = await measure(
      () => moneyDialog(page).getByLabel("Контрагент").selectOption({ label: "Контрагент 999" }),
      () => expect(moneyDialog(page).getByLabel("Контрагент")).toHaveValue("cp-999"),
    );
    const searchMs = await measure(
      async () => {
        await moneyDialog(page).getByRole("button", { name: "Закрыть" }).click();
        await page.getByPlaceholder("Поиск по номеру, комментарию, контрагенту...").fill("ПКО-49");
      },
      () => expect(page.getByText(/Найдено: 11/)).toBeVisible({ timeout: 10_000 }),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 money, ms",
      description: JSON.stringify({ openMs, selectMs, searchMs }),
    });
    expect(openMs).toBeLessThan(2_000);
    expect(selectMs).toBeLessThan(2_000);
    expect(searchMs).toBeLessThan(5_000);
  });
});
