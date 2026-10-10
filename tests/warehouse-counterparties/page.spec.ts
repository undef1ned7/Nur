/**
 * E2E: контрагенты склада.
 *
 *   /crm/warehouse/counterparties        список (Counterparties.jsx): вкладки «Клиент / Поставщик»,
 *                                        период (месяц / год / произвольный), поиск, «Только с долгом»,
 *                                        фильтр по агенту, таблица / карточки, пагинация по 100,
 *                                        «Создать контрагента» (POST warehouse/crud/counterparties/);
 *   /crm/warehouse/counterparties/:id    карточка (CounterpartyDetail.jsx): реквизиты, четыре сводные
 *                                        карточки (Продажи / Сальдо / Переводы / Общие долги), история
 *                                        операций, «Оплатить долг» (POST money/documents/ → /post/),
 *                                        «Редактировать» (PUT warehouse/crud/counterparties/:id/).
 *
 * Как пункты общего чек-листа легли на эти страницы:
 *   «форма + отправка»   → создание контрагента (список), оплата долга и редактирование (карточка);
 *   «расчёты»            → итоги «Дебет / Кредит» по строкам и в «Итого», сальдо = дебиторка − кредиторка,
 *                          тип документа (приход / расход) по знаку долга, переплата → «как аванс»;
 *   «POST/PUT 500»       → 500 на создании, оплате долга, редактировании;
 *   «GET → null»         → null вместо списка, операций, справочников, самого контрагента;
 *   «тройной клик»       → «Создать», «Сохранить» в оплате долга и в редактировании.
 *
 * Чего на этих страницах НЕТ (поэтому в наборе этого нет):
 *   удаления контрагента, массовых действий, тостов и window.alert — вся обратная связь inline
 *   (блоки role="alert" внутри модалок). Модалка создания — без role="dialog" (портал #create_counter_modal).
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** + routeWebSocket): по умолчанию фронт ходит на
 * боевой https://app.nurcrm.kg/api, и тесты не должны ни читать, ни менять продовые данные.
 * Мок хранит состояние: созданный контрагент появляется в выдаче, PUT меняет карточку.
 *
 * Тесты с комментарием «Регрессия (исправлено)» поймали дефекты при первом прогоне (08.10.2026);
 * дефекты исправлены, тесты охраняют, чтобы они не вернулись.
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer в playwright.config.js):
 *   npx playwright test tests/warehouse-counterparties --project=chromium
 * Замеры раздела 5 честнее в одиночку:
 *   npx playwright test tests/warehouse-counterparties -g "5. Стресс" --workers=1
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

/* ======================================================================
   Тестовые данные
   ====================================================================== */

const DETAIL_ID = "0474b207-4957-4eda-b205-47a7f4871e08";
const URLS = {
  list: "/crm/warehouse/counterparties",
  detail: `/crm/warehouse/counterparties/${DETAIL_ID}`,
};

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим исходники Vite
// вроде http://localhost:3100/src/api/warehouse.js.
const apiPath = (path: string): RegExp =>
  new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

const API_ANY = /^https?:\/\/[^/]+\/api\//;
const ENDPOINTS = {
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  employees: apiPath("users/employees/"),
  warehouses: apiPath("warehouse/crud/warehouses/"),
  categories: apiPath("warehouse/money/categories/"),
  cashRegisters: apiPath("warehouse/cash-registers/"),
  counterparties: apiPath("warehouse/crud/counterparties/"),
  counterpartyItem: apiPath("warehouse/crud/counterparties/[^/?]+/"),
  operations: apiPath("warehouse/money/counterparties/[^/?]+/operations/"),
  moneyDocuments: apiPath("warehouse/money/documents/"),
  moneyDocumentPost: apiPath("warehouse/money/documents/[^/?]+/post/"),
  reconciliation: apiPath("warehouse/counterparties/[^/?]+/reconciliation/json/"),
} as const;
type Endpoint = keyof typeof ENDPOINTS;

type CounterpartyType = "CLIENT" | "SUPPLIER" | "BOTH";
interface BankAccount {
  id?: string;
  score: string;
  bik: string;
}
interface Counterparty {
  id: string;
  name: string;
  type: CounterpartyType;
  phone?: string | null;
  inn?: string;
  okpo?: string;
  address?: string;
  agent?: string | null;
  agent_display?: string;
  bank_accounts?: BankAccount[];
  analytics?: { debts: Record<string, number> };
}

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

const EMPLOYEES = [
  {
    id: "emp-1",
    first_name: "Айбек",
    last_name: "Агентов",
    role: "agent",
    email: "agent@e2e.test",
  },
];

const CASH_REGISTERS = [
  { id: "cr-1", name: "Касса магазина" },
  { id: "cr-2", name: "Расчётный счёт" },
];
const CATEGORIES = [
  { id: "mc-1", title: "Оплата от клиента" },
  { id: "mc-debt", title: "Погашение долга" },
];

/** Оборотка: сальдо на конец = начало + дебет − кредит (см. utils.js списка). */
const debts = (turnoverDebit: number, turnoverCredit: number) => ({
  opening_debit: 0,
  opening_credit: 0,
  turnover_debit: turnoverDebit,
  turnover_credit: turnoverCredit,
});

const makeCounterparty = (
  id: string,
  name: string,
  type: CounterpartyType,
  turnoverDebit: number,
  turnoverCredit: number,
  extra: Partial<Counterparty> = {},
): Counterparty => ({
  id,
  name,
  type,
  phone: "+996 555 000 111",
  analytics: { debts: debts(turnoverDebit, turnoverCredit) },
  ...extra,
});

/** Карточка из URL: на конец периода контрагент должен 9000 − 5000 = 4000. */
const DETAIL_CP = makeCounterparty(DETAIL_ID, "ОсОО Ромашка", "CLIENT", 9000, 5000, {
  phone: "+996 555 123 456",
  inn: "12345678901234",
  okpo: "12345678",
  address: "г. Бишкек, ул. Чуй, 1",
  agent: "emp-1",
  agent_display: "Агентов Айбек",
  bank_accounts: [{ id: "ba-1", score: "1234567890123456", bik: "123456" }],
});

/**
 * Список по умолчанию. Вкладка «Клиент» + «Только с долгом» показывает:
 *   Ромашка (дебет 9 000 / кредит 5 000 → сальдо конец: Дт 4 000),
 *   Альфа   (12 000 / 2 000 → Дт 10 000),
 *   Бета    (5 000 / 8 000 → Кт 3 000; тип BOTH виден и у клиентов, и у поставщиков).
 * «Поставщик Гамма» (SUPPLIER) — на другой вкладке, «Клиент Закрытый» (сальдо 0) — скрыт «Только с долгом».
 */
const defaultCounterparties = (): Counterparty[] => [
  { ...DETAIL_CP },
  makeCounterparty("cp-1", "Клиент Альфа", "CLIENT", 12000, 2000, {
    agent: "emp-1",
    agent_display: "Агентов Айбек",
  }),
  makeCounterparty("cp-2", "Клиент Бета", "BOTH", 5000, 8000),
  makeCounterparty("cp-3", "Поставщик Гамма", "SUPPLIER", 0, 7000),
  makeCounterparty("cp-4", "Клиент Закрытый", "CLIENT", 100, 100),
];

const makeOperation = (i: number, overrides: Record<string, unknown> = {}) => ({
  id: `op-${i}`,
  source: "money",
  doc_type: i % 2 ? "MONEY_RECEIPT" : "MONEY_EXPENSE",
  number: `ПКО-${i}`,
  date: "2026-10-01T10:00:00+06:00",
  amount: String(1000 + i),
  debt_delta: "0",
  payment_category_title: "Оплата долга",
  status: "POSTED",
  comment: `Комментарий ${i}`,
  ...overrides,
});

const SALE_OPERATION = {
  id: "op-sale",
  source: "warehouse",
  doc_type: "SALE",
  number: "SALE-0001",
  date: "2026-09-30T12:00:00+06:00",
  amount: "5000",
  debt_delta: "5000",
  payment_category_title: "Продажа",
  status: "POSTED",
  comment: "Продажа в долг",
};

/** Ответ operations по умолчанию: продажа в долг 5 000 и приход 1 000 → долг 4 000. */
const operationsResponse = (
  money: Record<string, unknown>[] = [makeOperation(1, { number: "ПКО-1", amount: "1000" })],
  extra: Record<string, unknown> = {},
) => ({
  operations: [SALE_OPERATION, ...money],
  debt_operations: [SALE_OPERATION],
  money: { count: money.length, next: null, previous: null, results: money },
  analytics: {
    sales: {
      total: 5000,
      count: 1,
      cash_total: 0,
      credit_total: 5000,
      pending_cash: { count: 0, total: 0 },
    },
    cash: { received: 1000, paid: 0, net: 1000 },
    debts: {
      counterparty_owes_company: 4000,
      company_owes_counterparty: 0,
      balance: 4000,
    },
  },
  ...extra,
});

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
interface Db {
  counterparties: Counterparty[];
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

async function mockBackend(page: Page): Promise<Api> {
  const db: Db = { counterparties: defaultCounterparties() };
  const log = {} as Record<Endpoint, Call[]>;
  let seq = 0;

  const handlers: Record<Endpoint, Handler> = {
    profile: (route) => json(route, PROFILE),
    company: (route) => json(route, COMPANY),
    employees: (route) => json(route, paginated(EMPLOYEES)),
    warehouses: (route) => json(route, paginated([{ id: "wh-1", name: "Основной склад" }])),
    categories: (route) => json(route, paginated(CATEGORIES)),
    cashRegisters: (route) => json(route, paginated(CASH_REGISTERS)),
    counterparties: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        // Ответ как у типичного DRF-сериализатора: без аналитики (долгов ещё нет).
        const created: Counterparty = {
          id: `cp-new-${seq}`,
          ...body,
          bank_accounts: body?.bank_accounts ?? [],
        };
        state.counterparties.unshift(created);
        return json(route, created, 201);
      }
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const list = q
        ? state.counterparties.filter((c) => c.name.toLowerCase().includes(q))
        : state.counterparties;
      return json(route, paginated(list));
    },
    counterpartyItem: (route, { method, url, body }, state) => {
      const id = lastSegment(url);
      const found = state.counterparties.find((c) => c.id === id);
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "PUT" || method === "PATCH") {
        Object.assign(found, body);
        return json(route, found);
      }
      return json(route, found);
    },
    operations: (route) => json(route, operationsResponse()),
    moneyDocuments: (route, { body }) => {
      seq += 1;
      return json(route, { id: `md-new-${seq}`, ...body, status: "DRAFT" }, 201);
    },
    moneyDocumentPost: (route, { url }) =>
      json(route, { id: lastSegment(url, 2), status: "POSTED" }),
    reconciliation: (route) => json(route, { operations: [], opening: 0, closing: 0 }),
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
 * Регулярка для числа в формате ru-RU. Разделитель тысяч в разных браузерах и версиях ICU —
 * пробел, NBSP (U+00A0) или узкий NBSP (U+202F), а четырёхзначные числа иногда не группируются
 * вовсе, поэтому разделитель необязателен.
 */
function numRe(n: number, decimals = 2): RegExp {
  const [int, frac] = Math.abs(n).toFixed(decimals).split(".");
  let out = "";
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % 3 === 0) out += `${SEP}?`;
    out += int[i];
  }
  if (decimals > 0) out += `,${frac}`;
  return new RegExp(out);
}

/** Типичные артефакты небезопасного рендера. */
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

/* ---------- Список ---------- */

const listHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Контрагенты" });
const createButton = (page: Page) =>
  page.getByRole("button", { name: "Создать контрагента" });
const rowWith = (page: Page, text: string | RegExp) =>
  page.getByRole("row").filter({ hasText: text });
const searchInput = (page: Page) =>
  page.getByPlaceholder("Поиск по названию контрагента...");
const onlyUnpaidSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Только с долгом" });
const typeTab = (page: Page, name: "Клиент" | "Поставщик") =>
  page.getByRole("tablist", { name: "Тип контрагента" }).getByRole("tab", { name });
const periodTab = (page: Page, name: "Месяц" | "Год" | "Период") =>
  page.getByRole("tablist", { name: "Тип периода" }).getByRole("tab", { name });
const countersText = (page: Page, shown: number, total = shown) =>
  page.getByText(`Всего: ${total} • Найдено: ${shown}`);

async function openList(page: Page): Promise<void> {
  await page.goto(URLS.list);
  await expect(listHeading(page)).toBeVisible(FIRST_RENDER);
}

/**
 * Модалка создания: портал без role="dialog" — берём по id обёртки. Сама обёртка имеет нулевой
 * размер (содержимое позиционируется поверх страницы), поэтому toBeVisible/toBeHidden на ней
 * бессмысленны: «открыта ли модалка» проверяем по полю названия (f.name).
 */
const createModal = (page: Page) => page.locator("#create_counter_modal");

const createFields = (page: Page) => {
  const modal = createModal(page);
  return {
    modal,
    name: modal.getByPlaceholder("Введите название контрагента"),
    phone: modal.getByPlaceholder("Введите номер телефона (необязательно)"),
    type: modal.locator('select[name="type"]'),
    inn: modal.getByLabel("ИНН"),
    okpo: modal.getByLabel("ОКПО"),
    address: modal.getByLabel("Адрес", { exact: true }),
    addAccount: modal.getByRole("button", { name: "Добавить счёт" }),
    score: modal.getByPlaceholder("Введите расчётный счёт"),
    bik: modal.getByPlaceholder("Введите БИК"),
    submit: modal.getByRole("button", { name: /^(Создать|Создание\.\.\.)$/ }),
    cancel: modal.getByRole("button", { name: "Отмена" }),
    errors: modal.getByRole("alert"),
  };
}

async function openCreateModal(page: Page) {
  await openList(page);
  await createButton(page).click();
  const f = createFields(page);
  await expect(f.name).toBeVisible();
  return f;
}

/* ---------- Карточка ---------- */

const detailHeading = (page: Page, name: string | RegExp = /^Контрагент: /) =>
  page.getByRole("heading", { level: 1, name });

async function openDetail(page: Page): Promise<void> {
  await page.goto(URLS.detail);
  await expect(detailHeading(page, "Контрагент: ОсОО Ромашка")).toBeVisible(FIRST_RENDER);
}

/** Сводная карточка: подпись, значение и подсказка — соседи в одном контейнере. */
const summaryCard = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).first().locator("..");

const payDebtButton = (page: Page) => page.getByRole("button", { name: "Оплатить долг" });
const payDialog = (page: Page) => page.getByRole("dialog", { name: /оплата долга/ });

const payFields = (page: Page) => {
  const dlg = payDialog(page);
  return {
    dlg,
    cash: dlg.getByLabel("Касса *"),
    category: dlg.getByLabel("Категория платежа *"),
    date: dlg.getByLabel("Дата", { exact: true }),
    amount: dlg.getByLabel("Сумма, сом *"),
    comment: dlg.getByLabel("Комментарий"),
    posted: dlg.getByRole("switch", { name: "Документ проведён" }),
    draft: dlg.getByRole("switch", { name: "Черновик" }),
    submit: dlg.getByRole("button", { name: /^(Сохранить|Сохранение…)$/ }),
    saving: dlg.getByRole("button", { name: "Сохранение…" }),
    error: dlg.locator("[class*='form-error']"),
    close: dlg.getByRole("button", { name: "Закрыть" }),
  };
};

async function openPayDebt(page: Page) {
  await openDetail(page);
  await expect(summaryCard(page, "Сальдо")).toContainText(numRe(4000), FIRST_RENDER);
  await payDebtButton(page).click();
  const f = payFields(page);
  await expect(f.dlg).toBeVisible();
  return f;
}

const editHeading = (page: Page) =>
  page.getByRole("heading", { name: "Редактировать контрагента" });
const editFields = (page: Page) => ({
  name: page.getByPlaceholder("Введите название контрагента"),
  phone: page.getByPlaceholder("Введите номер телефона (необязательно)"),
  type: page.locator('select[name="type"]'),
  addAccount: page.getByRole("button", { name: "Добавить счёт" }),
  score: page.getByPlaceholder("Введите расчётный счёт"),
  bik: page.getByPlaceholder("Введите БИК"),
  submit: page.getByRole("button", { name: /^(Сохранить|Сохранение\.\.\.)$/ }),
  cancel: page.getByRole("button", { name: "Отмена" }),
  errors: page.getByRole("alert"),
});

async function openEdit(page: Page) {
  await openDetail(page);
  await page.getByRole("button", { name: "Редактировать" }).click();
  await expect(editHeading(page)).toBeVisible();
  return editFields(page);
}

/* ======================================================================
   1. ХЕППИ-ПАТ
   ====================================================================== */

test.describe("1. Хеппи-пат: список (/crm/warehouse/counterparties)", () => {
  test("первая загрузка: запрос с периодом «месяц», «Только с долгом», вкладка «Клиент»", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();

    // Один GET: все фильтры, кроме поиска/периода/«только с долгом», клиентские.
    const url = api.calls("counterparties", "GET")[0].url;
    expect(url.searchParams.get("page_size")).toBe("1000");
    expect(url.searchParams.get("only_unpaid")).toBe("1");
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("search")).toBe(false);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(url.searchParams.get("date_from")).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    );

    // Вкладка «Клиент»: клиенты и «клиенты и поставщики»; закрытое сальдо скрыто.
    await expect(typeTab(page, "Клиент")).toHaveAttribute("aria-selected", "true");
    await expect(rowWith(page, "ОсОО Ромашка")).toBeVisible();
    await expect(rowWith(page, "Клиент Бета")).toBeVisible();
    await expect(rowWith(page, "Поставщик Гамма")).toHaveCount(0);
    await expect(rowWith(page, "Клиент Закрытый")).toHaveCount(0);
    await expect(countersText(page, 3)).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("расчёты: Дебет / Кредит по строкам и строка «Итого»", async ({ page }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();

    // Альфа: оборот Дт 12 000, Кт 2 000 → сальдо на конец Дт 10 000.
    const alpha = rowWith(page, "Клиент Альфа");
    await expect(alpha).toContainText(numRe(12000));
    await expect(alpha).toContainText(numRe(2000));
    await expect(alpha).toContainText(numRe(10000));
    // Бета: оборот Дт 5 000, Кт 8 000 → сальдо переходит в КРЕДИТ 3 000.
    const beta = rowWith(page, "Клиент Бета");
    await expect(beta).toContainText(numRe(5000));
    await expect(beta).toContainText(numRe(8000));
    await expect(beta).toContainText(numRe(3000));

    // «Итого» по всем отфильтрованным: оборот Дт 9 000 + 12 000 + 5 000 = 26 000,
    // Кт 5 000 + 2 000 + 8 000 = 15 000; сальдо конец Дт 4 000 + 10 000 = 14 000, Кт 3 000.
    const total = rowWith(page, "Итого");
    await expect(total).toContainText(numRe(26000));
    await expect(total).toContainText(numRe(15000));
    await expect(total).toContainText(numRe(14000));
    await expect(total).toContainText(numRe(3000));
  });

  test("вкладка «Поставщик» меняет выборку без нового запроса", async ({ page, api }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    const before = api.calls("counterparties", "GET").length;

    await typeTab(page, "Поставщик").click();
    await expect(typeTab(page, "Поставщик")).toHaveAttribute("aria-selected", "true");
    await expect(rowWith(page, "Поставщик Гамма")).toBeVisible();
    // BOTH виден на обеих вкладках, чистые клиенты — нет.
    await expect(rowWith(page, "Клиент Бета")).toBeVisible();
    await expect(rowWith(page, "Клиент Альфа")).toHaveCount(0);
    await expect(countersText(page, 2)).toBeVisible();
    expect(api.calls("counterparties", "GET").length).toBe(before);
  });

  test("«Только с долгом» выключен: показываются и контрагенты с закрытым сальдо", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    await expect(rowWith(page, "Клиент Закрытый")).toHaveCount(0);

    await onlyUnpaidSwitch(page).click();
    await expect(onlyUnpaidSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(rowWith(page, "Клиент Закрытый")).toBeVisible();
    await expect
      .poll(() => api.calls("counterparties", "GET").at(-1)?.url.searchParams.get("only_unpaid"))
      .not.toBe("1");
  });

  test("поиск уходит на сервер с задержкой и сужает список", async ({ page, api }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();

    const req = page.waitForRequest(
      (r) =>
        ENDPOINTS.counterparties.test(r.url()) &&
        r.url().includes("search=%D0%90%D0%BB%D1%8C%D1%84%D0%B0"),
    );
    await searchInput(page).fill("Альфа");
    await req;
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    await expect(rowWith(page, "Клиент Бета")).toHaveCount(0);
    expect(api.calls("counterparties", "GET").at(-1)?.url.searchParams.get("search")).toBe(
      "Альфа",
    );
  });

  test("период: «Год» и «Период» перезапрашивают данные с новыми датами", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();

    const yearReq = page.waitForRequest(
      (r) => ENDPOINTS.counterparties.test(r.url()) && /date_from=\d{4}-01-01/.test(r.url()),
    );
    await periodTab(page, "Год").click();
    await yearReq;
    await expect(periodTab(page, "Год")).toHaveAttribute("aria-selected", "true");
    const y = api.calls("counterparties", "GET").at(-1)!.url;
    expect(y.searchParams.get("date_to")).toMatch(/^\d{4}-12-31$/);

    await periodTab(page, "Период").click();
    const customReq = page.waitForRequest(
      (r) =>
        ENDPOINTS.counterparties.test(r.url()) &&
        r.url().includes("date_from=2026-01-10") &&
        r.url().includes("date_to=2026-02-20"),
    );
    await page.getByLabel("Дата с", { exact: true }).fill("2026-01-10");
    await page.getByLabel("Дата по", { exact: true }).fill("2026-02-20");
    await customReq;
  });

  test("фильтр по агенту (владелец): «Без агента» и конкретный агент", async ({ page }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    const select = page.getByLabel("Фильтр по агенту");

    await select.selectOption("__no_agent__");
    await expect(rowWith(page, "Клиент Бета")).toBeVisible();
    await expect(rowWith(page, "Клиент Альфа")).toHaveCount(0);

    await select.selectOption({ label: "Агентов Айбек" });
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    await expect(rowWith(page, "Клиент Бета")).toHaveCount(0);

    // Смена вкладки сбрасывает фильтр по агенту.
    await typeTab(page, "Поставщик").click();
    await expect(select).toHaveValue("");
  });

  test("карточки: тип, телефон и переход по «Открыть»", async ({ page }) => {
    await openList(page);
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page.getByText("Тип: Клиент", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Тип: Клиент и поставщик")).toBeVisible();
    await expect(page.getByText(/Телефон/).first()).toBeVisible();

    await page.getByRole("button", { name: "Открыть" }).first().click();
    await expect(page).toHaveURL(/\/crm\/warehouse\/counterparties\/[^/]+$/);
  });

  test("клик по строке таблицы открывает карточку контрагента", async ({ page }) => {
    await openList(page);
    await rowWith(page, "ОсОО Ромашка").click();
    await expect(page).toHaveURL(new RegExp(`${URLS.detail}$`));
    await expect(detailHeading(page, "Контрагент: ОсОО Ромашка")).toBeVisible(FIRST_RENDER);
  });

  test("создание контрагента: форма → POST → модалка закрыта, список обновлён", async ({
    page,
    api,
  }) => {
    const f = await openCreateModal(page);
    await expect(createModal(page).getByRole("heading", { name: "Создать контрагента" })).toBeVisible();

    await f.name.fill("ОсОО Новый Клиент");
    await f.phone.fill("+996 700 123 456");
    await f.type.selectOption("BOTH");
    await f.inn.fill("12345678901234");
    await f.okpo.fill("87654321");
    await f.address.fill("г. Ош, ул. Ленина, 5");
    await f.addAccount.click();
    await f.score.first().fill("1234567890123456");
    await f.bik.first().fill("654321");
    await f.submit.click();

    await expect(f.name).toBeHidden();
    const created = api.calls("counterparties", "POST");
    expect(created).toHaveLength(1);
    expect(created[0].body).toMatchObject({
      name: "ОсОО Новый Клиент",
      type: "BOTH",
      phone: "+996 700 123 456",
      inn: "12345678901234",
      okpo: "87654321",
      address: "г. Ош, ул. Ленина, 5",
    });
    // Банковские счета уходят только полными парами, плюс первая пара «плоскими» полями.
    expect(created[0].body.bank_accounts).toEqual([
      { score: "1234567890123456", bik: "654321" },
    ]);
    expect(created[0].body).toMatchObject({ score: "1234567890123456", bik: "654321" });

    // Контрагент без долга скрыт фильтром «Только с долгом», поэтому после создания фильтр
    // снимается сам — новая запись сразу видна.
    await expect(onlyUnpaidSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(rowWith(page, "ОсОО Новый Клиент")).toBeVisible();
  });

  test("созданный контрагент сразу виден в списке (при включённом «Только с долгом»)", async ({
    page,
  }) => {
    // Регрессия (исправлено): после «Создать» модалка молча закрывается, а новый контрагент (долга ещё нет)
    // отфильтрован клиентским «Только с долгом» (включён по умолчанию) — пользователю кажется,
    // что сохранение не сработало. Нужно либо показывать новую запись, либо сообщить
    // «Контрагент создан. Отключите «Только с долгом», чтобы увидеть его».
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Видимый");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    await expect(rowWith(page, "ОсОО Видимый")).toBeVisible({ timeout: 3_000 });
  });

  test("созданный поставщик: открывается вкладка «Поставщик» и запись видна", async ({
    page,
  }) => {
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Новый Поставщик");
    await f.type.selectOption("SUPPLIER");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    await expect(typeTab(page, "Поставщик")).toHaveAttribute("aria-selected", "true");
    await expect(rowWith(page, "ОсОО Новый Поставщик")).toBeVisible();
  });

  test("модалка закрывается по «Отмена» и по клику на оверлей, данные не сохраняются", async ({
    page,
    api,
  }) => {
    const f = await openCreateModal(page);
    await f.name.fill("Не сохранять");
    await f.cancel.click();
    await expect(f.name).toBeHidden();

    // Повторное открытие — пустая форма.
    await createButton(page).click();
    await expect(f.name).toHaveValue("");
    await page.mouse.click(5, 5); // оверлей закрывает модалку
    await expect(f.name).toBeHidden();
    expect(api.calls("counterparties", "POST")).toHaveLength(0);
  });
});

test.describe("1. Хеппи-пат: карточка (/crm/warehouse/counterparties/:id)", () => {
  test("загрузка: реквизиты, агент и четыре сводные карточки", async ({ page, api }) => {
    await openDetail(page);

    expect(api.calls("counterpartyItem", "GET")[0].url.pathname).toContain(
      `/warehouse/crud/counterparties/${DETAIL_ID}/`,
    );
    const ops = api.calls("operations", "GET")[0].url;
    expect(ops.pathname).toContain(`/counterparties/${DETAIL_ID}/operations/`);
    expect(ops.searchParams.get("include_debts")).toBe("1");

    // Реквизиты.
    const requisites = page.getByRole("region", { name: "Реквизиты контрагента" });
    await expect(requisites).toContainText("12345678901234");
    await expect(requisites).toContainText("12345678");
    await expect(requisites).toContainText("г. Бишкек, ул. Чуй, 1");
    await expect(requisites).toContainText("1234567890123456");
    await expect(requisites).toContainText("123456");
    await expect(page.getByText("Привязан к агенту: Агентов Айбек")).toBeVisible();

    // Продажи: сумма и разбивка «наличные / в долг».
    const sales = summaryCard(page, "Продажи");
    await expect(sales).toContainText(numRe(5000));
    await expect(sales).toContainText("1 док.");
    await expect(sales).toContainText("в долг");
    // Сальдо = контрагент должен 4 000 − мы должны 0.
    const saldo = summaryCard(page, "Сальдо");
    await expect(saldo).toContainText(numRe(4000));
    await expect(saldo).toContainText("Дт · контрагент должен вам");
    // Переводы: приход 1 000, расход 0.
    const transfers = summaryCard(page, "Переводы");
    await expect(transfers).toContainText(new RegExp(`Приход:\\s*${numRe(1000).source}`));
    await expect(transfers).toContainText(/Расход:\s*0,00/);
    // Общие долги.
    const debtsCard = summaryCard(page, "Общие долги");
    await expect(debtsCard).toContainText(numRe(4000));
    await expect(debtsCard).toContainText("Контрагент должен вам");
    await expect(debtsCard).toContainText("Кредитных документов: 1");
    await expectNoRenderGarbage(page);
  });

  test("история операций: разделы, счётчики, тип и статус по-русски, изменение долга со знаком", async ({
    page,
  }) => {
    await openDetail(page);
    const all = page.getByText("Все операции", { exact: true });
    await expect(all).toBeVisible();
    await expect(all.locator("..")).toContainText("2 шт.");

    const sale = rowWith(page, "SALE-0001").first();
    await expect(sale).toBeVisible();
    await expect(sale).toContainText("Проведён");
    await expect(sale).toContainText(numRe(5000, 0));
    // Изменение долга: плюс у продажи в долг.
    await expect(sale).toContainText(new RegExp(`\\+${numRe(5000).source}`));

    const receipt = rowWith(page, "ПКО-1").first();
    await expect(receipt).toContainText("Оплата долга");
    await expect(receipt).toContainText("Комментарий 1");
    // Остальные разделы свёрнуты и раскрываются кликом.
    await expect(page.getByText("Денежные документы", { exact: true })).toBeVisible();
    await expect(page.getByText("Долговые операции (кредитные документы)")).toBeVisible();
  });

  test("фильтры: тип документа, статус, поиск → параметры запроса; «Обновить» перезапрашивает", async ({
    page,
    api,
  }) => {
    await openDetail(page);
    const lastOps = () => api.calls("operations", "GET").at(-1)!.url.searchParams;

    const typeReq = page.waitForRequest(
      (r) => ENDPOINTS.operations.test(r.url()) && r.url().includes("doc_type=MONEY_RECEIPT"),
    );
    await page.getByLabel("Тип документа").selectOption("MONEY_RECEIPT");
    await typeReq;
    await expect.poll(() => lastOps().get("doc_type")).toBe("MONEY_RECEIPT");

    await page.getByLabel("Статус", { exact: true }).selectOption("POSTED");
    await expect.poll(() => lastOps().get("status")).toBe("POSTED");

    const searchReq = page.waitForRequest(
      (r) => ENDPOINTS.operations.test(r.url()) && r.url().includes("search="),
    );
    await page.getByLabel("Поиск по номеру и комментарию").fill("ПКО-1");
    await searchReq;
    await expect.poll(() => lastOps().get("search")).toBe("ПКО-1");

    // Сброс фильтра возвращает общий запрос.
    await page.getByLabel("Тип документа").selectOption("");
    await expect.poll(() => lastOps().has("doc_type")).toBe(false);
    const before = api.calls("operations", "GET").length;
    await page.getByRole("button", { name: "Обновить" }).click();
    await expect.poll(() => api.calls("operations", "GET").length).toBeGreaterThan(before);
  });

  test("карточки операций и возврат «Назад» к списку", async ({ page }) => {
    await openDetail(page);
    await page.getByTitle("Карточки").click();
    await expect(page.getByText("SALE-0001").first()).toBeVisible();
    await page.getByTitle("Таблица").click();
    await expect(rowWith(page, "SALE-0001").first()).toBeVisible();

    await page.getByRole("button", { name: "Назад к списку" }).click();
    await expect(page).toHaveURL(new RegExp(`${URLS.list}$`));
    await expect(listHeading(page)).toBeVisible(FIRST_RENDER);
  });

  test("оплата долга: форма предзаполнена, проводится двумя запросами, тип — приход", async ({
    page,
    api,
  }) => {
    const f = await openPayDebt(page);
    // Контрагент должен нам (сальдо > 0) → приход в кассу.
    await expect(f.dlg.getByRole("heading", { name: "Приход (оплата долга)" })).toBeVisible();
    await expect(f.cash).toHaveValue("cr-1");
    await expect(f.category).toHaveValue("mc-debt"); // «Погашение долга» подобрана автоматически
    await expect(f.amount).toHaveValue("4000");
    await expect(f.comment).toHaveValue("Погашение долга");
    await expect(f.posted).toHaveAttribute("aria-checked", "true");

    const opsBefore = api.calls("operations", "GET").length;
    await f.amount.fill("1 500,50");
    await f.submit.click();
    await expect(f.dlg).toBeHidden();

    const created = api.calls("moneyDocuments", "POST");
    expect(created).toHaveLength(1);
    // Пробелы в сумме вырезаются, запятая → точка, сумма уходит числом.
    expect(created[0].body).toMatchObject({
      doc_type: "MONEY_RECEIPT",
      cash_register: "cr-1",
      counterparty: DETAIL_ID,
      payment_category: "mc-debt",
      amount: 1500.5,
      comment: "Погашение долга",
    });
    expect(created[0].body.allow_advance).toBeUndefined();
    // Сразу же проводится.
    const posts = api.calls("moneyDocumentPost", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toContain("/md-new-1/post/");
    // История перезапрошена.
    await expect.poll(() => api.calls("operations", "GET").length).toBeGreaterThan(opsBefore);
  });

  test("оплата долга черновиком: выключенный тумблер — без проведения", async ({
    page,
    api,
  }) => {
    const f = await openPayDebt(page);
    await f.posted.click();
    await expect(f.draft).toHaveAttribute("aria-checked", "false");
    await f.submit.click();
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
    expect(api.calls("moneyDocumentPost")).toHaveLength(0);
  });

  test("переплата: предупреждение, «Оплатить только долг» и «Провести как аванс»", async ({
    page,
    api,
  }) => {
    const f = await openPayDebt(page);
    await f.amount.fill("5000"); // долг 4 000 → переплата 1 000
    await f.submit.click();

    const warning = f.dlg.getByRole("alert").filter({ hasText: "Сумма больше долга" });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Провести переплату как аванс?");
    // Пока пользователь не решил — ничего не отправлено.
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);

    // «Оплатить только долг» возвращает сумму к долгу.
    await f.dlg.getByRole("button", { name: "Оплатить только долг" }).click();
    await expect(f.amount).toHaveValue("4000");
    await expect(warning).toBeHidden();

    // Снова переплата → «Провести как аванс»: уходит allow_advance.
    await f.amount.fill("5000");
    await f.submit.click();
    await f.dlg.getByRole("button", { name: "Провести как аванс" }).click();
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body).toMatchObject({
      amount: 5000,
      allow_advance: true,
    });
    expect(api.calls("moneyDocumentPost", "POST")[0].body).toMatchObject({
      allow_advance: true,
    });
  });

  test("долга нет → «Оплатить долг» не показывается; аванс → расход", async ({ page, api }) => {
    // Расчёты закрыты: баланс 0, кнопки нет.
    api.on("operations", (route) =>
      json(
        route,
        operationsResponse([], {
          analytics: {
            sales: { total: 0, count: 0, cash_total: 0, credit_total: 0, pending_cash: { count: 0, total: 0 } },
            cash: { received: 0, paid: 0, net: 0 },
            debts: { counterparty_owes_company: 0, company_owes_counterparty: 0, balance: 0 },
          },
          operations: [],
          debt_operations: [],
        }),
      ),
    );
    await openDetail(page);
    await expect(summaryCard(page, "Сальдо")).toContainText("Расчёты закрыты");
    await expect(summaryCard(page, "Общие долги")).toContainText("Долг закрыт");
    await expect(payDebtButton(page)).toHaveCount(0);
  });

  test("мы должны контрагенту (аванс): сальдо Кт, оплата долга — расход", async ({
    page,
    api,
  }) => {
    api.on("operations", (route) =>
      json(
        route,
        operationsResponse([], {
          operations: [],
          debt_operations: [],
          analytics: {
            sales: { total: 0, count: 0, cash_total: 0, credit_total: 0, pending_cash: { count: 0, total: 0 } },
            cash: { received: 0, paid: 2500, net: -2500 },
            debts: { counterparty_owes_company: 0, company_owes_counterparty: 2500, balance: -2500 },
          },
        }),
      ),
    );
    await openDetail(page);
    await expect(summaryCard(page, "Сальдо")).toContainText("Кт · вы должны контрагенту (аванс)");
    await expect(summaryCard(page, "Общие долги")).toContainText("Вы должны контрагенту");

    await payDebtButton(page).click();
    const f = payFields(page);
    await expect(f.dlg.getByRole("heading", { name: "Расход (оплата долга)" })).toBeVisible();
    await expect(f.amount).toHaveValue("2500");
    await f.submit.click();
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body).toMatchObject({
      doc_type: "MONEY_EXPENSE",
      amount: 2500,
    });
  });

  test("редактирование: PUT с изменёнными полями, заголовок обновляется", async ({
    page,
    api,
  }) => {
    const f = await openEdit(page);
    // Предзаполнение из карточки.
    await expect(f.name).toHaveValue("ОсОО Ромашка");
    await expect(f.phone).toHaveValue("+996 555 123 456");
    await expect(f.type).toHaveValue("CLIENT");
    await expect(f.score.first()).toHaveValue("1234567890123456");

    await f.name.fill("ОсОО Ромашка Плюс");
    await f.type.selectOption("SUPPLIER");
    await f.submit.click();
    await expect(editHeading(page)).toBeHidden();

    const puts = api.calls("counterpartyItem", "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].url.pathname).toContain(`/${DETAIL_ID}/`);
    expect(puts[0].body).toMatchObject({
      name: "ОсОО Ромашка Плюс",
      type: "SUPPLIER",
      phone: "+996 555 123 456",
      inn: "12345678901234",
      okpo: "12345678",
    });
    expect(puts[0].body.bank_accounts).toEqual([
      { score: "1234567890123456", bik: "123456" },
    ]);
    await expect(detailHeading(page, "Контрагент: ОсОО Ромашка Плюс")).toBeVisible();
  });
});

/* ======================================================================
   2. ЗАЩИТА ОТ ДУРАКА
   ====================================================================== */

test.describe("2. Защита от дурака: создание контрагента", () => {
  test("тройной клик по «Создать»: уходит ОДИН запрос", async ({ page, api }) => {
    api.on("counterparties", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.counterparties));
      await delay(800); // медленный бэк — окно для повторных кликов
      return json(route, { id: "cp-slow", ...body }, 201);
    });
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Медленный");
    await f.submit.click({ clickCount: 3 });
    // Пока идёт запрос — «Создание...» и заблокированные поля.
    await expect(createModal(page).getByRole("button", { name: "Создание..." })).toBeDisabled();
    await expect(f.name).toBeDisabled();
    await expect(f.name).toBeHidden({ timeout: 10_000 });
    expect(api.calls("counterparties", "POST")).toHaveLength(1);
  });

  test("пустая форма: ошибка под полем, aria-invalid, запросов нет", async ({ page, api }) => {
    const f = await openCreateModal(page);
    await f.submit.click();

    const error = f.modal.getByRole("alert").filter({ hasText: "Название контрагента обязательно" });
    await expect(error).toBeVisible();
    await expect(f.name).toHaveAttribute("aria-invalid", "true");
    await expect(f.name).toBeFocused();
    await expect(f.name).toBeVisible();
    expect(api.calls("counterparties", "POST")).toHaveLength(0);

    // Ввод очищает ошибку.
    await f.name.fill("А");
    await expect(error).toBeHidden();
  });

  test("название из одних пробелов считается пустым", async ({ page, api }) => {
    const f = await openCreateModal(page);
    await f.name.fill("     ");
    await f.submit.click();
    await expect(f.modal.getByRole("alert")).toContainText("Название контрагента обязательно");
    expect(api.calls("counterparties", "POST")).toHaveLength(0);
  });

  for (const phone of ["abc", "12", "+99", "---", "<script>"]) {
    test(`некорректный телефон «${phone}» отклоняется`, async ({ page, api }) => {
      const f = await openCreateModal(page);
      await f.name.fill("ОсОО Телефон");
      await f.phone.fill(phone);
      await f.submit.click();
      await expect(f.modal.getByRole("alert")).toContainText(
        "Неверный формат телефона. Пример: +996 555 123 456",
      );
      await expect(f.phone).toHaveAttribute("aria-invalid", "true");
      expect(api.calls("counterparties", "POST")).toHaveLength(0);
    });
  }

  for (const phone of ["+996 555 123 456", "0555123456", "0312 12-34-56"]) {
    test(`допустимый телефон «${phone}» принимается`, async ({ page, api }) => {
      const f = await openCreateModal(page);
      await f.name.fill("ОсОО Телефон");
      await f.phone.fill(phone);
      await f.submit.click();
      await expect(f.name).toBeHidden();
      expect(api.calls("counterparties", "POST")[0].body.phone).toBe(phone);
    });
  }

  test("гигантское название обрезается полем до 255 символов", async ({ page, api }) => {
    // Поле имеет maxLength=255: и вставка, и ручной ввод обрезаются браузером. Ветка валидации
    // «Название не должно превышать 255 символов» через интерфейс недостижима (страховка от обхода).
    const f = await openCreateModal(page);
    await f.name.fill("Ж".repeat(10_000));
    expect((await f.name.inputValue()).length).toBe(255);
    await f.name.fill("");
    await f.name.click();
    await page.keyboard.insertText("Я".repeat(400));
    expect((await f.name.inputValue()).length).toBe(255);

    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("counterparties", "POST")[0].body.name).toHaveLength(255);
  });

  test("Р/С без БИК и БИК без Р/С: «должны указываться вместе»", async ({ page, api }) => {
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Банк");
    await f.addAccount.click();
    await f.score.first().fill("1234567890123456");
    await f.submit.click();
    await expect(f.modal.getByRole("alert")).toContainText("Р/С и БИК должны указываться вместе");

    await f.score.first().fill("");
    await f.bik.first().fill("123456");
    await f.submit.click();
    await expect(f.modal.getByRole("alert")).toContainText("Р/С и БИК должны указываться вместе");
    expect(api.calls("counterparties", "POST")).toHaveLength(0);
  });

  test("неполная пара счёта не уходит на сервер, полная — уходит", async ({ page, api }) => {
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Счета");
    await f.addAccount.click();
    await f.addAccount.click();
    // Первая строка заполнена полностью, вторая — пустая: пустая строка игнорируется.
    await f.score.nth(0).fill("111");
    await f.bik.nth(0).fill("222");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("counterparties", "POST")[0].body.bank_accounts).toEqual([
      { score: "111", bik: "222" },
    ]);
  });

  test("отрицательные числа и мусор в ИНН/ОКПО уходят как текст и не ломают страницу", async ({
    page,
    api,
  }) => {
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Цифры");
    await f.inn.fill("-123456789");
    await f.okpo.fill("{}&");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    // Поля ИНН/ОКПО не валидируются на клиенте — решение остаётся за бэкендом.
    expect(api.calls("counterparties", "POST")[0].body).toMatchObject({
      inn: "-123456789",
      okpo: "{}&",
    });
  });

  test("спецсимволы и XSS в названии сохраняются как текст и не исполняются", async ({
    page,
    api,
  }) => {
    const evil = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>{}&amp;&"'`;
    const f = await openCreateModal(page);
    await f.name.fill(evil.slice(0, 255));
    await f.address.fill(evil);
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("counterparties", "POST")[0].body.name).toBe(evil.slice(0, 255));

    const row = rowWith(page, "onerror");
    await expect(row).toBeVisible();
    // Разметка выведена буквально, «&amp;» не раскодирован.
    await expect(row.getByRole("cell").nth(1)).toContainText(evil.slice(0, 255));
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("гигантские значения в остальных полях не роняют форму", async ({ page, api }) => {
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Гигант");
    await f.address.fill("Ж".repeat(10_000));
    await f.inn.fill("9".repeat(5_000));
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("counterparties", "POST")[0].body.address).toHaveLength(10_000);
  });
});

test.describe("2. Защита от дурака: список", () => {
  test("мусорные данные из бэка: пустые имена, XSS, неизвестный тип, отрицательные суммы", async ({
    page,
    api,
  }) => {
    const evilName = `<img src=x onerror="window.__xss=1">Жертва & {}`;
    api.on("counterparties", (route) =>
      json(
        route,
        paginated([
          makeCounterparty("g-1", evilName, "CLIENT", 1000, 0),
          { id: "g-2", name: "", type: "CLIENT", analytics: { debts: debts(500, 0) } },
          // Неизвестный тип: такая запись скрыта на обеих вкладках (клиентский фильтр).
          makeCounterparty("g-3", "Тип неизвестен", "WEIRD" as CounterpartyType, 10, 0),
          // Строки вместо чисел и отрицательные значения.
          makeCounterparty("g-4", "Строковые суммы", "CLIENT", "abc" as unknown as number, -50),
        ]),
      ),
    );
    await openList(page);
    await expect(rowWith(page, "onerror")).toBeVisible();
    await expect(page.getByText("Без названия")).toBeVisible();
    await expect(rowWith(page, "Тип неизвестен")).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expectNoRenderGarbage(page);
  });

  test("сохранённые фильтры (sessionStorage) не ломают страницу при мусорном значении", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("warehouse:counterparties:typeTab", "{не json");
      sessionStorage.setItem("warehouse:counterparties:search", "x".repeat(5000));
      sessionStorage.setItem("warehouse:counterparties:onlyUnpaid", '"строка"');
    });
    await page.goto(URLS.list);
    await expect(listHeading(page)).toBeVisible(FIRST_RENDER);
  });
});

test.describe("2. Защита от дурака: оплата долга", () => {
  test("тройной клик по «Сохранить»: один документ, кнопка «Сохранение…» заблокирована", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", async (route, { body }) => {
      await delay(800);
      return json(route, { id: "md-slow", ...body }, 201);
    });
    const f = await openPayDebt(page);
    await f.submit.click({ clickCount: 3 });
    await expect(f.saving).toBeDisabled();
    await expect(f.dlg).toBeHidden({ timeout: 10_000 });
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
    expect(api.calls("moneyDocumentPost", "POST")).toHaveLength(1);
  });

  for (const amount of ["-5", "0", "abc", "{}", "<script>"]) {
    test(`некорректная сумма «${amount}» отклоняется`, async ({ page, api }) => {
      const f = await openPayDebt(page);
      await f.amount.fill(amount);
      await f.submit.click();
      await expect(f.error).toContainText("Укажите корректную сумму");
      await expect(f.dlg).toBeVisible();
      expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
    });
  }

  test("бесконечная сумма «1e999999» не уходит на сервер как null", async ({ page, api }) => {
    // Регрессия (исправлено): Number("1e999999") === Infinity проходит проверку «не NaN и > 0», форма показывает
    // «переплата на ∞ сом», а по «Провести как аванс» JSON.stringify(Infinity) превращает сумму
    // в null — на сервер уходит документ с amount: null. Нужна проверка Number.isFinite.
    const f = await openPayDebt(page);
    await f.amount.fill("1e999999");
    await f.submit.click();
    await expect(f.error).toContainText("Укажите корректную сумму", { timeout: 3_000 });
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  test("сумма из одних пробелов: «Заполните кассу, категорию и сумму»", async ({ page, api }) => {
    const f = await openPayDebt(page);
    await f.amount.fill("   ");
    await f.submit.click();
    await expect(f.error).toContainText("Заполните кассу, категорию и сумму");
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  test("пустые обязательные поля останавливает браузерная валидация", async ({ page, api }) => {
    const f = await openPayDebt(page);
    await f.amount.fill("");
    await f.cash.selectOption("");
    await f.submit.click();
    for (const field of [f.amount, f.cash]) {
      expect(await field.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false);
    }
    await expect(f.dlg).toBeVisible();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });

  test("спецсимволы и гигантский комментарий уходят как есть и не исполняются", async ({
    page,
    api,
  }) => {
    const comment = `<script>window.__xss=1</script>{}&amp;&"' ${"Ж".repeat(10_000)}`;
    const f = await openPayDebt(page);
    await f.comment.fill(comment);
    await f.submit.click();
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")[0].body.comment).toBe(comment);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test("закрытие по крестику и по оверлею не отправляет запросов", async ({ page, api }) => {
    const f = await openPayDebt(page);
    await f.close.click();
    await expect(f.dlg).toBeHidden();
    await payDebtButton(page).click();
    await expect(f.dlg).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(0);
  });
});

test.describe("2. Защита от дурака: редактирование", () => {
  test("пустое название и неверный телефон: ошибки под полями, PUT не уходит", async ({
    page,
    api,
  }) => {
    const f = await openEdit(page);
    await f.name.fill("");
    await f.submit.click();
    await expect(f.errors.filter({ hasText: "Название контрагента обязательно" })).toBeVisible();

    await f.name.fill("ОсОО Ромашка");
    await f.phone.fill("abc");
    await f.submit.click();
    await expect(f.errors.filter({ hasText: "Неверный формат телефона" })).toBeVisible();
    expect(api.calls("counterpartyItem", "PUT")).toHaveLength(0);

    // Пустой телефон допустим и уходит как null.
    await f.phone.fill("");
    await f.submit.click();
    await expect(editHeading(page)).toBeHidden();
    expect(api.calls("counterpartyItem", "PUT")[0].body.phone).toBeNull();
  });

  test("тройной клик по «Сохранить»: один PUT", async ({ page, api }) => {
    api.on("counterpartyItem", async (route, { method, body }, db) => {
      if (method !== "PUT") return json(route, db.counterparties[0]);
      await delay(800);
      return json(route, { ...DETAIL_CP, ...body });
    });
    const f = await openEdit(page);
    await f.name.fill("ОсОО Тройной клик");
    await f.submit.click({ clickCount: 3 });
    await expect(page.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
    await expect(editHeading(page)).toBeHidden({ timeout: 10_000 });
    expect(api.calls("counterpartyItem", "PUT")).toHaveLength(1);
  });

  test("XSS в названии выводится заголовком как текст", async ({ page }) => {
    const evil = `<img src=x onerror="window.__xss=1">Имя`;
    const f = await openEdit(page);
    await f.name.fill(evil);
    await f.submit.click();
    await expect(detailHeading(page, `Контрагент: ${evil}`)).toBeVisible();
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
});

/* ======================================================================
   3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: офисный ноутбук 1366×768
   ====================================================================== */

test.describe("3. Экран 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("список: кнопка создания, поиск и вкладки на экране, без горизонтального скролла страницы", async ({
    page,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    await expect(createButton(page)).toBeInViewport();
    await expect(searchInput(page)).toBeInViewport();
    await expect(typeTab(page, "Клиент")).toBeInViewport();
    await expect(onlyUnpaidSwitch(page)).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("модалка создания: кнопка «Создать» видна или достижима прокруткой", async ({ page }) => {
    const f = await openCreateModal(page);
    // Самая высокая форма: несколько банковских счетов.
    await f.addAccount.click();
    await f.addAccount.click();
    await f.addAccount.click();
    await f.submit.scrollIntoViewIfNeeded();
    await expect(f.submit).toBeInViewport();
    await expect(f.cancel).toBeInViewport();
    // Заголовок модалки доступен после возврата наверх.
    await f.name.scrollIntoViewIfNeeded();
    await expect(f.name).toBeInViewport();
  });

  test("карточка: «Оплатить долг», сводка и история на экране; кнопка «Сохранить» в модалке достижима", async ({
    page,
  }) => {
    await openDetail(page);
    await expect(summaryCard(page, "Сальдо")).toContainText(numRe(4000));
    await expect(payDebtButton(page)).toBeInViewport();
    await expectNoPageHScroll(page);

    await payDebtButton(page).click();
    const f = payFields(page);
    // Шапка модалки (крестик) видна сразу после открытия…
    await expect(f.close).toBeInViewport();
    // …а кнопка отправки видна или достижима прокруткой модалки.
    await f.submit.scrollIntoViewIfNeeded();
    await expect(f.submit).toBeInViewport();
  });
});

/* ======================================================================
   4. СБОИ БЭКЕНДА
   ====================================================================== */

test.describe("4. Сбои бэкенда: отправка форм", () => {
  test("создание: 500 → «Ошибка сервера», данные формы остаются, повтор проходит", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("counterparties", (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.counterparties));
      if (fail) return json(route, { detail: "Ошибка сервера" }, 500);
      return json(route, { id: "cp-ok", ...body }, 201);
    });
    const f = await openCreateModal(page);
    await f.name.fill("ОсОО Сбой");
    await f.phone.fill("+996 555 000 000");
    await f.submit.click();

    await expect(f.modal.getByRole("alert")).toContainText("Ошибка сервера");
    await expect(f.name).toBeVisible();
    await expect(f.name).toHaveValue("ОсОО Сбой");
    await expect(f.phone).toHaveValue("+996 555 000 000");
    await expect(f.submit).toBeEnabled();
    await expect(listHeading(page)).toBeVisible();

    fail = false;
    await f.submit.click();
    await expect(f.name).toBeHidden();
  });

  test("создание: ошибки полей 400 — под полем и в общем блоке", async ({ page, api }) => {
    api.on("counterparties", (route, { method }, db) =>
      method === "POST"
        ? json(
            route,
            {
              name: ["Контрагент с таким названием уже существует."],
              inn: ["Неверный ИНН."],
            },
            400,
          )
        : json(route, paginated(db.counterparties)),
    );
    const f = await openCreateModal(page);
    await f.name.fill("Дубль");
    await f.submit.click();
    // Название — под полем, остальные поля — в верхнем блоке с названием поля.
    await expect(f.modal.getByRole("alert").filter({ hasText: "Контрагент с таким названием уже существует." })).toBeVisible();
    await expect(f.modal.getByRole("alert").filter({ hasText: "ИНН: Неверный ИНН." })).toBeVisible();
    await expect(f.name).toBeVisible();
  });

  test("создание: пустое тело ошибки 500 → запасной текст", async ({ page, api }) => {
    api.on("counterparties", (route, { method }, db) =>
      method === "POST" ? json(route, {}, 500) : json(route, paginated(db.counterparties)),
    );
    const f = await openCreateModal(page);
    await f.name.fill("Пустая ошибка");
    await f.submit.click();
    await expect(f.modal.getByRole("alert")).toContainText("Не удалось создать контрагента");
  });

  test("создание: 502 с HTML от nginx выводится текстом, не разметкой", async ({ page, api }) => {
    api.on("counterparties", (route, { method }, db) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, paginated(db.counterparties)),
    );
    const f = await openCreateModal(page);
    await f.name.fill("HTML ошибка");
    await f.submit.click();
    await expect(f.modal.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
    await expect(f.name).toBeVisible();
  });

  test("создание: обрыв сети — сообщение, модалка жива, кнопка снова активна", async ({
    page,
    api,
  }) => {
    api.on("counterparties", (route, { method }, db) =>
      method === "POST"
        ? route.abort("internetdisconnected")
        : json(route, paginated(db.counterparties)),
    );
    const f = await openCreateModal(page);
    await f.name.fill("Нет сети");
    await f.submit.click();
    await expect(f.modal.getByText("Network Error")).toBeVisible();
    await expect(f.name).toBeVisible();
    await expect(f.name).toHaveValue("Нет сети");
    await expect(f.submit).toBeEnabled();
    await expect(listHeading(page)).toBeVisible();
  });

  test("создание: при обрыве сети под полем названия не появляется «AxiosError»", async ({
    page,
    api,
  }) => {
    // Регрессия (исправлено): при сетевой ошибке бэкенд не отвечал, и в reject уходит сам объект ошибки axios.
    // parseCounterpartyApiError принимает его за ответ API и берёт поле `name` (= "AxiosError")
    // как ошибку названия контрагента: под полем появляется непонятное «AxiosError», а общее
    // сообщение «Network Error» дублируется. Нужно отличать ошибку сети от ответа бэкенда.
    api.on("counterparties", (route, { method }, db) =>
      method === "POST"
        ? route.abort("internetdisconnected")
        : json(route, paginated(db.counterparties)),
    );
    const f = await openCreateModal(page);
    await f.name.fill("Нет сети");
    await f.submit.click();
    await expect(f.modal.getByText("Network Error")).toBeVisible();
    await expect(f.modal.getByText("AxiosError")).toHaveCount(0);
  });

  test("редактирование: 500 → ошибка в модалке, данные на месте; повтор проходит", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("counterpartyItem", (route, { method, body }, db) => {
      if (method !== "PUT") return json(route, db.counterparties[0]);
      if (fail) return json(route, { detail: "Ошибка сервера" }, 500);
      return json(route, { ...DETAIL_CP, ...body });
    });
    const f = await openEdit(page);
    await f.name.fill("ОсОО Сбой PUT");
    await f.submit.click();
    await expect(f.errors.filter({ hasText: "Ошибка сервера" })).toBeVisible();
    await expect(f.name).toHaveValue("ОсОО Сбой PUT");
    await expect(detailHeading(page, "Контрагент: ОсОО Ромашка")).toBeVisible();

    fail = false;
    await f.submit.click();
    await expect(editHeading(page)).toBeHidden();
    await expect(detailHeading(page, "Контрагент: ОсОО Сбой PUT")).toBeVisible();
  });

  test("оплата долга: 500 на создании → текст ошибки в модалке, форма заполнена", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const f = await openPayDebt(page);
    await f.amount.fill("777");
    await f.submit.click();
    await expect(f.error).toContainText("Ошибка сервера");
    await expect(f.dlg).toBeVisible();
    await expect(f.amount).toHaveValue("777");
    await expect(f.submit).toBeEnabled();
  });

  test("оплата долга: пустая ошибка 500 и ошибки полей DRF → запасной текст", async ({
    page,
    api,
  }) => {
    api.on("moneyDocuments", (route) => json(route, {}, 500));
    const f = await openPayDebt(page);
    await f.submit.click();
    await expect(f.error).toContainText("Не удалось создать документ");

    api.on("moneyDocuments", (route) => json(route, { amount: ["Некорректная сумма."] }, 400));
    await f.submit.click();
    await expect(f.error).toContainText("Не удалось создать документ");
  });

  test("оплата долга: документ создан, проведение упало — повторная отправка не плодит дубли", async ({
    page,
    api,
  }) => {
    // Регрессия (исправлено): если POST документа прошёл, а /post/ упал, в базе остаётся черновик, а модалка
    // остаётся открытой с ошибкой. Повторное «Сохранить» заново вызывает POST документа и создаёт
    // второй (третий…) черновик с той же суммой. Нужно запомнить id созданного документа и при
    // повторе только проводить его.
    let failPost = true;
    api.on("moneyDocumentPost", (route, { url }) =>
      failPost
        ? json(route, { detail: "Касса закрыта" }, 400)
        : json(route, { id: lastSegment(url, 2), status: "POSTED" }),
    );
    const f = await openPayDebt(page);
    await f.submit.click();
    await expect(f.error).toContainText("Касса закрыта");

    failPost = false;
    await f.submit.click();
    await expect(f.dlg).toBeHidden();
    expect(api.calls("moneyDocuments", "POST")).toHaveLength(1);
  });
});

test.describe("4. Сбои бэкенда: null и пустые ответы на GET", () => {
  test("список: null целиком → «Контрагенты не найдены», страница жива", async ({ page, api }) => {
    api.on("counterparties", (route) => json(route, null));
    await openList(page);
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();
    await expect(createButton(page)).toBeEnabled();
    await expectNoRenderGarbage(page);
  });

  test("список: results = null и пустой объект вместо массива", async ({ page, api }) => {
    api.on("counterparties", (route) => json(route, { count: 3, results: null }));
    await openList(page);
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();

    api.on("counterparties", (route) => json(route, {}));
    await searchInput(page).fill("x");
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();
  });

  test("список: у записей null вместо analytics, phone, agent, bank_accounts", async ({
    page,
    api,
  }) => {
    api.on("counterparties", (route) =>
      json(
        route,
        paginated([
          {
            id: "n-1",
            name: "Без аналитики",
            type: "CLIENT",
            phone: null,
            agent: null,
            agent_display: null,
            bank_accounts: null,
            analytics: null,
          },
        ]),
      ),
    );
    await openList(page);
    // Без аналитики сальдо неизвестно → при «Только с долгом» запись скрыта, но страница жива.
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();
    await onlyUnpaidSwitch(page).click();
    await expect(rowWith(page, "Без аналитики")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("список: 500 при загрузке — страница жива (сообщения об ошибке нет)", async ({
    page,
    api,
  }) => {
    // Замечание: ошибка загрузки списка в UI не выводится — пользователь видит пустое состояние.
    api.on("counterparties", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openList(page);
    await expect(page.getByText("Контрагенты не найдены")).toBeVisible();
    await expect(searchInput(page)).toBeEditable();
  });

  test("список: employees = null — модалка создания открывается без исключений", async ({
    page,
    api,
  }) => {
    // Регрессия (исправлено): редьюсер сотрудников делает action.payload.results без проверки, и null-ответ
    // /users/employees/ даёт необработанное исключение «Cannot read properties of null
    // (reading 'results')» (модалка при этом открывается). Нужен payload?.results ?? [].
    api.on("employees", (route) => json(route, null));
    const f = await openCreateModal(page);
    await expect(f.modal.getByText("Агент", { exact: true })).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("карточка: операции null → «Нет приходов и расходов», сводка без NaN", async ({
    page,
    api,
  }) => {
    api.on("operations", (route) => json(route, null));
    await openDetail(page);
    await expect(page.getByText("Нет приходов и расходов")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("карточка: все массивы операций и analytics = null", async ({ page, api }) => {
    api.on("operations", (route) =>
      json(route, {
        operations: [],
        debt_operations: null,
        money: { count: 0, next: null, previous: null, results: null },
        analytics: null,
      }),
    );
    await openDetail(page);
    await expect(page.getByText("Нет приходов и расходов")).toBeVisible();
    await expect(summaryCard(page, "Переводы")).toContainText("—");
    await expectNoRenderGarbage(page);
  });

  test("карточка: справочники (склады, категории, кассы) = null — страница и модалка живы", async ({
    page,
    api,
  }) => {
    for (const name of ["warehouses", "categories", "cashRegisters"] as const) {
      api.on(name, (route) => json(route, null));
    }
    await openDetail(page);
    await expect(summaryCard(page, "Сальдо")).toContainText(numRe(4000));
    await payDebtButton(page).click();
    const f = payFields(page);
    await expect(f.dlg).toBeVisible();
    await expect(f.cash.locator("option")).toHaveCount(1); // только «выберите»
    await expectNoRenderGarbage(page);
  });

  test("карточка: контрагент null — заголовок «Контрагент: —», без кнопки «Редактировать»", async ({
    page,
    api,
  }) => {
    api.on("counterpartyItem", (route) => json(route, null));
    await page.goto(URLS.detail);
    await expect(detailHeading(page, "Контрагент: —")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Редактировать" })).toHaveCount(0);
    await expectNoRenderGarbage(page);
  });

  test("карточка: контрагент не найден (404) — страница жива, история грузится", async ({
    page,
    api,
  }) => {
    // Замечание: при 404/500 на самом контрагенте сообщения нет — только «Контрагент: —».
    api.on("counterpartyItem", (route) => json(route, { detail: "Не найдено." }, 404));
    await page.goto(URLS.detail);
    await expect(detailHeading(page, "Контрагент: —")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Назад к списку" })).toBeEnabled();
  });

  test("карточка: 500 на операциях → «Не удалось загрузить приход/расход», «Обновить» восстанавливает", async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on("operations", (route) =>
      fail ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, operationsResponse()),
    );
    await page.goto(URLS.detail);
    await expect(page.getByText("Не удалось загрузить приход/расход")).toBeVisible(FIRST_RENDER);
    await expect(detailHeading(page, "Контрагент: ОсОО Ромашка")).toBeVisible();

    fail = false;
    await page.getByRole("button", { name: "Обновить" }).click();
    await expect(page.getByText("Не удалось загрузить приход/расход")).toBeHidden();
    await expect(summaryCard(page, "Сальдо")).toContainText(numRe(4000));
  });

  test("карточка: 404 на операциях трактуется как пустая история", async ({ page, api }) => {
    api.on("operations", (route) => json(route, { detail: "Не найдено." }, 404));
    await openDetail(page);
    await expect(page.getByText("Нет приходов и расходов")).toBeVisible();
    await expect(page.getByText("Не удалось загрузить приход/расход")).toHaveCount(0);
  });
});

/* ======================================================================
   Дефекты часовых поясов (Бишкек, UTC+6 — основной рынок продукта)
   ====================================================================== */

test.describe("Часовой пояс Asia/Bishkek", () => {
  test.use({ timezoneId: "Asia/Bishkek" });

  test("акт сверки: «Дата с» по умолчанию — 1 января текущего года", async ({ page }) => {
    // Регрессия (исправлено): начало периода считается через new Date(год, 0, 1).toISOString().slice(0, 10).
    // Локальная полночь 1 января в UTC+6 — это 18:00 31 декабря UTC, поэтому в поле «Дата с»
    // попадает 31 декабря ПРОШЛОГО года, и акт сверки захватывает лишний день. Аналитика склада
    // уже переведена на локальные даты (toLocalISODate) — здесь нужно то же самое.
    await openDetail(page);
    const year = new Date().getFullYear();
    await expect(page.getByLabel("Начало периода акта сверки")).toHaveValue(`${year}-01-01`);
  });

  test("список: месяц — первый и последний день берутся по локальному календарю", async ({
    page,
    api,
  }) => {
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();
    const url = api.calls("counterparties", "GET")[0].url;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    expect(url.searchParams.get("date_from")).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    );
    expect(url.searchParams.get("date_to")).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(last)}`,
    );
  });
});

/* ======================================================================
   5. СТРЕСС И ПРОИЗВОДИТЕЛЬНОСТЬ
   ====================================================================== */

test.describe("5. Стресс и производительность", () => {
  test.slow();

  /** N контрагентов: чётные — клиенты, нечётные — поставщики; у всех есть долг. */
  const makeMany = (n: number): Counterparty[] =>
    Array.from({ length: n }, (_, i) =>
      makeCounterparty(
        `bulk-${i + 1}`,
        `Нагрузка ${i + 1}`,
        i % 2 ? "SUPPLIER" : "CLIENT",
        1000 + i,
        0,
      ),
    );

  test("Big Data: 3000 контрагентов — пагинация, поиск и вкладки остаются отзывчивыми", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    // Прогрев: первый заход компилирует чанки Vite — в замер это попадать не должно.
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible();

    api.db.counterparties = makeMany(3000);
    const t0 = Date.now();
    await page.reload();
    // Вкладка «Клиент»: 1500 записей → 15 страниц по 100.
    await expect(countersText(page, 1500)).toBeVisible({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({
      type: "render 3000 counterparties, ms",
      description: String(renderMs),
    });
    expect(renderMs).toBeLessThan(perfBudget(15_000));

    await expect(page.getByText("Страница 1 из 15 (1500 контрагентов)")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: /Нагрузка/ })).toHaveCount(100);

    // Серверный поиск сужает выдачу и сбрасывает страницу на первую.
    await searchInput(page).fill("Нагрузка 2999");
    await expect(rowWith(page, "Нагрузка 2999")).toBeVisible({ timeout: perfBudget(15_000) });
    await expect(countersText(page, 1)).toBeVisible();
    await searchInput(page).fill("");

    // Вкладка «Поставщик»: вторая половина.
    await typeTab(page, "Поставщик").click();
    await expect(countersText(page, 1500)).toBeVisible({ timeout: perfBudget(15_000) });
  });

  test("пагинация списка: «Вперед» открывает вторую страницу и она остаётся", async ({
    page,
    api,
  }) => {
    // Регрессия (было блокирующим при >100 контрагентах): usePagination.resetToFirstPage — useCallback
    // с зависимостью от currentPage, а в Counterparties.jsx он же стоит в зависимостях эффектов
    // «сбросить на первую страницу при смене поиска/вкладки». Клик «Вперёд» меняет currentPage →
    // меняется resetToFirstPage → эффект срабатывает снова и тут же возвращает страницу 1.
    // Пользователь НЕ может перейти дальше первых 100 контрагентов. Исправление: не включать
    // resetToFirstPage в зависимости эффектов (или хранить currentPage в ref).
    api.db.counterparties = makeMany(300); // клиентов 150 → 2 страницы
    await openList(page);
    await expect(page.getByText("Страница 1 из 2 (150 контрагентов)")).toBeVisible();
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 2 (150 контрагентов)")).toBeVisible({
      timeout: 3_000,
    });
    await expect(page).toHaveURL(/page=2/);
    await page.waitForTimeout(500);
    await expect(page.getByText("Страница 2 из 2 (150 контрагентов)")).toBeVisible();
  });

  test("прямая ссылка на ?page=2 открывает вторую страницу и не сбрасывается", async ({
    page,
    api,
  }) => {
    api.db.counterparties = makeMany(300); // клиентов 150 → 2 страницы
    await page.goto(`${URLS.list}?page=2`);
    await expect(page.getByText("Страница 2 из 2 (150 контрагентов)")).toBeVisible(FIRST_RENDER);
    await page.waitForTimeout(600); // дольше debounce поиска
    await expect(page.getByText("Страница 2 из 2 (150 контрагентов)")).toBeVisible();
    await expect(page).toHaveURL(/page=2/);

    // «Назад» возвращает на первую, а смена вкладки — тоже на первую.
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page.getByText("Страница 1 из 2 (150 контрагентов)")).toBeVisible();
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 2 (150 контрагентов)")).toBeVisible();
    await typeTab(page, "Поставщик").click();
    await expect(page.getByText(/Страница 1 из 2/)).toBeVisible();
  });

  test("Big Data: «Итого» считается по всем 3000, а не только по странице", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    // Клиенты: чётные индексы i = 0, 2, 4…; оборот Дт = 1000 + i, Кт = 0. 1500 клиентов, i = 0..2998:
    // сумма = 1500 × 1000 + (0 + 2 + … + 2998) = 1 500 000 + 2 248 500 = 3 748 500.
    api.db.counterparties = makeMany(3000);
    await openList(page);
    await expect(countersText(page, 1500)).toBeVisible({ timeout: perfBudget(30_000) });
    await expect(rowWith(page, "Итого")).toContainText(numRe(3_748_500));
  });

  test("Big Data: 3000 операций в истории — рендер, поиск и фильтр отзывчивы", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    const many = Array.from({ length: 3000 }, (_, i) => makeOperation(i + 1));
    api.on("operations", (route, { url }) => {
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const list = q ? many.filter((o) => o.number.toLowerCase().includes(q)) : many;
      return json(route, operationsResponse(list));
    });

    await openDetail(page); // прогрев + первая загрузка
    const t0 = Date.now();
    await page.getByRole("button", { name: "Обновить" }).click();
    await expect(page.getByText("Все операции", { exact: true }).locator("..")).toContainText(
      "3001 шт.",
      { timeout: perfBudget(30_000) },
    );
    const renderMs = Date.now() - t0;
    test.info().annotations.push({
      type: "render 3000 operations, ms",
      description: String(renderMs),
    });
    expect(renderMs).toBeLessThan(perfBudget(15_000));

    // Поиск сужает историю до одной операции.
    await page.getByLabel("Поиск по номеру и комментарию").fill("ПКО-2999");
    await expect(rowWith(page, "ПКО-2999").first()).toBeVisible({ timeout: perfBudget(15_000) });
    await expect(page.getByText("Все операции", { exact: true }).locator("..")).toContainText(
      "2 шт.",
      { timeout: perfBudget(15_000) },
    );
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

  test("CPU ×6 (CDP): список на 1000 записей — вкладки, период и модалка создания без лагов", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    // 1000 агентов в селекте модалки — самый тяжёлый её элемент.
    api.on(
      "employees",
      (route) =>
        json(
          route,
          paginated(
            Array.from({ length: 1000 }, (_, i) => ({
              id: `emp-${i}`,
              first_name: `Агент${i}`,
              last_name: "Нагрузочный",
              role: "agent",
              email: `a${i}@e2e.test`,
            })),
          ),
        ),
    );
    await openList(page);
    await expect(rowWith(page, "Клиент Альфа")).toBeVisible(); // прогрев чанков без замедления
    api.db.counterparties = makeMany(1000);
    await page.reload();
    await expect(countersText(page, 500)).toBeVisible({ timeout: perfBudget(30_000) });

    const cdp = await throttleCpu(page, 6);
    const tabMs = await measure(
      () => typeTab(page, "Поставщик").click(),
      () => expect(typeTab(page, "Поставщик")).toHaveAttribute("aria-selected", "true"),
    );
    const periodMs = await measure(
      () => periodTab(page, "Год").click(),
      () => expect(periodTab(page, "Год")).toHaveAttribute("aria-selected", "true"),
    );
    await expect(countersText(page, 500)).toBeVisible({ timeout: perfBudget(30_000) });
    const modalMs = await measure(
      () => createButton(page).click(),
      () => expect(createFields(page).name).toBeVisible(),
    );
    const typingMs = await measure(
      () => createFields(page).name.fill("ОсОО Тормоз"),
      () => expect(createFields(page).name).toHaveValue("ОсОО Тормоз"),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 list, ms",
      description: JSON.stringify({ tabMs, periodMs, modalMs, typingMs }),
    });
    expect(tabMs).toBeLessThan(perfBudget(3_000));
    expect(periodMs).toBeLessThan(perfBudget(3_000));
    expect(modalMs).toBeLessThan(perfBudget(3_000));
    expect(typingMs).toBeLessThan(perfBudget(2_000));
  });

  test("CPU ×6 (CDP): модалка оплаты долга с 1000 касс и 1000 категорий", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    api.on("cashRegisters", (route) =>
      json(
        route,
        paginated(Array.from({ length: 1000 }, (_, i) => ({ id: `cr-${i}`, name: `Касса ${i}` }))),
      ),
    );
    api.on("categories", (route) =>
      json(
        route,
        paginated([
          ...CATEGORIES,
          ...Array.from({ length: 1000 }, (_, i) => ({ id: `mc-${i}`, title: `Категория ${i}` })),
        ]),
      ),
    );
    await openDetail(page);
    await expect(summaryCard(page, "Сальдо")).toContainText(numRe(4000));

    const cdp = await throttleCpu(page, 6);
    const openMs = await measure(
      () => payDebtButton(page).click(),
      () => expect(payDialog(page)).toBeVisible(),
    );
    const f = payFields(page);
    const selectMs = await measure(
      () => f.cash.selectOption({ label: "Касса 999" }),
      () => expect(f.cash).toHaveValue("cr-999"),
    );
    const typeMs = await measure(
      () => f.amount.fill("1234,5"),
      () => expect(f.amount).toHaveValue("1234,5"),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 pay-debt, ms",
      description: JSON.stringify({ openMs, selectMs, typeMs }),
    });
    expect(openMs).toBeLessThan(perfBudget(3_000));
    expect(selectMs).toBeLessThan(perfBudget(2_000));
    expect(typeMs).toBeLessThan(perfBudget(2_000));
  });

  test("CPU ×6 (CDP): история на 1000 операций — фильтр и смена вида без фриза", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    const many = Array.from({ length: 1000 }, (_, i) => makeOperation(i + 1));
    api.on("operations", (route) => json(route, operationsResponse(many)));
    await openDetail(page);
    await expect(
      page.getByText("Все операции", { exact: true }).locator(".."),
    ).toContainText("1001 шт.", { timeout: perfBudget(30_000) });

    const cdp = await throttleCpu(page, 6);
    const cardsMs = await measure(
      () => page.getByTitle("Карточки").click(),
      () => expect(page.getByText("ПКО-500").first()).toBeVisible(),
    );
    const tableMs = await measure(
      () => page.getByTitle("Таблица").click(),
      () => expect(rowWith(page, "ПКО-500").first()).toBeVisible(),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 history, ms",
      description: JSON.stringify({ cardsMs, tableMs }),
    });
    expect(cardsMs).toBeLessThan(perfBudget(5_000));
    expect(tableMs).toBeLessThan(perfBudget(5_000));
  });
});
