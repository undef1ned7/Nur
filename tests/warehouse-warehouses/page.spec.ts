/**
 * E2E: склады, остатки, добавление товара, партнёрства и история продаж партнёра.
 *
 *   /crm/warehouse/warehouses                       список складов (Warehouses.jsx): поиск, пагинация по 50,
 *                                                   «Создать склад» (POST warehouse/), «Редактировать» (PATCH);
 *   /crm/warehouse/warehouses?tab=partnerships      партнёрства: «Активные» (переключатели «Забирать у вас» и
 *                                                   «Ваши продажи», «Разорвать»), «Входящие/Исходящие заявки»,
 *                                                   «Запросы на товар и деньги», приглашение компании;
 *   /crm/warehouse/stocks/:warehouse_id             товары склада (Stocks.jsx): дерево групп, поиск, фильтры,
 *                                                   выбор строк → «Удалить выбранные» / «Переместить в…»;
 *   /crm/warehouse/stocks/add-product?warehouse_id  создание товара (AddWarehouseProductPage.jsx): товар / услуга /
 *                                                   комплект, расчёт «закупка + наценка → цена продажи», бренд /
 *                                                   категория / поставщик «на лету», фото, страна, PLU;
 *   /crm/warehouse/partners/:partnerId/sales        история продаж партнёра (PartnerSalesHistory.jsx): период,
 *                                                   «Продажи/Возвраты», статус, поиск, пагинация, карточка документа.
 *
 * Как пункты общего чек-листа легли на страницы:
 *   «форма + отправка»   → создание/редактирование склада, приглашение партнёра, создание товара;
 *   «расчёты»            → цена продажи = закупка × (1 + наценка/100) и обратный пересчёт наценки, цена комплекта,
 *                          сводка продаж партнёра, «Страница X из Y»;
 *   «POST/PUT 500»       → 500 на создании склада, приглашении, создании товара, действиях с заявками;
 *   «GET → null»         → null вместо списков складов, товаров, групп, заявок, продаж;
 *   «тройной клик»       → «Создать» (склад), «Создать товар».
 *
 * Чего на этих страницах НЕТ: удаления склада (есть только в API), обмена товарами (он на /partners/:id), корректировки
 * остатка (она в режиме редактирования товара), мутаций в истории продаж партнёра — страница только для чтения.
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** + routeWebSocket): по умолчанию фронт ходит на боевой
 * https://app.nurcrm.kg/api, и тесты не должны ни читать, ни менять продовые данные. Мок хранит состояние: созданный
 * склад появляется в списке, подтверждённая заявка исчезает, удалённые товары пропадают из выдачи.
 *
 * Тесты с комментарием «Регрессия (исправлено)» поймали дефекты при первом прогоне (08.10.2026);
 * дефекты исправлены, тесты охраняют, чтобы они не вернулись.
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer в playwright.config.js):
 *   npx playwright test tests/warehouse-warehouses --project=chromium
 * Замеры раздела 5 честнее в одиночку:
 *   npx playwright test tests/warehouse-warehouses -g "5. Стресс" --workers=1
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
// Клик/ввод по несуществующему локатору должен падать за 15 с с понятной ошибкой, а не висеть до таймаута теста.
base.use({ actionTimeout: 15_000 });

/* ======================================================================
   Тестовые данные
   ====================================================================== */

const WAREHOUSE_ID = "41b41465-ec69-4331-9678-2733ce43c513";
const PARTNER_ID = "3bf19465-d8c0-46c0-85aa-e4d17d9439a7";
const URLS = {
  warehouses: "/crm/warehouse/warehouses",
  partnerships: "/crm/warehouse/warehouses?tab=partnerships",
  stocks: `/crm/warehouse/stocks/${WAREHOUSE_ID}`,
  addProduct: `/crm/warehouse/stocks/add-product?warehouse_id=${WAREHOUSE_ID}`,
  sales: `/crm/warehouse/partners/${PARTNER_ID}/sales`,
};

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим исходники Vite
// вроде http://localhost:3100/src/api/warehouse.js.
const apiPath = (path: string): RegExp =>
  new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

const API_ANY = /^https?:\/\/[^/]+\/api\//;
/**
 * Порядок важен: Playwright проверяет маршруты в ОБРАТНОМ порядке регистрации, поэтому самый общий
 * (`warehouse/{id}/`, под который подпадают и `warehouse/brands/`, и `warehouse/category/`) идёт первым.
 */
const ENDPOINTS = {
  warehouseItem: apiPath("warehouse/[^/?]+/"),
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  warehouses: apiPath("warehouse/"),
  brands: apiPath("warehouse/brands/"),
  warehouseCategories: apiPath("warehouse/category/"),
  warehouseProducts: apiPath("warehouse/[^/?]+/products/"),
  groups: apiPath("warehouse/[^/?]+/groups/"),
  groupItem: apiPath("warehouse/[^/?]+/groups/[^/?]+/"),
  productItem: apiPath("warehouse/products/[^/?]+/"),
  productPackages: apiPath("warehouse/products/[^/?]+/packages/"),
  productImages: apiPath("warehouse/products/[^/?]+/images/"),
  mainBrands: apiPath("main/brands/"),
  mainCategories: apiPath("main/categories/"),
  bulkDelete: apiPath("main/products/bulk-delete/"),
  clients: apiPath("main/clients/"),
  clientDeals: apiPath("main/clients/[^/?]+/deals/"),
  cashboxes: apiPath("construction/cashboxes/"),
  cashflows: apiPath("construction/cashflows/"),
  requests: apiPath("warehouse/stock-partnership-requests/"),
  requestAction: apiPath("warehouse/stock-partnership-requests/[^/?]+/(accept|reject|cancel)/"),
  partners: apiPath("warehouse/stock-partnerships/active/"),
  operations: apiPath("warehouse/stock-partnerships/operations/"),
  operationAction: apiPath(
    "warehouse/stock-partnerships/operations/[^/?]+/(approve|reject|cancel)/",
  ),
  companySearch: apiPath("warehouse/stock-partnerships/companies/search/"),
  partnerTerminate: apiPath("warehouse/stock-partnerships/companies/[^/?]+/terminate/"),
  partnerSettings: apiPath("warehouse/stock-partnerships/companies/[^/?]+/settings/"),
  partnerSales: apiPath("warehouse/stock-partnerships/companies/[^/?]+/sales/"),
  partnerSale: apiPath("warehouse/stock-partnerships/companies/[^/?]+/sales/[^/?]+/"),
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

interface Warehouse {
  id: string;
  name: string;
  location?: string;
  products_count?: number;
}
interface Product {
  id: string;
  name: string;
  code?: string;
  article?: string;
  unit?: string;
  price?: string | number | null;
  discount_percent?: string | number;
  quantity?: string | number | null;
  kind?: string;
  is_weight?: boolean;
  product_group?: string | null;
  purchase_price?: string | number;
  images?: unknown[];
  [key: string]: unknown;
}
interface Group {
  id: string;
  name: string;
  parent: string | null;
  products_count?: number;
}
interface SaleRow {
  id: string;
  number: string;
  doc_type: "SALE" | "SALE_RETURN";
  date: string;
  status: string;
  warehouse_from_name?: string;
  branch_name?: string;
  counterparty_display_name?: string;
  agent_display?: string;
  items_count: number;
  total: string;
  discount_amount: string;
}
interface Db {
  warehouses: Warehouse[];
  products: Product[];
  groups: Group[];
  brands: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  clients: Record<string, unknown>[];
  partners: Record<string, any>[];
  requestsIn: Record<string, any>[];
  requestsOut: Record<string, any>[];
  operationsEnabled: boolean;
  opsIn: Record<string, any>[];
  opsOut: Record<string, any>[];
  companies: { id: string; name: string; partnership_status?: string | null }[];
  sales: SaleRow[];
}

const WAREHOUSES: Warehouse[] = [
  { id: WAREHOUSE_ID, name: "Основной склад", location: "Бишкек, Чуй 1", products_count: 12 },
  { id: "wh-2", name: "Склад №2", location: "Ош", products_count: 3 },
];

const PRODUCTS: Product[] = [
  { id: "p-1", name: "Молоко 1л", code: "C-1", article: "A-1", unit: "шт", price: "150.00", discount_percent: "0", quantity: "50", kind: "product" },
  { id: "p-2", name: "Apple Juice", code: "C-2", article: "A-2", unit: "л", price: "10.50", discount_percent: "5", quantity: "1234.500", kind: "product" },
  { id: "p-3", name: "Услуга доставки", code: "C-3", unit: "шт", price: "300", discount_percent: "0", quantity: "0", kind: "service" },
  { id: "p-4", name: "Хлеб", code: "C-4", article: "A-4", unit: "шт", price: "40", discount_percent: "0", quantity: "0", kind: "product" },
];

const GROUPS: Group[] = [
  { id: "g-1", name: "Молочка", parent: null, products_count: 2 },
  { id: "g-2", name: "Напитки", parent: null, products_count: 1 },
  { id: "g-3", name: "Сыры", parent: "g-1", products_count: 1 },
];

const ISO_PAST = "2026-09-01T10:00:00+06:00";
const PARTNERS = [
  { id: PARTNER_ID, name: "ОсОО Партнёр", partnership_id: "ps-1", since: ISO_PAST, allow_direct_pull: false, share_sales_history: true, partner_shares_sales_history: true },
  { id: "partner-2", name: "ИП Скрытый", partnership_id: "ps-2", since: ISO_PAST, allow_direct_pull: true, share_sales_history: false, partner_shares_sales_history: false },
];
const REQUESTS_IN = [
  { id: "rq-in-1", status: "PENDING", from_company: "c-3", from_company_name: "ОсОО Входящая", to_company: "e2e-company", to_company_name: "E2E Company", note: "Давайте дружить", created_at: ISO_PAST, decided_at: null },
];
const REQUESTS_OUT = [
  { id: "rq-out-1", status: "PENDING", from_company: "e2e-company", from_company_name: "E2E Company", to_company: "c-4", to_company_name: "ОсОО Исходящая", note: "", created_at: ISO_PAST, decided_at: null },
];
const OPS_IN = [
  { id: "op-in-1", kind: "INCASSATION", status: "PENDING", initiator_company_name: "ОсОО Партнёр", amount: "5000", cash_register_from_name: "Касса партнёра", cash_register_to_name: "Наша касса", comment: "Инкассация E2E", created_at: ISO_PAST },
];
const OPS_OUT = [
  { id: "op-out-1", kind: "TRANSFER", status: "PENDING", source_company_name: "ОсОО Партнёр", items: [{}, {}], warehouse_from_name: "Склад партнёра", warehouse_to_name: "Основной склад", comment: "", created_at: ISO_PAST },
];
const COMPANIES = [
  { id: "c-new", name: "ОсОО Новая Компания", partnership_status: null },
  { id: "c-active", name: "ОсОО Партнёр Старый", partnership_status: "ACTIVE" },
  { id: "c-pending", name: "ОсОО Ждём Ответ", partnership_status: "PENDING_OUT" },
];

const makeSale = (i: number, o: Partial<SaleRow> = {}): SaleRow => ({
  id: `s-${i}`,
  number: `S-${100 + i}`,
  doc_type: "SALE",
  date: "2026-10-01T10:00:00+06:00",
  status: i % 2 ? "POSTED" : "CASH_PENDING",
  warehouse_from_name: "Склад партнёра",
  branch_name: "Филиал Ош",
  counterparty_display_name: `Покупатель ${i}`,
  agent_display: `Агент ${i}`,
  items_count: 2,
  total: String(1000 + i * 100),
  discount_amount: "100",
  ...o,
});
const defaultSales = (): SaleRow[] => [
  makeSale(1, { total: "1500.00" }),
  makeSale(2, { total: "700.00", discount_amount: "0" }),
  makeSale(3, { id: "r-1", number: "R-001", doc_type: "SALE_RETURN", status: "POSTED", total: "300.00", discount_amount: "0" }),
];

const paginated = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

/** Страница выдачи как у бэкенда: next/previous нужны, иначе кнопки «Вперед»/«Назад» остаются disabled. */
const pageOf = <T,>(all: T[], page: number, size: number) => ({
  count: all.length,
  next: page * size < all.length ? `?page=${page + 1}` : null,
  previous: page > 1 ? `?page=${page - 1}` : null,
  results: all.slice((page - 1) * size, page * size),
});

/* ======================================================================
   Мок бэкенда (с состоянием)
   ====================================================================== */

interface Call {
  method: string;
  url: URL;
  body: any;
  raw: string | null;
}
type Handler = (route: Route, call: Call, db: Db) => unknown;
interface Api {
  db: Db;
  on(name: Endpoint, handler: Handler): void;
  calls(name: Endpoint, method?: string): Call[];
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const lastSegment = (url: URL, fromEnd = 1): string =>
  url.pathname.split("/").filter(Boolean).at(-fromEnd) ?? "";
const parseBody = (raw: string | null, type: string | undefined): any => {
  if (!raw) return null;
  if (type?.includes("json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

async function mockBackend(page: Page): Promise<Api> {
  const db: Db = {
    warehouses: WAREHOUSES.map((w) => ({ ...w })),
    products: PRODUCTS.map((p) => ({ ...p })),
    groups: GROUPS.map((g) => ({ ...g })),
    brands: [{ id: "b-1", name: "Бренд А" }],
    categories: [{ id: "c-1", name: "Молочные" }],
    clients: [{ id: "cl-1", full_name: "ИП Поставщик", type: "suppliers", phone: "+996555000111" }],
    partners: PARTNERS.map((p) => ({ ...p })),
    requestsIn: REQUESTS_IN.map((r) => ({ ...r })),
    requestsOut: REQUESTS_OUT.map((r) => ({ ...r })),
    operationsEnabled: true,
    opsIn: OPS_IN.map((r) => ({ ...r })),
    opsOut: OPS_OUT.map((r) => ({ ...r })),
    companies: COMPANIES.map((c) => ({ ...c })),
    sales: defaultSales(),
  };
  const log = {} as Record<Endpoint, Call[]>;
  let seq = 0;

  const handlers: Record<Endpoint, Handler> = {
    warehouseItem: (route, { method, url, body }, state) => {
      const found = state.warehouses.find((w) => w.id === lastSegment(url));
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "PATCH") {
        Object.assign(found, body);
        return json(route, found);
      }
      return json(route, found);
    },
    profile: (route) => json(route, PROFILE),
    company: (route) => json(route, COMPANY),
    warehouses: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: Warehouse = { id: `wh-new-${seq}`, name: body?.name, location: body?.location, products_count: 0 };
        state.warehouses.unshift(created);
        return json(route, created, 201);
      }
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const list = q ? state.warehouses.filter((w) => w.name.toLowerCase().includes(q)) : state.warehouses;
      const size = Number(url.searchParams.get("page_size") ?? 50);
      return json(route, pageOf(list, Number(url.searchParams.get("page") ?? 1), size));
    },
    brands: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created = { id: `b-new-${seq}`, name: body?.name };
        state.brands.push(created);
        return json(route, created, 201);
      }
      return json(route, paginated(state.brands));
    },
    warehouseCategories: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created = { id: `c-new-${seq}`, name: body?.name };
        state.categories.push(created);
        return json(route, created, 201);
      }
      return json(route, paginated(state.categories));
    },
    warehouseProducts: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: Product = { id: `p-new-${seq}`, ...body };
        state.products.push(created);
        return json(route, created, 201);
      }
      const q = url.searchParams;
      const search = (q.get("search") ?? "").toLowerCase();
      let list = state.products;
      if (search) list = list.filter((p) => p.name.toLowerCase().includes(search));
      if (q.get("product_group")) list = list.filter((p) => p.product_group === q.get("product_group"));
      // Страница остатков page_size не шлёт; бэкенд отдаёт по 50 (как и список складов).
      const size = Number(q.get("page_size") ?? 50);
      return json(route, pageOf(list, Number(q.get("page") ?? 1), size));
    },
    groups: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: Group = { id: `g-new-${seq}`, name: body?.name, parent: body?.parent ?? null, products_count: 0 };
        state.groups.push(created);
        return json(route, created, 201);
      }
      return json(route, state.groups);
    },
    groupItem: (route, { url }, state) => {
      state.groups = state.groups.filter((g) => g.id !== lastSegment(url));
      return route.fulfill({ status: 204, body: "" });
    },
    productItem: (route, { method, url, body }, state) => {
      const found = state.products.find((p) => p.id === lastSegment(url));
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "PATCH") {
        Object.assign(found, body);
        return json(route, found);
      }
      return json(route, found);
    },
    productPackages: (route) => json(route, [], 201),
    productImages: (route) => json(route, { id: "img-1" }, 201),
    mainBrands: (route, _c, state) => json(route, paginated(state.brands)),
    mainCategories: (route, _c, state) => json(route, paginated(state.categories)),
    bulkDelete: (route, { body }, state) => {
      const ids = new Set<string>(body?.ids ?? []);
      state.products = state.products.filter((p) => !ids.has(p.id));
      return json(route, { deleted: ids.size });
    },
    clients: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created = { id: `cl-new-${seq}`, ...body };
        state.clients.unshift(created);
        return json(route, created, 201);
      }
      return json(route, paginated(state.clients));
    },
    clientDeals: (route) => json(route, { id: "deal-1" }, 201),
    cashboxes: (route) => json(route, paginated([{ id: "cb-1", name: "Касса" }])),
    cashflows: (route) => json(route, { id: "cf-1" }, 201),
    requests: (route, { method, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const target = state.companies.find((c) => c.id === body?.to_company);
        const created = { id: `rq-new-${seq}`, status: "PENDING", from_company: "e2e-company", from_company_name: "E2E Company", to_company: body?.to_company, to_company_name: target?.name ?? "—", note: body?.note ?? "", created_at: new Date().toISOString(), decided_at: null };
        state.requestsOut.unshift(created);
        return json(route, created, 201);
      }
      return json(route, { incoming: state.requestsIn, outgoing: state.requestsOut });
    },
    requestAction: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      state.requestsIn = state.requestsIn.filter((r) => r.id !== id);
      state.requestsOut = state.requestsOut.filter((r) => r.id !== id);
      return json(route, { id });
    },
    partners: (route, _c, state) => json(route, { partners: state.partners }),
    operations: (route, _c, state) =>
      state.operationsEnabled
        ? json(route, { incoming: state.opsIn, outgoing: state.opsOut })
        : route.fulfill({ status: 404, contentType: "text/html", body: "<h1>Not Found</h1>" }),
    operationAction: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      state.opsIn = state.opsIn.filter((r) => r.id !== id);
      state.opsOut = state.opsOut.filter((r) => r.id !== id);
      return json(route, { id });
    },
    companySearch: (route, { url }, state) => {
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      return json(route, state.companies.filter((c) => c.name.toLowerCase().includes(q)));
    },
    partnerTerminate: (route, { url }, state) => {
      const id = lastSegment(url, 2);
      state.partners = state.partners.filter((p) => p.id !== id);
      return json(route, { ok: true });
    },
    partnerSettings: (route, { url, body }, state) => {
      const found = state.partners.find((p) => p.id === lastSegment(url, 2));
      if (found) Object.assign(found, body);
      return json(route, found ?? {});
    },
    partnerSales: (route, { url }, state) => {
      const q = url.searchParams;
      let list = state.sales.filter((s) => s.doc_type === (q.get("doc_type") ?? "SALE"));
      if (q.get("status")) list = list.filter((s) => s.status === q.get("status"));
      const search = (q.get("search") ?? "").toLowerCase();
      if (search) {
        list = list.filter(
          (s) => s.number.toLowerCase().includes(search) || (s.counterparty_display_name ?? "").toLowerCase().includes(search),
        );
      }
      const amount = list.reduce((a, s) => a + Number(s.total), 0);
      return json(route, {
        ...pageOf(list, Number(q.get("page") ?? 1), 50),
        date_from: "2026-09-05",
        date_to: "2026-10-05",
        partner_company: { name: "ОсОО Партнёр" },
        summary: {
          count: list.length,
          amount,
          discount_amount: list.reduce((a, s) => a + Number(s.discount_amount), 0),
          items_qty: list.reduce((a, s) => a + s.items_count, 0),
        },
      });
    },
    partnerSale: (route, { url }, state) => {
      const row = state.sales.find((s) => s.id === lastSegment(url));
      if (!row) return json(route, { detail: "Не найдено." }, 404);
      return json(route, {
        ...row,
        payment_kind: "cash",
        items: [
          { id: "i-1", product_name: "Молоко 1л", product_article: "A-1", qty: "2", unit: "шт", price: "600", discount_amount: "50", net_amount: "1150" },
          { id: "i-2", product_name: "Хлеб", product_article: "A-4", qty: "5", unit: "шт", price: "40", discount_amount: "0", net_amount: "200" },
        ],
      });
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
      const raw = request.postData();
      const call: Call = {
        method: request.method(),
        url: new URL(request.url()),
        body: parseBody(raw, request.headers()["content-type"]),
        raw,
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
 * Бюджет времени с поправкой на параллельный прогон: когда несколько воркеров гоняют три браузера,
 * CPU делится, и абсолютные замеры раздуваются. Строгий замер — с --workers=1.
 */
const perfBudget = (ms: number): number => (test.info().config.workers > 1 ? ms * 3 : ms);

const SEP = "[\\s\\u00a0\\u202f]";

/**
 * Регулярка для числа в формате ru-RU (0–2 знака): разделитель тысяч в разных браузерах — пробел, NBSP или
 * узкий NBSP, а четырёхзначные числа иногда не группируются вовсе, поэтому разделитель необязателен.
 */
function numRe(n: number, suffix = ""): RegExp {
  const [int, frac] = String(Number(Math.abs(n).toFixed(2))).split(".");
  let out = "";
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % 3 === 0) out += `${SEP}?`;
    out += int[i];
  }
  if (frac) out += `,${frac}`;
  return new RegExp(`${out}${suffix ? `${SEP}*${suffix}` : ""}`);
}

const localISO = (d = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

/** Общие React-модалки (GlobalAlertModal / ConfirmModal): role="dialog", кнопки «Ок» / «Отменить» / «Подтвердить». */
const appDialog = (page: Page, text: string | RegExp) =>
  page.getByRole("dialog").filter({ hasText: text });
const confirmDialog = (page: Page) => appDialog(page, "Подтвердите ваше действие");

async function closeAlert(page: Page, text: string | RegExp): Promise<void> {
  const dlg = appDialog(page, text);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Ок" }).click();
  await expect(dlg).toBeHidden();
}

async function confirmAction(page: Page, text?: string | RegExp): Promise<void> {
  const dlg = confirmDialog(page);
  await expect(dlg).toBeVisible();
  if (text) await expect(dlg).toContainText(text);
  await dlg.getByRole("button", { name: "Подтвердить" }).click();
}

const rowWith = (page: Page, text: string | RegExp) =>
  page.getByRole("row").filter({ hasText: text });

/**
 * Самописные модалки (создание склада и пр.): без role="dialog". Находим карточку как самый вложенный блок,
 * в котором есть заголовок с нужным названием и кнопка «Отмена».
 */
const modalByTitle = (page: Page, title: string, level = 2) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("heading", { level, name: title, exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Отмена" }) })
    .last();

/** Контрол из секции с подписью (подписи на этих страницах не связаны с полями). */
const field = (scope: Locator, page: Page, label: string | RegExp, control = "input, select, textarea") =>
  scope
    .locator("div")
    .filter({ has: page.getByText(label, { exact: typeof label === "string" }) })
    .last()
    .locator(control)
    .first();

/* ---------- Склады ---------- */

const warehousesHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Склады" });
const pageTab = (page: Page, name: "Склады" | "Партнёры") =>
  page.getByRole("button", { name, exact: true });
const subTab = (page: Page, name: string | RegExp) =>
  page.getByRole("tablist", { name: "Партнёрство" }).getByRole("tab", { name });
const warehouseSearch = (page: Page) => page.getByPlaceholder("Поиск по названию склада...");
const createWarehouseButton = (page: Page) => page.getByRole("button", { name: "Создать склад" });

async function openWarehouses(page: Page): Promise<void> {
  await page.goto(URLS.warehouses);
  await expect(warehousesHeading(page)).toBeVisible(FIRST_RENDER);
  await expect(rowWith(page, "Основной склад")).toBeVisible(FIRST_RENDER);
}

const warehouseForm = (page: Page, title: "Создать склад" | "Редактировать склад") => {
  const modal = modalByTitle(page, title);
  return {
    modal,
    name: modal.getByPlaceholder("Введите название склада"),
    address: modal.getByPlaceholder("Введите адрес склада"),
    submit: modal.getByRole("button", { name: /^(Создать|Создание\.\.\.|Сохранить|Сохранение\.\.\.)$/ }),
    cancel: modal.getByRole("button", { name: "Отмена" }),
  };
};

async function openCreateWarehouse(page: Page) {
  await openWarehouses(page);
  await createWarehouseButton(page).click();
  const f = warehouseForm(page, "Создать склад");
  await expect(f.name).toBeVisible();
  return f;
}

async function openPartnerships(page: Page): Promise<void> {
  await page.goto(URLS.partnerships);
  await expect(subTab(page, /^Активные/)).toBeVisible(FIRST_RENDER);
  await expect(rowWith(page, "ОсОО Партнёр")).toBeVisible(FIRST_RENDER);
}

/* ---------- Остатки ---------- */

const stocksHeading = (page: Page) => page.getByRole("heading", { level: 1, name: /^Товары склада/ });
const stocksSearch = (page: Page) => page.getByPlaceholder("Поиск по названию товара...");
const countersText = (page: Page, total: number, found: number) =>
  page.getByText(`Всего: ${total} • Найдено: ${found}`);

async function openStocks(page: Page): Promise<void> {
  await page.goto(URLS.stocks);
  await expect(page.getByRole("heading", { level: 1, name: "Товары склада: Основной склад" })).toBeVisible(
    FIRST_RENDER,
  );
  await expect(rowWith(page, "Молоко 1л")).toBeVisible(FIRST_RENDER);
}

const groupRow = (page: Page, name: string) =>
  page.getByRole("button").filter({ hasText: new RegExp(`^[▸▾]?\\s*${name}`) }).first();
const productCheckbox = (page: Page, name: string) => rowWith(page, name).getByRole("checkbox");

/* ---------- Добавление товара ---------- */

const addHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Создание товара" });
const form = (page: Page) => page.locator("main, #root").first();
const addField = (page: Page, label: string | RegExp, control?: string) =>
  field(form(page), page, label, control);
const nameInput = (page: Page) => page.getByPlaceholder("Введите наименование");
const barcodeInput = (page: Page) => page.getByPlaceholder("Введите штрих-код");
const submitProduct = (page: Page) => page.getByRole("button", { name: /^(Создать товар|Создание\.\.\.)$/ });
/** Общий AlertModal страницы товара: кнопка «Ok» (латиницей), а не «Ок» из useDialog. */
const addAlert = (page: Page, text: string | RegExp) =>
  page.getByRole("dialog").filter({ hasText: text });

const priceFields = (page: Page) => ({
  purchase: addField(page, "Цена закупки", "input"),
  markup: addField(page, "Наценка", "input"),
  sale: addField(page, "Оптовая цена", "input"),
});

async function openAddProduct(page: Page): Promise<void> {
  await page.goto(URLS.addProduct);
  await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
  // Склад из URL подставляется после загрузки списка складов.
  await expect(addField(page, "Склад *", "select")).toHaveValue(WAREHOUSE_ID, FIRST_RENDER);
}

/** Заполнить обязательные поля товара. */
async function fillProduct(page: Page, o: { name?: string; purchase?: string; markup?: string; qty?: string } = {}) {
  await nameInput(page).fill(o.name ?? "Йогурт клубничный");
  const p = priceFields(page);
  await p.purchase.fill(o.purchase ?? "100");
  await p.markup.fill(o.markup ?? "25");
  await addField(page, "Начальный остаток *", "input").fill(o.qty ?? "10");
}

/** Контрольная цифра EAN-13. */
function ean13Valid(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((a, d, i) => a + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/* ---------- История продаж партнёра ---------- */

const salesHeading = (page: Page, name = "ОсОО Партнёр") =>
  page.getByRole("heading", { level: 2, name: `История продаж: ${name}` });
const saleRow = (page: Page, number: string) =>
  page.getByRole("button", { name: `Документ ${number}` });
const salesTab = (page: Page, group: "Период" | "Тип документов" | "Статус", name: string) =>
  page.getByRole("tablist", { name: group }).getByRole("tab", { name, exact: true });
const salesSearch = (page: Page) => page.getByPlaceholder("Номер или покупатель");

async function openSales(page: Page): Promise<void> {
  await page.goto(URLS.sales);
  await expect(salesHeading(page)).toBeVisible(FIRST_RENDER);
  await expect(saleRow(page, "S-101")).toBeVisible(FIRST_RENDER);
}

/* ======================================================================
   1. ХЕППИ-ПАТ
   ====================================================================== */

test.describe("1. Хеппи-пат: склады (/crm/warehouse/warehouses)", () => {
  test("первая загрузка: запрос страницы 1, строки, счётчики и переход в товары склада", async ({
    page,
    api,
  }) => {
    await openWarehouses(page);
    const url = api.calls("warehouses", "GET")[0].url;
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.has("search")).toBe(false);

    await expect(page.getByText("Управление складами и их товарами")).toBeVisible();
    await expect(page.getByText("Всего: 2 • Найдено: 2")).toBeVisible();
    const main = rowWith(page, "Основной склад");
    await expect(main).toContainText("Бишкек, Чуй 1");
    await expect(main).toContainText("12");
    await expect(rowWith(page, "Склад №2")).toContainText("Ош");
    await expectNoRenderGarbage(page);

    await main.getByRole("button", { name: "Открыть" }).click();
    await expect(page).toHaveURL(new RegExp(`/crm/warehouse/stocks/${WAREHOUSE_ID}$`));
  });

  test("поиск уходит на сервер с задержкой и сужает список", async ({ page, api }) => {
    await openWarehouses(page);
    const req = page.waitForRequest(
      (r) => ENDPOINTS.warehouses.test(r.url()) && r.url().includes("search=%D0%9E%D1%88"),
    );
    await warehouseSearch(page).fill("Ош");
    await req;
    // Поиск по названию склада «Ош» ничего не находит среди названий, а «№2» — находит.
    await warehouseSearch(page).fill("№2");
    await expect(rowWith(page, "Склад №2")).toBeVisible();
    await expect(rowWith(page, "Основной склад")).toHaveCount(0);
    expect(api.calls("warehouses", "GET").at(-1)!.url.searchParams.get("search")).toBe("№2");
  });

  test("создание склада: форма → POST → модалка закрыта, склад в списке", async ({ page, api }) => {
    const f = await openCreateWarehouse(page);
    await expect(f.modal.getByRole("heading", { name: "Создать склад" })).toBeVisible();
    await f.name.fill("Склад «Восток»");
    await f.address.fill("Бишкек, Исанова 5");
    await f.submit.click();

    await expect(f.name).toBeHidden();
    const posts = api.calls("warehouses", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ name: "Склад «Восток»", location: "Бишкек, Исанова 5" });
    await expect(rowWith(page, "Склад «Восток»")).toBeVisible();
    await expect(page.getByText("Всего: 3 • Найдено: 3")).toBeVisible();
  });

  test("название и адрес обрезаются по краям", async ({ page, api }) => {
    const f = await openCreateWarehouse(page);
    await f.name.fill("   Склад с пробелами  ");
    await f.address.fill("  Адрес  ");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("warehouses", "POST")[0].body).toEqual({ name: "Склад с пробелами", location: "Адрес" });
  });

  test("редактирование склада: предзаполнение и PATCH с новыми значениями", async ({ page, api }) => {
    await openWarehouses(page);
    await rowWith(page, "Склад №2").getByRole("button", { name: "Редактировать" }).click();
    const f = warehouseForm(page, "Редактировать склад");
    await expect(f.name).toHaveValue("Склад №2");
    await expect(f.address).toHaveValue("Ош");
    await f.name.fill("Склад №2 (новый)");
    await f.address.fill("Ош, Ленина 7");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    const patches = api.calls("warehouseItem", "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].url.pathname).toContain("/warehouse/wh-2/");
    expect(patches[0].body).toEqual({ name: "Склад №2 (новый)", location: "Ош, Ленина 7" });
  });

  test("после редактирования новое название сразу видно в таблице", async ({ page }) => {
    // Регрессия (исправлено): WarehouseTable обёрнут в React.memo с компаратором только по loading/длине списка, а строка —
    // по id и номеру. После успешного PATCH список в Redux обновился, но таблица не перерисовалась:
    // старые название и адрес висят, пока не будет перезапроса или перемонтирования.
    await openWarehouses(page);
    await rowWith(page, "Склад №2").getByRole("button", { name: "Редактировать" }).click();
    const f = warehouseForm(page, "Редактировать склад");
    await f.name.fill("Склад Обновлённый");
    await f.submit.click();
    await expect(f.name).toBeHidden();
    await expect(rowWith(page, "Склад Обновлённый")).toBeVisible({ timeout: 3_000 });
  });

  test("пагинация: 120 складов → «Страница 1 из 3», «Вперед» открывает страницу 2", async ({
    page,
    api,
  }) => {
    api.db.warehouses = Array.from({ length: 120 }, (_, i) => ({
      id: `bulk-${i + 1}`,
      name: `Склад нагрузка ${i + 1}`,
      location: `Адрес ${i + 1}`,
      products_count: i,
    }));
    await page.goto(URLS.warehouses);
    await expect(page.getByText("Страница 1 из 3 (120 складов)")).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Назад" }).last()).toBeDisabled();
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 3 (120 складов)")).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    await expect(rowWith(page, "Склад нагрузка 51")).toBeVisible();
    expect(api.calls("warehouses", "GET").at(-1)!.url.searchParams.get("page")).toBe("2");
  });
});

test.describe("1. Хеппи-пат: партнёрства (/crm/warehouse/warehouses?tab=partnerships)", () => {
  test("прямая ссылка открывает вкладку «Партнёры»; переключение вкладок пишет tab в URL", async ({
    page,
    api,
  }) => {
    await openPartnerships(page);
    await expect(page.getByText("Партнёрство складов между компаниями")).toBeVisible();
    // Список складов грузится и на вкладке партнёрств (хуки в родителе).
    expect(api.calls("warehouses", "GET").length).toBeGreaterThan(0);
    await expect(createWarehouseButton(page)).toHaveCount(0);

    await pageTab(page, "Склады").click();
    await expect(page).not.toHaveURL(/tab=partnerships/);
    await expect(createWarehouseButton(page)).toBeVisible();
    await pageTab(page, "Партнёры").click();
    await expect(page).toHaveURL(/tab=partnerships/);
  });

  test("активные партнёры: колонки, даты, переключатели и переходы", async ({ page }) => {
    await openPartnerships(page);
    const main = rowWith(page, "ОсОО Партнёр");
    await expect(main).toContainText("С подтверждением");
    await expect(main).toContainText("Видны партнёру");
    await expect(main).toContainText("01.09.2026");
    const hidden = rowWith(page, "ИП Скрытый");
    await expect(hidden).toContainText("Без подтверждения");
    await expect(hidden).toContainText("Скрыты");
    // Партнёр скрыл свою историю → «Продажи» недоступны.
    await expect(hidden.getByRole("button", { name: "Продажи" })).toBeDisabled();
    await expect(main.getByRole("button", { name: "Продажи" })).toBeEnabled();
    // Бейдж «Активные» = 2.
    await expect(subTab(page, /^Активные/)).toContainText("2");

    await main.getByRole("button", { name: "Продажи" }).click();
    await expect(page).toHaveURL(new RegExp(`/partners/${PARTNER_ID}/sales$`));
  });

  test("«Аналитика партнёров» и «Аналитика» ведут на страницы аналитики", async ({ page }) => {
    await openPartnerships(page);
    await rowWith(page, "ОсОО Партнёр").getByRole("button", { name: "Аналитика" }).click();
    await expect(page).toHaveURL(new RegExp(`/partners/${PARTNER_ID}/analytics$`));
    await page.goBack();
    await expect(subTab(page, /^Активные/)).toBeVisible(FIRST_RENDER);
    await page.getByRole("button", { name: "Аналитика партнёров" }).click();
    await expect(page).toHaveURL(/\/partners\/analytics$/);
  });

  test("переключатель «Забирать у вас»: включение — с подтверждением, выключение — сразу", async ({
    page,
    api,
  }) => {
    await openPartnerships(page);
    const main = rowWith(page, "ОсОО Партнёр");
    // Сам input[role=switch] спрятан под стилизованной дорожкой — кликаем по видимой подписи.
    await main.getByText("С подтверждением", { exact: true }).click();
    await confirmAction(page, "забирать товар с ваших складов и деньги из ваших касс без вашего подтверждения");
    await expect(main).toContainText("Без подтверждения");
    expect(api.calls("partnerSettings", "PATCH")[0].body).toEqual({ allow_direct_pull: true });

    // Выключение подтверждения не требует.
    await main.getByText("Без подтверждения", { exact: true }).click();
    await expect(main).toContainText("С подтверждением");
    expect(api.calls("partnerSettings", "PATCH")[1].body).toEqual({ allow_direct_pull: false });
    await expect(confirmDialog(page)).toHaveCount(0);
  });

  test("переключатель «Ваши продажи»: включение — с подтверждением", async ({ page, api }) => {
    await openPartnerships(page);
    const hidden = rowWith(page, "ИП Скрытый");
    await hidden.getByText("Скрыты", { exact: true }).click();
    await confirmAction(page, "историю ваших продаж и возвратов");
    await expect(hidden).toContainText("Видны партнёру");
    expect(api.calls("partnerSettings", "PATCH")[0].body).toEqual({ share_sales_history: true });
  });

  test("отмена подтверждения ничего не отправляет", async ({ page, api }) => {
    await openPartnerships(page);
    await rowWith(page, "ОсОО Партнёр").getByText("С подтверждением", { exact: true }).click();
    await confirmDialog(page).getByRole("button", { name: "Отменить" }).click();
    expect(api.calls("partnerSettings")).toHaveLength(0);
  });

  test("разрыв партнёрства: confirm → POST terminate → «Партнёрство разорвано»", async ({
    page,
    api,
  }) => {
    await openPartnerships(page);
    await rowWith(page, "ОсОО Партнёр").getByRole("button", { name: "Разорвать" }).click();
    await confirmAction(page, "Разорвать партнёрство с «ОсОО Партнёр»?");
    await closeAlert(page, "Партнёрство разорвано");
    expect(api.calls("partnerTerminate", "POST")[0].url.pathname).toContain(`/companies/${PARTNER_ID}/terminate/`);
    await expect(rowWith(page, "ОсОО Партнёр")).toHaveCount(0);
  });

  test("входящие заявки: принять и отклонить через confirm", async ({ page, api }) => {
    await openPartnerships(page);
    await subTab(page, /^Входящие заявки/).click();
    await expect(page).toHaveURL(/sub=incoming/);
    const row = rowWith(page, "ОсОО Входящая");
    await expect(row).toContainText("Ожидает");
    await expect(row).toContainText("Давайте дружить");

    await row.getByRole("button", { name: "Отклонить" }).click();
    await confirmAction(page, "Отклонить заявку от «ОсОО Входящая»?");
    await expect(rowWith(page, "ОсОО Входящая")).toHaveCount(0);
    expect(api.calls("requestAction", "POST")[0].url.pathname).toContain("/rq-in-1/reject/");
    await expect(page.getByText("Нет входящих заявок")).toBeVisible();
  });

  test("принять заявку: confirm с описанием доступа → POST accept", async ({ page, api }) => {
    await openPartnerships(page);
    await subTab(page, /^Входящие заявки/).click();
    await rowWith(page, "ОсОО Входящая").getByRole("button", { name: "Принять" }).click();
    await confirmAction(page, "Партнёр получит доступ к вашим складам, остаткам, кассам, аналитике и истории продаж");
    await expect.poll(() => api.calls("requestAction", "POST").length).toBe(1);
    expect(api.calls("requestAction", "POST")[0].url.pathname).toContain("/rq-in-1/accept/");
  });

  test("исходящие заявки: «Отозвать» работает без подтверждения", async ({ page, api }) => {
    await openPartnerships(page);
    await subTab(page, "Исходящие заявки").click();
    await rowWith(page, "ОсОО Исходящая").getByRole("button", { name: "Отозвать" }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(rowWith(page, "ОсОО Исходящая")).toHaveCount(0);
    expect(api.calls("requestAction", "POST")[0].url.pathname).toContain("/rq-out-1/cancel/");
  });

  test("запросы на товар и деньги: подтверждение операции и отклонение", async ({ page, api }) => {
    await openPartnerships(page);
    await subTab(page, /^Запросы на товар и деньги/).click();
    await expect(page.getByRole("heading", { name: "Партнёры запрашивают у вас" })).toBeVisible();
    const incassation = rowWith(page, "ОсОО Партнёр").filter({ hasText: "Деньги" });
    await expect(incassation).toContainText(numRe(5000));
    await expect(incassation).toContainText("сом");
    await expect(incassation).toContainText("Касса партнёра → Наша касса");
    await expect(rowWith(page, "Товар").filter({ hasText: "2 позиции" })).toBeVisible();

    await incassation.getByRole("button", { name: "Подтвердить" }).click();
    await confirmAction(page, "Деньги спишутся из вашей кассы");
    await closeAlert(page, "Операция проведена");
    expect(api.calls("operationAction", "POST")[0].url.pathname).toContain("/op-in-1/approve/");
    await expect(page.getByText("Нет запросов от партнёров")).toBeVisible();
  });

  test("приглашение: поиск от 3 символов, статусы компаний и «Отправить» → исходящие заявки", async ({
    page,
    api,
  }) => {
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Приглашайте только компании, которым доверяете");

    const search = dlg.getByPlaceholder("Минимум 3 символа названия");
    await search.fill("ОО");
    await expect(dlg.getByText("Введите минимум 3 символа")).toBeVisible();
    expect(api.calls("companySearch")).toHaveLength(0);

    await search.fill("ОсО");
    await expect(rowWithin(dlg, "ОсОО Новая Компания")).toContainText("Отправить");
    await expect(dlg.getByText("Уже партнёр")).toBeVisible();
    await expect(dlg.getByText("Заявка отправлена")).toBeVisible();
    expect(api.calls("companySearch")[0].url.searchParams.get("search")).toBe("ОсО");

    await dlg.locator("#partnership-invite-note").fill("Давайте сотрудничать");
    await rowWithin(dlg, "ОсОО Новая Компания").getByRole("button", { name: "Отправить" }).click();
    await expect(dlg).toBeHidden();
    expect(api.calls("requests", "POST")[0].body).toEqual({ to_company: "c-new", note: "Давайте сотрудничать" });
    await expect(page).toHaveURL(/sub=outgoing/);
    await expect(rowWith(page, "ОсОО Новая Компания")).toBeVisible();
  });

  test("поиск компании: «Ничего не найдено» для несуществующего названия", async ({ page }) => {
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await dlg.getByPlaceholder("Минимум 3 символа названия").fill("Несуществующая");
    await expect(dlg.getByText("Ничего не найдено")).toBeVisible();
  });
});

/** Элемент списка результатов внутри диалога. */
const rowWithin = (scope: Locator, text: string) => scope.getByRole("listitem").filter({ hasText: text });

test.describe("1. Хеппи-пат: остатки (/crm/warehouse/stocks/:id)", () => {
  test("загрузка: название склада, запросы, сортировка и форматирование", async ({ page, api }) => {
    await openStocks(page);
    expect(api.calls("warehouseProducts", "GET")[0].url.pathname).toContain(`/warehouse/${WAREHOUSE_ID}/products/`);
    expect(api.calls("warehouseProducts", "GET")[0].url.searchParams.get("page")).toBe("1");
    expect(api.calls("groups", "GET")[0].url.pathname).toContain(`/warehouse/${WAREHOUSE_ID}/groups/`);
    await expect(page.getByText("Управление товарами на складе")).toBeVisible();
    await expect(countersText(page, 4, 4)).toBeVisible();

    // Сортировка на клиенте: сначала латиница, затем кириллица по алфавиту.
    const names = await page.getByRole("row").filter({ hasText: /Apple|Молоко|Услуга|Хлеб/ }).allInnerTexts();
    expect(names.map((t) => t.match(/Apple Juice|Молоко 1л|Услуга доставки|Хлеб/)?.[0])).toEqual([
      "Apple Juice",
      "Молоко 1л",
      "Услуга доставки",
      "Хлеб",
    ]);
    // Цена без разделителей и хвостовых нулей, остаток с пробелом, услуга без остатка.
    const juice = rowWith(page, "Apple Juice");
    await expect(juice).toContainText("10.5");
    await expect(juice).toContainText(/1[\s  ]234\.5/);
    await expect(rowWith(page, "Услуга доставки")).toContainText("Услуга");
    await expect(rowWith(page, "Молоко 1л")).toContainText("A-1");
    await expectNoRenderGarbage(page);
  });

  test("клик по строке открывает карточку товара, «Создать товар» — форму с warehouse_id", async ({
    page,
  }) => {
    await openStocks(page);
    await page.getByRole("button", { name: "Создать товар" }).click();
    await expect(page).toHaveURL(new RegExp(`/stocks/add-product\\?warehouse_id=${WAREHOUSE_ID}`));
    await page.goBack();
    await expect(rowWith(page, "Молоко 1л")).toBeVisible(FIRST_RENDER);
    await rowWith(page, "Молоко 1л").getByRole("cell").nth(2).click();
    await expect(page).toHaveURL(/\/crm\/warehouse\/products\/p-1/);
  });

  test("«Назад» ведёт к списку складов", async ({ page }) => {
    await openStocks(page);
    await page.getByRole("button", { name: "Назад", exact: true }).first().click();
    await expect(page).toHaveURL(/\/crm\/warehouse\/warehouses$/);
  });

  test("поиск: debounce, параметр search и пустое состояние", async ({ page, api }) => {
    await openStocks(page);
    const req = page.waitForRequest(
      (r) => ENDPOINTS.warehouseProducts.test(r.url()) && r.url().includes("search=%D0%A5%D0%BB%D0%B5%D0%B1"),
    );
    await stocksSearch(page).fill("Хлеб");
    await req;
    await expect(rowWith(page, "Хлеб")).toBeVisible();
    await expect(rowWith(page, "Молоко 1л")).toHaveCount(0);
    await expect(countersText(page, 1, 1)).toBeVisible();

    await stocksSearch(page).fill("нет такого");
    await expect(page.getByText("Товары не найдены")).toBeVisible();
    expect(api.calls("warehouseProducts", "GET").at(-1)!.url.searchParams.get("search")).toBe("нет такого");
  });

  test("группы: выбор группы фильтрует по product_group и пишет его в URL", async ({ page, api }) => {
    await openStocks(page);
    api.db.products = api.db.products.map((p, i) => ({ ...p, product_group: i < 2 ? "g-1" : null }));
    await groupRow(page, "Молочка").click();
    await expect(page).toHaveURL(/product_group=g-1/);
    await expect
      .poll(() => api.calls("warehouseProducts", "GET").at(-1)!.url.searchParams.get("product_group"))
      .toBe("g-1");
    await expect(rowWith(page, "Хлеб")).toHaveCount(0);

    await page.getByRole("button", { name: /Все товары/ }).first().click();
    await expect(page).not.toHaveURL(/product_group/);
    await expect(rowWith(page, "Хлеб")).toBeVisible();
  });

  test("создание группы: POST с warehouse и parent, дерево перезагружается", async ({ page, api }) => {
    await openStocks(page);
    await page.getByTitle("Добавить группу в корень").click();
    await page.getByPlaceholder("Название группы").fill("Выпечка");
    await page.getByTitle("Создать", { exact: true }).click();
    await expect(groupRow(page, "Выпечка")).toBeVisible();
    expect(api.calls("groups", "POST")[0].body).toEqual({ name: "Выпечка", warehouse: WAREHOUSE_ID, parent: null });
  });

  test("подгруппа: «Добавить подгруппу» шлёт parent; вложенные группы раскрываются", async ({
    page,
    api,
  }) => {
    await openStocks(page);
    await expect(groupRow(page, "Сыры")).toHaveCount(0); // вложенная, пока родитель свёрнут
    await groupRow(page, "Молочка").getByTitle("Добавить подгруппу").click();
    await page.getByPlaceholder("Название группы").fill("Йогурты");
    await page.keyboard.press("Enter");
    await expect.poll(() => api.calls("groups", "POST").length).toBe(1);
    expect(api.calls("groups", "POST")[0].body).toMatchObject({ name: "Йогурты", parent: "g-1" });
  });

  test("удаление группы: confirm «Удалить группу?» → DELETE → группа исчезает", async ({ page, api }) => {
    await openStocks(page);
    await groupRow(page, "Напитки").getByTitle("Удалить группу").click();
    await confirmAction(page, "Удалить группу?");
    await expect(groupRow(page, "Напитки")).toHaveCount(0);
    expect(api.calls("groupItem", "DELETE")[0].url.pathname).toContain("/groups/g-2/");
  });

  test("удаление открытой группы возвращает к «Все товары» и убирает product_group из URL", async ({
    page,
    api,
  }) => {
    await openStocks(page);
    await groupRow(page, "Напитки").click();
    await expect(page).toHaveURL(/product_group=g-2/);
    await groupRow(page, "Напитки").getByTitle("Удалить группу").click();
    await confirmAction(page, "Удалить группу?");
    await expect(groupRow(page, "Напитки")).toHaveCount(0);
    await expect(page).not.toHaveURL(/product_group/);
    await expect(rowWith(page, "Молоко 1л")).toBeVisible();
    expect(api.calls("groupItem", "DELETE")).toHaveLength(1);
  });

  test("после перемещения выбор и целевая группа сбрасываются", async ({ page }) => {
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    const select = page
      .locator("div")
      .filter({ has: page.getByText("Переместить в", { exact: true }) })
      .last()
      .locator("select");
    await select.selectOption({ label: "Напитки" });
    await page.getByRole("button", { name: /^Переместить \(\d+\)$/ }).click();
    await expect(page.getByText(/выбран/)).toHaveCount(0);
  });

  test("выбор строк: панель действий, «Сбросить» и массовое удаление", async ({ page, api }) => {
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await productCheckbox(page, "Молоко 1л").check();
    await expect(page.getByText(/2\s*товара выбрано/)).toBeVisible();
    await page.getByRole("button", { name: "Сбросить" }).first().click();
    await expect(page.getByText(/выбрано/)).toHaveCount(0);

    await productCheckbox(page, "Хлеб").check();
    await page.getByRole("button", { name: "Удалить выбранные" }).click();
    const dlg = page.getByRole("dialog").filter({ hasText: "Подтверждение удаления" });
    await expect(dlg).toContainText("Вы уверены, что хотите удалить выбранные 1 товар?");
    await dlg.getByRole("button", { name: "Удалить" }).click();

    await expect(rowWith(page, "Хлеб")).toHaveCount(0);
    const del = api.calls("bulkDelete", "DELETE");
    expect(del).toHaveLength(1);
    expect(del[0].body).toEqual({ ids: ["p-4"], soft: true, require_all: false });
  });

  test("перемещение выбранных товаров в группу: PATCH на каждый товар", async ({ page, api }) => {
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await productCheckbox(page, "Молоко 1л").check();
    const select = page.locator("div").filter({ has: page.getByText("Переместить в", { exact: true }) }).last().locator("select");
    const move = page.getByRole("button", { name: /^Переместить \(\d+\)$/ });
    await expect(move).toBeDisabled();
    await select.selectOption({ label: "Напитки" });
    await expect(move).toBeEnabled();
    await move.click();
    await expect.poll(() => api.calls("productItem", "PATCH").length).toBe(2);
    const bodies = api.calls("productItem", "PATCH").map((c) => c.body);
    expect(bodies).toEqual([{ product_group: "g-2" }, { product_group: "g-2" }]);
  });

  test("фильтры: нельзя снять все типы товара, «Применить» отправляет параметры", async ({ page, api }) => {
    await openStocks(page);
    await page.getByRole("button", { name: "Фильтры" }).click();
    await expect(page.getByText("Настройте фильтры для поиска товаров")).toBeVisible();
    for (const kind of ["Товар", "Услуга", "Комплект"]) {
      await page.getByLabel(kind, { exact: true }).uncheck();
    }
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Выберите хотя бы один тип товара" })).toBeVisible();

    await page.getByLabel("Услуга", { exact: true }).check();
    await page.getByRole("button", { name: "Применить" }).click();
    await expect
      .poll(() => api.calls("warehouseProducts", "GET").at(-1)!.url.search)
      .toMatch(/kind(%5B%5D|\[\])=service/);
  });

  test("после применения фильтра обновлённые цены тех же товаров отображаются", async ({ page, api }) => {
    // Регрессия (исправлено): ProductTable/строки обёрнуты в memo с компаратором по id, номеру и выбору. Перезапрос, который
    // вернул ТЕ ЖЕ товары с новыми ценами/остатками, не меняет DOM: на экране остаются старые данные.
    await openStocks(page);
    api.on("warehouseProducts", (route, _c, db) =>
      json(route, paginated(db.products.map((p) => ({ ...p, price: "999" })))),
    );
    await page.getByRole("button", { name: "Фильтры" }).click();
    // Фильтр должен реально измениться, иначе перезапрос не уходит (параметры те же).
    await field(page.locator("body"), page, "Бренд", "select").selectOption({ label: "Бренд А" });
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(rowWith(page, "Молоко 1л")).toContainText("999", { timeout: 3_000 });
  });

  test("пагинация: 250 товаров → пять страниц по 50, ?page= в URL", async ({ page, api }) => {
    api.db.products = Array.from({ length: 250 }, (_, i) => ({
      id: `bp-${i + 1}`,
      name: `Товар ${String(i + 1).padStart(3, "0")}`,
      price: "10",
      quantity: "1",
      unit: "шт",
      kind: "product",
    }));
    await page.goto(URLS.stocks);
    await expect(page.getByText("Страница 1 из 5 (250 товаров)")).toBeVisible(FIRST_RENDER);
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText(/Страница 2 из 5/)).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    await expect
      .poll(() => api.calls("warehouseProducts", "GET").at(-1)!.url.searchParams.get("page"))
      .toBe("2");
    await expect(rowWith(page, "Товар 051")).toBeVisible();
    // Нумерация строк продолжается: на второй странице первая строка — №51.
    await expect(rowWith(page, "Товар 051").getByRole("cell", { name: "51", exact: true })).toBeVisible();
  });

  test("карточки: переключение вида и выбор «Выбрать все»", async ({ page }) => {
    await openStocks(page);
    await page.getByRole("button", { name: "Карточки" }).click();
    await expect(page.getByText("Выбрать все")).toBeVisible();
    await page.getByLabel("Выбрать все").check();
    await expect(page.getByText("Выбрано: 4")).toBeVisible();
    await page.getByRole("button", { name: "Таблица" }).click();
    await expect(rowWith(page, "Молоко 1л")).toBeVisible();
  });
});

test.describe("1. Хеппи-пат: создание товара (/crm/warehouse/stocks/add-product)", () => {
  test("загрузка: склад из URL, заголовок, типы, штрих-код EAN-13", async ({ page, api }) => {
    await openAddProduct(page);
    await expect(page.getByText("Заполните информацию о новом товаре")).toBeVisible();
    for (const t of ["Товар", "Услуга", "Комплект"]) {
      await expect(page.getByRole("button", { name: new RegExp(`^${t}`) }).first()).toBeVisible();
    }
    // Справочники и товары склада грузятся на старте.
    expect(api.calls("warehouses", "GET")[0].url.searchParams.get("page_size")).toBe("1000");
    expect(api.calls("warehouseProducts", "GET")[0].url.pathname).toContain(`/warehouse/${WAREHOUSE_ID}/products/`);
    expect(api.calls("warehouseProducts", "GET")[0].url.searchParams.get("page_size")).toBe("10000");

    const code = await barcodeInput(page).inputValue();
    expect(ean13Valid(code), `штрих-код «${code}» не EAN-13`).toBe(true);
    await expect(addField(page, "Код товара", "input")).toHaveValue("0001");
    // «Сгенерировать» меняет штрих-код на другой валидный.
    await page.getByText("(Сгенерировать)", { exact: true }).click();
    await expect.poll(async () => ean13Valid(await barcodeInput(page).inputValue())).toBe(true);
  });

  test("расчёт цены: закупка 100 + наценка 25% → цена продажи 125.000", async ({ page }) => {
    await openAddProduct(page);
    const p = priceFields(page);
    await p.purchase.fill("100");
    await p.markup.fill("25");
    await expect(p.sale).toHaveValue("125.000");
    await p.purchase.fill("80.5");
    await p.markup.fill("10");
    await expect(p.sale).toHaveValue("88.550");
    // Закупка есть, наценка 0 → цена равна закупке.
    await p.markup.fill("0");
    await p.purchase.fill("100");
    await expect(p.sale).toHaveValue("100.000");
  });

  test("обратный пересчёт: цена продажи 150 при закупке 100 → наценка 50.000", async ({ page }) => {
    await openAddProduct(page);
    const p = priceFields(page);
    await p.purchase.fill("100");
    await p.markup.fill("25");
    await p.sale.fill("150");
    await expect(p.markup).toHaveValue("50.000");
    // Цена закрепилась вручную: смена закупки пересчитывает цену от текущей наценки.
    await p.purchase.fill("200");
    await expect(p.sale).toHaveValue("300.000");
    // Цена ниже закупки → отрицательная наценка, цена остаётся введённой.
    await p.purchase.fill("100");
    await p.sale.fill("80");
    await expect(p.markup).toHaveValue("-20.000");
    await expect(p.sale).toHaveValue("80");
  });

  test("подсказка: наценка без цены закупки", async ({ page }) => {
    await openAddProduct(page);
    await priceFields(page).markup.fill("30");
    await expect(page.getByText("Сначала укажите цену закупки — цена продажи пересчитается автоматически")).toBeVisible();
  });

  test("создание товара: POST с рассчитанной ценой → «Товар успешно добавлен!» → склад", async ({
    page,
    api,
  }) => {
    await openAddProduct(page);
    await fillProduct(page, { name: "Йогурт клубничный", purchase: "100", markup: "25", qty: "10" });
    const code = await barcodeInput(page).inputValue();
    await submitProduct(page).click();

    const dlg = addAlert(page, "Товар успешно добавлен!");
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("heading", { name: "Успех" })).toBeVisible();
    const posts = api.calls("warehouseProducts", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url.pathname).toContain(`/warehouse/${WAREHOUSE_ID}/products/`);
    expect(posts[0].body).toMatchObject({
      name: "Йогурт клубничный",
      barcode: code,
      warehouse: WAREHOUSE_ID,
      kind: "product",
      price: "125.000",
      purchase_price: "100",
      markup_percent: "25",
      quantity: 10,
      stock: true,
      unit: "шт",
    });
    // Расход в кассу по новому товару (если есть касса) уходит отдельным запросом.
    await expect.poll(() => api.calls("cashflows", "POST").length).toBe(1);
    // Через 1,5 с — возврат на страницу склада.
    await expect(page).toHaveURL(new RegExp(`/crm/warehouse/stocks/${WAREHOUSE_ID}$`), { timeout: 8_000 });
  });

  test("услуга: только цена продажи, kind=service, остаток не ведётся", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: /^Услуга/ }).click();
    await nameInput(page).fill("Доставка по городу");
    await addField(page, "Цена продажи", "input").fill("300");
    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")[0].body).toMatchObject({
      kind: "service",
      name: "Доставка по городу",
      price: "300",
      purchase_price: "0",
      quantity: 0,
      stock: false,
    });
  });

  test("комплект: состав суммируется в цену, packages_input уходит в payload", async ({ page, api }) => {
    api.db.products = [
      { id: "kp-1", name: "Кофе зерновой", price: "150.00", purchase_price: "100", unit: "шт", quantity: "10" },
      { id: "kp-2", name: "Сахар", price: "50", purchase_price: "30", unit: "шт", quantity: "10" },
    ];
    await openAddProduct(page);
    await page.getByRole("button", { name: /^Комплект/ }).click();
    await nameInput(page).fill("Набор «Утро»");
    const search = page.getByPlaceholder("поиск...");
    await search.fill("Кофе");
    await page.getByText("Кофе зерновой", { exact: true }).click();
    await search.fill("Сахар");
    await page.getByText("Сахар", { exact: true }).click();
    // Кофе × 2 (150 × 2) + сахар × 1 (50) = 350.
    const qty = page.locator("div").filter({ hasText: /^Кофе зерновой/ }).last().locator("input").first();
    await qty.fill("2");
    await expect(addField(page, "Цена продажи", "input")).toHaveValue("350.000");

    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    const body = api.calls("warehouseProducts", "POST")[0].body;
    expect(body).toMatchObject({ kind: "bundle", price: "350.000", stock: false });
    expect(body.packages_input).toHaveLength(2);
  });

  test("весовой товар: PLU подставляется как число весовых товаров + 1", async ({ page, api }) => {
    api.db.products = [1, 2, 3].map((i) => ({ id: `w-${i}`, name: `Весовой ${i}`, is_weight: true, price: "1", quantity: "1" }));
    await openAddProduct(page);
    await page.getByLabel("Весовой товар").check();
    await expect(page.getByPlaceholder("Введите PLU код")).toHaveValue("4");
    await fillProduct(page, { name: "Сыр весовой" });
    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")[0].body).toMatchObject({ is_weight: true, plu: 4 });
    // Снятие галочки очищает PLU.
  });

  test("страна производства: поиск и выбор из выпадающего списка", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByText("Выберите страну").click();
    await page.getByPlaceholder("Поиск страны...").fill("Кит");
    await page.getByText("Китай", { exact: true }).click();
    await expect(page.getByText("Китай").first()).toBeVisible();
    await fillProduct(page);
    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")[0].body.country).toBe("Китай");

    await openAddProduct(page);
    await page.getByText("Выберите страну").click();
    await page.getByPlaceholder("Поиск страны...").fill("Атлантида");
    await expect(page.getByText("Страна не найдена")).toBeVisible();
  });

  test("бренд «на лету»: создание → POST → выбран в списке", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: "+ Создать бренд" }).click();
    await page.getByPlaceholder("Название бренда").fill("Новый Бренд");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await closeAddAlert(page, "Бренд успешно создан!");
    expect(api.calls("brands", "POST")[0].body).toEqual({ name: "Новый Бренд" });
    await expect(addField(page, "Бренд", "select")).toContainText("Новый Бренд");
  });

  test("категория «на лету»: создание → POST warehouse/category/", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: "+ Создать категорию" }).click();
    await page.getByPlaceholder("Название категории").fill("Сладости");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await closeAddAlert(page, "Категория успешно создана!");
    expect(api.calls("warehouseCategories", "POST")[0].body).toEqual({ name: "Сладости" });
  });

  test("поставщик «на лету»: создаётся с type=suppliers и выбирается", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: "+ Создать поставщика" }).click();
    await page.getByPlaceholder("ФИО").fill("ИП Новый Поставщик");
    await page.getByPlaceholder("Телефон").fill("+996700111222");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await closeAddAlert(page, "Поставщик успешно создан!");
    expect(api.calls("clients", "POST")[0].body).toMatchObject({
      full_name: "ИП Новый Поставщик",
      phone: "+996700111222",
      type: "suppliers",
    });
    await expect(addField(page, "Выберите поставщика", "select")).toContainText("ИП Новый Поставщик");
  });

  test("фото: превью, «Главное», удаление и загрузка multipart после сохранения", async ({ page, api }) => {
    await openAddProduct(page);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page.locator('input[type="file"]').setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png },
      { name: "two.png", mimeType: "image/png", buffer: png },
    ]);
    await expect(page.getByAltText("Preview")).toHaveCount(2);
    // Главное фото одно: у второго есть кнопка «Сделать главным».
    await expect(page.getByRole("button", { name: "Сделать главным" })).toHaveCount(1);
    await page.getByRole("button", { name: "Сделать главным" }).click();
    await page.getByRole("button", { name: "×" }).first().click();
    await expect(page.getByAltText("Preview")).toHaveCount(1);

    await fillProduct(page);
    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    await expect.poll(() => api.calls("productImages", "POST").length).toBe(1);
    expect(api.calls("productImages", "POST")[0].raw).toContain("is_primary");
  });
});

/** Универсальный helper: закрыть AlertModal страницы товара («Ok»). */
async function closeAddAlert(page: Page, text: string | RegExp): Promise<void> {
  const dlg = addAlert(page, text);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Ok" }).click();
  await expect(dlg).toBeHidden();
}

test.describe("1. Хеппи-пат: редактирование товара (/crm/warehouse/stocks/add-product/:id)", () => {
  const EDIT = (price = "150.00", markup = "50") => ({
    id: "p-edit",
    name: "Молоко 1л",
    barcode: "4600000000019",
    warehouse: WAREHOUSE_ID,
    kind: "product",
    unit: "шт",
    price,
    purchase_price: "100.00",
    markup_percent: markup,
    quantity: "50",
    discount_percent: "0",
    minimum_quantity: "0",
    is_weight: false,
  });

  test("форма заполняется данными товара, остаток только для чтения", async ({ page, api }) => {
    api.db.products = [EDIT()];
    await page.goto(`/crm/warehouse/stocks/add-product/p-edit?warehouse_id=${WAREHOUSE_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Редактирование товара" })).toBeVisible(FIRST_RENDER);
    await expect(page.getByRole("button", { name: "Сохранить изменения" })).toBeVisible(FIRST_RENDER);
    await expect(nameInput(page)).toHaveValue("Молоко 1л");
    await expect(addField(page, "Остаток на складе", "input")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Корректировка остатка" })).toBeVisible();
  });

  test("сохранение: PATCH без quantity", async ({ page, api }) => {
    api.db.products = [EDIT("150.00", "50")];
    await page.goto(`/crm/warehouse/stocks/add-product/p-edit?warehouse_id=${WAREHOUSE_ID}`);
    await expect(page.getByRole("button", { name: "Сохранить изменения" })).toBeVisible(FIRST_RENDER);
    await nameInput(page).fill("Молоко 1л (новое)");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await expect(addAlert(page, "Товар успешно обновлен!")).toBeVisible();
    const patch = api.calls("productItem", "PATCH")[0];
    expect(patch.body.name).toBe("Молоко 1л (новое)");
    expect(patch.body).not.toHaveProperty("quantity");
  });

  test("открытие карточки не меняет цену продажи товара", async ({ page, api }) => {
    // Регрессия (исправлено): при открытии товара с ценой 150, закупкой 100 и наценкой 0 цена продажи может молча
    // превратиться в «закупка × (1 + наценка)» = 100.000 — тогда «Сохранить» без правок снижает цену.
    // Было плавающим: WebKit — всегда, Chromium — в ~1/3 запусков (порядок эффектов после загрузки товара).
    // Теперь в режиме редактирования сохранённая цена считается введённой вручную, пока не тронуты закупка/наценка.
    api.db.products = [EDIT("150.00", "0")];
    await page.goto(`/crm/warehouse/stocks/add-product/p-edit?warehouse_id=${WAREHOUSE_ID}`);
    await expect(page.getByRole("button", { name: "Сохранить изменения" })).toBeVisible(FIRST_RENDER);
    // Ждём, пока форма устоится (эффект пересчёта срабатывает после монтирования), и только потом смотрим цену:
    // иначе проверка ловит исходное значение до перезаписи.
    await expect(priceFields(page).purchase).toHaveValue(/^100/);
    await page.waitForTimeout(800);
    await expect(priceFields(page).sale).toHaveValue(/^150/);
  });
});

test.describe("1. Хеппи-пат: история продаж партнёра (/crm/warehouse/partners/:id/sales)", () => {
  test("загрузка: заголовок из ответа, запрос по умолчанию, KPI и строки", async ({ page, api }) => {
    await openSales(page);
    const url = api.calls("partnerSales", "GET")[0].url;
    expect(url.pathname).toContain(`/companies/${PARTNER_ID}/sales/`);
    expect(url.searchParams.get("period")).toBe("month");
    expect(url.searchParams.get("date")).toBe(localISO());
    expect(url.searchParams.get("doc_type")).toBe("SALE");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("page_size")).toBe("50");
    expect(url.searchParams.has("status")).toBe(false);

    await expect(page.getByText("05.09 — 05.10")).toBeVisible();
    // KPI из summary: 2 продажи на 1500 + 700 = 2 200, скидки 100, товаров 4.
    const kpis = page.locator("main, #root");
    await expect(kpis).toContainText("Сумма продаж");
    await expect(page.getByText("После скидок")).toBeVisible();
    await expect(kpis).toContainText(numRe(2200, "сом"));
    await expect(kpis).toContainText(numRe(100, "сом"));
    await expect(page.getByText("Единиц во всех документах")).toBeVisible();

    const row = saleRow(page, "S-101");
    await expect(row).toContainText("Склад партнёра (Филиал Ош)");
    await expect(row).toContainText("Покупатель 1");
    await expect(row).toContainText(numRe(1500, "сом"));
    await expect(row).toContainText("Проведён");
    await expect(saleRow(page, "S-102")).toContainText("Ожидает кассы");
    await expectNoRenderGarbage(page);
  });

  test("«Возвраты» и фильтр статуса перезапрашивают данные с параметрами", async ({ page, api }) => {
    await openSales(page);
    const lastParams = () => api.calls("partnerSales", "GET").at(-1)!.url.searchParams;

    await salesTab(page, "Тип документов", "Возвраты").click();
    await expect.poll(() => lastParams().get("doc_type")).toBe("SALE_RETURN");
    await expect(saleRow(page, "R-001")).toBeVisible();
    await expect(page.getByText("Возвратов", { exact: true })).toBeVisible();
    await salesTab(page, "Тип документов", "Продажи").click();
    await expect.poll(() => lastParams().get("doc_type")).toBe("SALE");

    await salesTab(page, "Статус", "Ожидают кассы").click();
    await expect.poll(() => lastParams().get("status")).toBe("CASH_PENDING");
    await expect(saleRow(page, "S-102")).toBeVisible();
    await expect(saleRow(page, "S-101")).toHaveCount(0);
    await salesTab(page, "Статус", "Проведённые").click();
    await expect.poll(() => lastParams().get("status")).toBe("POSTED");
    await salesTab(page, "Статус", "Все").click();
    await expect.poll(() => lastParams().has("status")).toBe(false);
  });

  test("поиск по номеру или покупателю: debounce и параметр search", async ({ page, api }) => {
    await openSales(page);
    const req = page.waitForRequest(
      (r) => ENDPOINTS.partnerSales.test(r.url()) && r.url().includes("search=S-102"),
    );
    await salesSearch(page).fill("S-102");
    await req;
    await expect(saleRow(page, "S-102")).toBeVisible();
    await expect(saleRow(page, "S-101")).toHaveCount(0);
    await salesSearch(page).fill("нет такой");
    await expect(page.getByText("Нет продаж за выбранный период.")).toBeVisible();
  });

  test("период: «День» шлёт date, «Период» — date_from и date_to", async ({ page, api }) => {
    await openSales(page);
    await salesTab(page, "Период", "День").click();
    await expect
      .poll(() => api.calls("partnerSales", "GET").at(-1)!.url.searchParams.get("period"))
      .toBe("day");

    await salesTab(page, "Период", "Период").click();
    const req = page.waitForRequest(
      (r) =>
        ENDPOINTS.partnerSales.test(r.url()) &&
        r.url().includes("date_from=2026-01-10") &&
        r.url().includes("date_to=2026-02-20"),
    );
    await page.getByLabel("С", { exact: true }).fill("2026-01-10");
    await page.getByLabel("По", { exact: true }).fill("2026-02-20");
    await req;
    const url = api.calls("partnerSales", "GET").at(-1)!.url;
    expect(url.searchParams.get("period")).toBe("custom");
    expect(url.searchParams.has("date")).toBe(false);
  });

  test("карточка документа: позиции, оплата, итоги и закрытие", async ({ page, api }) => {
    await openSales(page);
    await saleRow(page, "S-101").click();
    const dlg = page.getByRole("dialog", { name: "Продажа S-101" });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole("heading", { name: "Продажа № S-101" })).toBeVisible();
    expect(api.calls("partnerSale", "GET")[0].url.pathname).toContain(`/sales/s-1/`);

    await expect(dlg).toContainText("Через кассу");
    await expect(dlg).toContainText("Покупатель 1");
    const milk = dlg.getByRole("row").filter({ hasText: "Молоко 1л" });
    await expect(milk).toContainText("A-1");
    await expect(milk).toContainText(/2\s*шт/);
    await expect(milk).toContainText(numRe(50, "сом"));
    await expect(milk).toContainText(numRe(1150, "сом"));
    await expect(dlg.getByRole("row").filter({ hasText: "Хлеб" })).toContainText(numRe(200, "сом"));
    await expect(dlg).toContainText(new RegExp(`Скидка:\\s*${numRe(100, "сом").source}`));
    await expect(dlg).toContainText(new RegExp(`Итого:\\s*${numRe(1500, "сом").source}`));

    await dlg.getByRole("button", { name: "Закрыть" }).click();
    await expect(dlg).toBeHidden();
    // С клавиатуры: Enter открывает (возвраты — на вкладке «Возвраты»).
    await salesTab(page, "Тип документов", "Возвраты").click();
    await saleRow(page, "R-001").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Возврат R-001" })).toBeVisible();
  });

  test("пагинация: 120 продаж → «Страница 1 из 3 (120 документов)», «Вперед» → page=2", async ({ page, api }) => {
    api.db.sales = Array.from({ length: 120 }, (_, i) => makeSale(i + 1, { status: "POSTED" }));
    await page.goto(URLS.sales);
    await expect(page.getByText("Страница 1 из 3 (120 документов)")).toBeVisible(FIRST_RENDER);
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 3 (120 документов)")).toBeVisible();
    expect(api.calls("partnerSales", "GET").at(-1)!.url.searchParams.get("page")).toBe("2");
    await expect(saleRow(page, "S-151")).toBeVisible();
  });

  test("ссылка «К аналитике партнёра» сохраняет partner_branch", async ({ page }) => {
    await page.goto(`${URLS.sales}?partner_branch=br-1`);
    await expect(salesHeading(page)).toBeVisible(FIRST_RENDER);
    const back = page.getByRole("link", { name: "К аналитике партнёра" });
    await expect(back).toHaveAttribute("href", `/crm/warehouse/partners/${PARTNER_ID}/analytics?partner_branch=br-1`);
  });

  test("не владелец и не админ видит только сообщение о доступе, без запросов", async ({ page, api }) => {
    api.on("profile", (route) => json(route, { ...PROFILE, role: "agent" }));
    await page.goto(URLS.sales);
    await expect(
      page.getByText("Раздел партнёрства доступен только владельцу и администратору."),
    ).toBeVisible(FIRST_RENDER);
    expect(api.calls("partnerSales")).toHaveLength(0);
  });
});

/* ======================================================================
   2. ЗАЩИТА ОТ ДУРАКА
   ====================================================================== */

test.describe("2. Защита от дурака: склады и партнёрства", () => {
  test("тройной клик по «Создать» (склад): создаётся ОДИН склад", async ({ page, api }) => {
    api.on("warehouses", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, pageOf(db.warehouses, 1, 50));
      await delay(800); // медленный бэк — окно для повторных кликов
      return json(route, { id: "wh-slow", name: body.name, location: body.location }, 201);
    });
    const f = await openCreateWarehouse(page);
    await f.name.fill("Склад-дубль");
    await f.address.fill("Адрес");
    await f.submit.click({ clickCount: 3 });
    await expect(f.name).toBeHidden({ timeout: 10_000 });
    expect(api.calls("warehouses", "POST")).toHaveLength(1);
  });

  test("пустая форма: ошибки под полями, запросов нет", async ({ page, api }) => {
    const f = await openCreateWarehouse(page);
    await f.submit.click();
    await expect(f.modal.getByText("Название склада обязательно")).toBeVisible();
    await expect(f.modal.getByText("Адрес склада обязателен")).toBeVisible();
    await expect(f.name).toBeVisible();
    expect(api.calls("warehouses", "POST")).toHaveLength(0);

    // Ввод очищает ошибку поля.
    await f.name.fill("А");
    await expect(f.modal.getByText("Название склада обязательно")).toBeHidden();
  });

  test("одни пробелы — то же, что пустое поле", async ({ page, api }) => {
    const f = await openCreateWarehouse(page);
    await f.name.fill("    ");
    await f.address.fill("    ");
    await f.submit.click();
    await expect(f.modal.getByText("Название склада обязательно")).toBeVisible();
    await expect(f.modal.getByText("Адрес склада обязателен")).toBeVisible();
    expect(api.calls("warehouses", "POST")).toHaveLength(0);
  });

  test("спецсимволы и XSS в названии сохраняются как текст и не исполняются", async ({ page, api }) => {
    const evil = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>{}&amp;&"'`;
    const f = await openCreateWarehouse(page);
    await f.name.fill(evil);
    await f.address.fill(evil);
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("warehouses", "POST")[0].body.name).toBe(evil);
    const row = rowWith(page, "onerror");
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(1)).toContainText(evil);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("гигантские название и адрес не ломают страницу и не дают горизонтальный скролл", async ({ page, api }) => {
    const f = await openCreateWarehouse(page);
    await f.name.fill("Ж".repeat(10_000));
    await f.address.fill("Х".repeat(5_000));
    await f.submit.click();
    await expect(f.name).toBeHidden();
    expect(api.calls("warehouses", "POST")[0].body.name).toHaveLength(10_000);
    await expect(rowWith(page, "ЖЖЖЖ")).toBeVisible();
    await expect(warehouseSearch(page)).toBeInViewport();
  });

  test("закрытие модалки по «Отмена» и оверлею не создаёт склад", async ({ page, api, browserName }) => {
    const f = await openCreateWarehouse(page);
    await f.name.fill("Не сохранять");
    await f.cancel.click();
    await expect(f.name).toBeHidden();
    await createWarehouseButton(page).click();
    // Оверлей закрывает модалку (кликаем у правого края: слева — сайдбар). В WebKit клик по такому оверлею
    // нестабилен (иногда уходит под другой слой), поэтому там закрываем кнопкой «Отмена».
    if (browserName === "webkit") {
      await f.cancel.click();
    } else {
      const vw = page.viewportSize()?.width ?? 1280;
      await page.mouse.click(vw - 5, 200);
    }
    await expect(f.name).toBeHidden();
    expect(api.calls("warehouses", "POST")).toHaveLength(0);
  });

  test("приглашение: примечание ограничено 512 символами, XSS в названии компании безопасен", async ({ page, api }) => {
    api.db.companies = [{ id: "c-evil", name: `<img src=x onerror="window.__xss=1">Компания`, partnership_status: null }];
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await dlg.getByPlaceholder("Минимум 3 символа названия").fill("img");
    await expect(rowWithin(dlg, "onerror")).toBeVisible();
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();

    await dlg.locator("#partnership-invite-note").click();
    await page.keyboard.insertText("Я".repeat(800));
    expect((await dlg.locator("#partnership-invite-note").inputValue()).length).toBeLessThanOrEqual(512);
  });

  test("двойной клик по «Отправить» в приглашении: уходит одна заявка", async ({ page, api }) => {
    api.on("requests", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, { incoming: db.requestsIn, outgoing: db.requestsOut });
      await delay(700);
      return json(route, { id: "rq-slow", ...body }, 201);
    });
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await dlg.getByPlaceholder("Минимум 3 символа названия").fill("Нов");
    await rowWithin(dlg, "ОсОО Новая Компания").getByRole("button", { name: "Отправить" }).dblclick();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
    expect(api.calls("requests", "POST")).toHaveLength(1);
  });
});

test.describe("2. Защита от дурака: остатки", () => {
  test("мусорные данные из бэка: пустые поля, XSS, нечисловые цены и остатки", async ({ page, api }) => {
    api.db.products = [
      { id: "g-1", name: `<img src=x onerror="window.__xss=1">Жертва`, price: "abc", quantity: "xyz", unit: undefined },
      { id: "g-2", name: "", price: null, quantity: null },
      { id: "g-3", name: "Ж".repeat(5_000), price: "-50", quantity: "-3" },
    ];
    await page.goto(URLS.stocks);
    await expect(rowWith(page, "onerror")).toBeVisible(FIRST_RENDER);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.getByRole("row").filter({ hasText: "ЖЖЖЖ" })).toBeVisible();
    await expectNoPageHScroll(page);
  });

  test("в поле поиска можно вводить спецсимволы и гигантскую строку", async ({ page, api }) => {
    await openStocks(page);
    const evil = `<script>window.__xss=1</script>{}&"'`;
    await stocksSearch(page).fill(evil + "Ж".repeat(5_000));
    await expect
      .poll(() => api.calls("warehouseProducts", "GET").at(-1)!.url.searchParams.get("search"))
      .toBe(evil + "Ж".repeat(5_000));
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test("название группы: XSS и пробелы; пустое название не создаёт группу", async ({ page, api }) => {
    await openStocks(page);
    await page.getByTitle("Добавить группу в корень").click();
    await expect(page.getByTitle("Создать", { exact: true })).toBeDisabled();
    await page.getByPlaceholder("Название группы").fill("   ");
    await expect(page.getByTitle("Создать", { exact: true })).toBeDisabled();
    await page.getByPlaceholder("Название группы").fill(`<img src=x onerror="window.__xss=1">`);
    await page.getByTitle("Создать", { exact: true }).click();
    await expect.poll(() => api.calls("groups", "POST").length).toBe(1);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test("«Удалить выбранные»: Escape закрывает окно без удаления", async ({ page, api }) => {
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await page.getByRole("button", { name: "Удалить выбранные" }).click();
    const dlg = page.getByRole("dialog").filter({ hasText: "Подтверждение удаления" });
    await expect(dlg).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    expect(api.calls("bulkDelete")).toHaveLength(0);
    await expect(rowWith(page, "Хлеб")).toBeVisible();
  });

  test("тройной клик по «Удалить» в подтверждении: уходит один DELETE", async ({ page, api }) => {
    api.on("bulkDelete", async (route, { body }, db) => {
      await delay(600);
      const ids = new Set<string>(body?.ids ?? []);
      db.products = db.products.filter((p) => !ids.has(p.id));
      return json(route, { deleted: ids.size });
    });
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await page.getByRole("button", { name: "Удалить выбранные" }).click();
    await page
      .getByRole("dialog")
      .filter({ hasText: "Подтверждение удаления" })
      .getByRole("button", { name: "Удалить" })
      .click({ clickCount: 3 });
    await expect(rowWith(page, "Хлеб")).toHaveCount(0);
    expect(api.calls("bulkDelete", "DELETE")).toHaveLength(1);
  });

  test("выбор товаров сбрасывается при смене поиска", async ({ page }) => {
    // Регрессия (исправлено): выбранные id не сбрасываются при смене поиска/фильтра/группы (только при смене страницы):
    // счётчик «выбрано» включает скрытые строки, а «Удалить выбранные» и «Переместить» действуют на них.
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await stocksSearch(page).fill("Молоко");
    await expect(rowWith(page, "Хлеб")).toHaveCount(0);
    await expect(page.getByText(/выбрано|выбран/)).toHaveCount(0, { timeout: 3_000 });
  });
});

test.describe("2. Защита от дурака: создание товара", () => {
  test("тройной клик по «Создать товар»: создаётся ОДИН товар", async ({ page, api }) => {
    // Регрессия (исправлено): страница вызывает api.post напрямую, а флаг creating берётся из createProductAsync,
    // который не диспатчится: кнопка никогда не disabled и не показывает «Создание...». Каждый клик шлёт свой POST
    // и создаёт дубль товара (и дубль расхода в кассу).
    api.on("warehouseProducts", async (route, { method, body }, db) => {
      if (method !== "POST") return json(route, paginated(db.products));
      await delay(800);
      return json(route, { id: "p-slow", ...body }, 201);
    });
    await openAddProduct(page);
    await fillProduct(page);
    await submitProduct(page).click({ clickCount: 3 });
    await expect(addAlert(page, "Товар успешно добавлен!").first()).toBeVisible({ timeout: 10_000 });
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(1);
  });

  test("пустая форма: сводка «Заполните обязательные поля», подсветка и aria-invalid", async ({ page, api }) => {
    await openAddProduct(page);
    await nameInput(page).fill("");
    await barcodeInput(page).fill("");
    await submitProduct(page).click();

    const dlg = addAlert(page, "Заполните обязательные поля");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("• Наименование");
    await expect(dlg).toContainText("• Штрих-код");
    await expect(dlg).toContainText("• Цена закупки");
    await expect(dlg).toContainText("• Цена продажи");
    await dlg.getByRole("button", { name: "Ok" }).click();

    await expect(nameInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Обязательное поле", { exact: true }).first()).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("без склада: «Обязательное поле.» под выбором склада, запроса нет", async ({ page, api }) => {
    await page.goto("/crm/warehouse/stocks/add-product");
    await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
    await nameInput(page).fill("Товар без склада");
    await submitProduct(page).click();
    await expect(addAlert(page, "Проверьте поля")).toContainText("• Склад");
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("комплект без состава: сообщение о составе в сводке", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: /^Комплект/ }).click();
    await nameInput(page).fill("Пустой набор");
    await addField(page, "Цена продажи", "input").fill("100");
    await submitProduct(page).click();
    await expect(addAlert(page, "Проверьте поля")).toContainText("• Состав комплекта");
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("минимальный остаток: отрицательное значение отклоняется", async ({ page, api }) => {
    await openAddProduct(page);
    await fillProduct(page);
    await addField(page, "Минимальный остаток", "input").fill("-5");
    await submitProduct(page).click();
    await expect(addAlert(page, "Проверьте поля")).toContainText("• Минимальный остаток");
    await expect(page.getByText("Введите число не меньше 0")).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("отрицательная цена закупки не отправляется на сервер", async ({ page, api }) => {
    // Регрессия (исправлено): цены и закупка проверяются только на «не пусто»; «-100» уходит строкой в payload, а цена
    // продажи при отрицательной закупке не считается. Нужна проверка «число ≥ 0» на клиенте, как у «Минимального остатка».
    await openAddProduct(page);
    await fillProduct(page, { purchase: "-100", markup: "0" });
    // Цену продажи пользователь вводит вручную (при отрицательной закупке автоматом она не считается).
    await priceFields(page).sale.fill("50");
    await submitProduct(page).click();
    await expect(addAlert(page, /Проверьте поля|Заполните/)).toBeVisible({ timeout: 3_000 });
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("нечисловая цена и количество не отправляются как «abc» / null", async ({ page, api }) => {
    // Регрессия (исправлено): «abc» в цене уходит строкой, а нечисловое количество превращается в NaN → JSON null.
    await openAddProduct(page);
    await nameInput(page).fill("Нечисловой");
    await priceFields(page).purchase.fill("abc");
    await priceFields(page).sale.fill("xyz");
    await addField(page, "Начальный остаток *", "input").fill("много");
    await submitProduct(page).click();
    await expect(addAlert(page, /Проверьте поля|Заполните/)).toBeVisible({ timeout: 3_000 });
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });

  test("спецсимволы и XSS в названии, описании, артикуле; гигантские строки", async ({ page, api }) => {
    const evil = `<script>window.__xss=1</script><img src=x onerror="window.__xss=2">{}&amp;&"'`;
    await openAddProduct(page);
    await fillProduct(page, { name: evil });
    await addField(page, "Артикул", "input").fill("Х".repeat(5_000));
    await page.getByPlaceholder("Введите описание товара").fill("Ж".repeat(10_000));
    await submitProduct(page).click();
    await expect(addAlert(page, "Товар успешно добавлен!")).toBeVisible();
    const body = api.calls("warehouseProducts", "POST")[0].body;
    expect(body.name).toBe(evil);
    expect(String(body.article)).toHaveLength(5_000);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });

  test("бренд и категория: пустое название не создаёт запись", async ({ page, api }) => {
    await openAddProduct(page);
    await page.getByRole("button", { name: "+ Создать бренд" }).click();
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    expect(api.calls("brands", "POST")).toHaveLength(0);
    await page.getByPlaceholder("Название бренда").fill("   ");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await closeAddAlert(page, "Введите название бренда");
    expect(api.calls("brands", "POST")).toHaveLength(0);
  });

  test("предоплата не может превышать сумму закупки", async ({ page, api }) => {
    await openAddProduct(page);
    await fillProduct(page, { purchase: "100", markup: "0", qty: "2" });
    await addField(page, "Выберите поставщика", "select").selectOption({ label: "ИП Поставщик" });
    await page.getByLabel("Добавить долг по этому товару").check();
    await page.locator("select").filter({ hasText: "Предоплата" }).selectOption({ label: "Предоплата" });
    await addField(page, "Сумма предоплаты", "input").fill("999");
    await addField(page, "Срок долга (мес.)", "input").fill("3");
    await submitProduct(page).click();
    await expect(addAlert(page, "Сумма предоплаты не может превышать общую сумму")).toBeVisible();
    expect(api.calls("warehouseProducts", "POST")).toHaveLength(0);
  });
});

/* ======================================================================
   3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: офисный ноутбук 1366×768
   ====================================================================== */

test.describe("3. Экран 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("склады: поиск, «Создать склад» и таблица на экране, без горизонтального скролла", async ({ page }) => {
    await openWarehouses(page);
    await expect(createWarehouseButton(page)).toBeInViewport();
    await expect(warehouseSearch(page)).toBeInViewport();
    await expect(pageTab(page, "Партнёры")).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("модалка создания склада: «Создать» видна или достижима прокруткой", async ({ page }) => {
    const f = await openCreateWarehouse(page);
    await f.submit.scrollIntoViewIfNeeded();
    await expect(f.submit).toBeInViewport();
    await expect(f.cancel).toBeInViewport();
  });

  test("партнёрства: подвкладки и действия строки на экране", async ({ page }) => {
    await openPartnerships(page);
    await expect(subTab(page, /^Активные/)).toBeInViewport();
    await expect(page.getByRole("button", { name: "Пригласить" })).toBeInViewport();
    const actions = rowWith(page, "ОсОО Партнёр").getByRole("button", { name: "Разорвать" });
    await actions.scrollIntoViewIfNeeded();
    await expect(actions).toBeInViewport();
  });

  test("остатки: поиск, группы и таблица на экране", async ({ page }) => {
    await openStocks(page);
    await expect(stocksSearch(page)).toBeInViewport();
    await expect(page.getByRole("button", { name: "Создать товар" })).toBeInViewport();
    await expectNoPageHScroll(page);
  });

  test("создание товара: «Создать товар» достижима прокруткой, итоговая цена видна", async ({ page }) => {
    await openAddProduct(page);
    await fillProduct(page);
    const submit = submitProduct(page);
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    await expect(priceFields(page).sale).toHaveValue("125.000");
    await expectNoPageHScroll(page);
  });

  test("история продаж: фильтры и таблица на экране, карточка документа достижима", async ({ page }) => {
    await openSales(page);
    await expect(salesSearch(page)).toBeInViewport();
    await expect(page.getByRole("button", { name: "Обновить" })).toBeInViewport();
    await saleRow(page, "S-101").click();
    const dlg = page.getByRole("dialog", { name: "Продажа S-101" });
    await expect(dlg.getByRole("button", { name: "Закрыть" })).toBeInViewport();
    await expectNoPageHScroll(page);
  });
});

/* ======================================================================
   4. СБОИ БЭКЕНДА
   ====================================================================== */

test.describe("4. Сбои бэкенда: отправка форм", () => {
  test("создание склада: 500 → «Ошибка сервера» в баннере, данные на месте, повтор проходит", async ({ page, api }) => {
    let fail = true;
    api.on("warehouses", (route, { method, body }, db) => {
      if (method !== "POST") return json(route, pageOf(db.warehouses, 1, 50));
      if (fail) return json(route, { detail: "Ошибка сервера" }, 500);
      return json(route, { id: "wh-ok", name: body.name, location: body.location }, 201);
    });
    const f = await openCreateWarehouse(page);
    await f.name.fill("Склад сбой");
    await f.address.fill("Адрес сбой");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(f.name).toHaveValue("Склад сбой");
    await expect(f.submit).toBeEnabled();
    await expect(warehousesHeading(page)).toBeVisible();

    fail = false;
    await f.submit.click();
    await expect(f.name).toBeHidden();
  });

  test("создание склада: ошибка поля 400 — под полем и «Проверьте выделенные поля»", async ({ page, api }) => {
    api.on("warehouses", (route, { method }, db) =>
      method === "POST"
        ? json(route, { name: ["Склад с таким названием уже существует"] }, 400)
        : json(route, pageOf(db.warehouses, 1, 50)),
    );
    const f = await openCreateWarehouse(page);
    await f.name.fill("Дубль");
    await f.address.fill("Адрес");
    await f.submit.click();
    await expect(f.modal.getByText("Склад с таким названием уже существует")).toBeVisible();
    await expect(f.modal.getByText("Проверьте выделенные поля")).toBeVisible();
  });

  test("создание склада: пустой объект и HTML-ответ → запасной текст / текст без разметки", async ({ page, api }) => {
    api.on("warehouses", (route, { method }, db) =>
      method === "POST" ? json(route, {}, 500) : json(route, pageOf(db.warehouses, 1, 50)),
    );
    const f = await openCreateWarehouse(page);
    await f.name.fill("Пустая ошибка");
    await f.address.fill("Адрес");
    await f.submit.click();
    await expect(f.modal.getByText("Не удалось создать склад")).toBeVisible();

    api.on("warehouses", (route, { method }, db) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, pageOf(db.warehouses, 1, 50)),
    );
    await f.submit.click();
    await expect(f.modal.getByText(/502 Bad Gateway/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
  });

  test("редактирование склада: 500 → ошибка в баннере, данные формы остаются", async ({ page, api }) => {
    api.on("warehouseItem", (route, { method }, db) =>
      method === "PATCH" ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, db.warehouses[0]),
    );
    await openWarehouses(page);
    await rowWith(page, "Склад №2").getByRole("button", { name: "Редактировать" }).click();
    const f = warehouseForm(page, "Редактировать склад");
    await f.name.fill("Не сохранится");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(f.name).toHaveValue("Не сохранится");
  });

  test("приглашение: 500 → оповещение «Ошибка», модалка приглашения остаётся", async ({ page, api }) => {
    api.on("requests", (route, { method }, db) =>
      method === "POST"
        ? json(route, { detail: "Ошибка сервера" }, 500)
        : json(route, { incoming: db.requestsIn, outgoing: db.requestsOut }),
    );
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await dlg.getByPlaceholder("Минимум 3 символа названия").fill("Нов");
    await rowWithin(dlg, "ОсОО Новая Компания").getByRole("button", { name: "Отправить" }).click();
    const err = appDialog(page, "Ошибка сервера");
    await expect(err.getByRole("heading", { name: "Ошибка" })).toBeVisible();
    await err.getByRole("button", { name: "Ок" }).click();
    await expect(dlg).toBeVisible();
  });

  test("принять заявку: 400 с detail → оповещение, заявка остаётся в списке", async ({ page, api }) => {
    api.on("requestAction", (route) => json(route, { detail: "Заявка уже обработана" }, 400));
    await openPartnerships(page);
    await subTab(page, /^Входящие заявки/).click();
    await rowWith(page, "ОсОО Входящая").getByRole("button", { name: "Принять" }).click();
    await confirmAction(page);
    await closeAlert(page, "Заявка уже обработана");
    await expect(rowWith(page, "ОсОО Входящая")).toBeVisible();
  });

  test("подтверждение операции: 500 → оповещение об ошибке", async ({ page, api }) => {
    api.on("operationAction", (route) => json(route, { detail: "Недостаточно средств" }, 400));
    await openPartnerships(page);
    await subTab(page, /^Запросы на товар и деньги/).click();
    await rowWith(page, "ОсОО Партнёр").filter({ hasText: "Деньги" }).getByRole("button", { name: "Подтвердить" }).click();
    await confirmAction(page);
    await closeAlert(page, "Недостаточно средств");
  });

  test("создание товара: 500 → оповещение «Ошибка», форма и данные на месте", async ({ page, api }) => {
    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST" ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, paginated(db.products)),
    );
    await openAddProduct(page);
    await fillProduct(page, { name: "Товар сбой" });
    await submitProduct(page).click();
    const dlg = addAlert(page, "Ошибка сервера");
    await expect(dlg.getByRole("heading", { name: "Ошибка" })).toBeVisible();
    await dlg.getByRole("button", { name: "Ok" }).click();
    await expect(nameInput(page)).toHaveValue("Товар сбой");
    await expect(addHeading(page)).toBeVisible();
    await expect(page).toHaveURL(/add-product/);
  });

  test("создание товара: ошибка штрих-кода 400 — под полем и в оповещении", async ({ page, api }) => {
    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST"
        ? json(route, { barcode: ["Штрих-код уже существует"] }, 400)
        : json(route, paginated(db.products)),
    );
    await openAddProduct(page);
    await fillProduct(page);
    await submitProduct(page).click();
    await expect(addAlert(page, "Штрих-код уже существует")).toBeVisible();
    await expect(page.getByText("Штрих-код уже существует").first()).toBeVisible();
  });

  test("создание товара: ошибка названия — только под полем, в оповещении запасной текст", async ({ page, api }) => {
    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST"
        ? json(route, { name: ["Товар с таким названием уже есть"] }, 400)
        : json(route, paginated(db.products)),
    );
    await openAddProduct(page);
    await fillProduct(page);
    await submitProduct(page).click();
    await expect(addAlert(page, "Ошибка при добавлении товара")).toBeVisible();
    await expect(page.getByText("Товар с таким названием уже есть")).toBeVisible();
  });

  test("создание товара: пустое тело 500 и HTML 502 — страница жива", async ({ page, api }) => {
    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST" ? json(route, {}, 500) : json(route, paginated(db.products)),
    );
    await openAddProduct(page);
    await fillProduct(page);
    await submitProduct(page).click();
    await closeAddAlert(page, "Ошибка при добавлении товара");

    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST"
        ? route.fulfill({ status: 502, contentType: "text/html", body: "<h1>502 Bad Gateway</h1>" })
        : json(route, paginated(db.products)),
    );
    await submitProduct(page).click();
    await expect(addAlert(page, /502 Bad Gateway/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "502 Bad Gateway" })).toHaveCount(0);
  });

  test("создание товара: обрыв сети — оповещение, форма жива", async ({ page, api }) => {
    api.on("warehouseProducts", (route, { method }, db) =>
      method === "POST" ? route.abort("internetdisconnected") : json(route, paginated(db.products)),
    );
    await openAddProduct(page);
    await fillProduct(page);
    await submitProduct(page).click();
    await expect(addAlert(page, /Network Error|Ошибка/)).toBeVisible();
    await expect(addHeading(page)).toBeVisible();
  });

  test("создание бренда: 500 → оповещение, список брендов не ломается", async ({ page, api }) => {
    api.on("brands", (route, { method }, db) =>
      method === "POST" ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, paginated(db.brands)),
    );
    await openAddProduct(page);
    await page.getByRole("button", { name: "+ Создать бренд" }).click();
    await page.getByPlaceholder("Название бренда").fill("Сбойный");
    await page.getByRole("button", { name: "Создать", exact: true }).click();
    await expect(addAlert(page, /Ошибка при создании бренда/)).toBeVisible();
  });
});

test.describe("4. Сбои бэкенда: null и пустые ответы на GET", () => {
  test("склады: список null → «Склады не найдены», страница жива", async ({ page, api }) => {
    api.on("warehouses", (route) => json(route, null));
    await page.goto(URLS.warehouses);
    await expect(warehousesHeading(page)).toBeVisible(FIRST_RENDER);
    await expect(page.getByText("Склады не найдены")).toBeVisible();
    await expect(createWarehouseButton(page)).toBeEnabled();
    await expectNoRenderGarbage(page);
  });

  test("склады: results = null и 500 → «Склады не найдены» (сообщения об ошибке нет)", async ({ page, api }) => {
    // Замечание: ошибка списка складов в UI не выводится — пользователь видит пустое состояние.
    api.on("warehouses", (route) => json(route, { count: 5, results: null }));
    await page.goto(URLS.warehouses);
    await expect(page.getByText("Склады не найдены")).toBeVisible(FIRST_RENDER);
    api.on("warehouses", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await warehouseSearch(page).fill("x");
    await expect(page.getByText("Склады не найдены")).toBeVisible();
  });

  test("склады: у записи null вместо названия, адреса и счётчика", async ({ page, api }) => {
    api.db.warehouses = [{ id: "n-1", name: null as unknown as string, location: undefined, products_count: undefined }];
    await page.goto(URLS.warehouses);
    await expect(page.getByText("Всего: 1 • Найдено: 1")).toBeVisible(FIRST_RENDER);
    await expectNoRenderGarbage(page);
  });

  test("партнёрства: все списки null/пустые — «Нет активных партнёров», страница жива", async ({ page, api }) => {
    api.on("partners", (route) => json(route, { partners: null }));
    api.on("requests", (route) => json(route, { incoming: null, outgoing: null }));
    api.on("operations", (route) => json(route, { incoming: null, outgoing: null }));
    await page.goto(URLS.partnerships);
    await expect(page.getByText(/Нет активных партнёров/)).toBeVisible(FIRST_RENDER);
    await subTab(page, /^Входящие заявки/).click();
    await expect(page.getByText("Нет входящих заявок")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("партнёрства: 500 на списке партнёров → баннер ошибки над таблицей", async ({ page, api }) => {
    api.on("partners", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.partnerships);
    await expect(page.getByText("Ошибка сервера")).toBeVisible(FIRST_RENDER);
    await expect(subTab(page, "Исходящие заявки")).toBeVisible();
  });

  test("партнёрства: операции недоступны (404 HTML) → вкладка «Запросы на товар и деньги» скрыта", async ({ page, api }) => {
    api.db.operationsEnabled = false;
    await openPartnerships(page);
    await expect(subTab(page, /^Запросы на товар и деньги/)).toHaveCount(0);
    await expect(subTab(page, /^Входящие заявки/)).toBeVisible();
  });

  test("партнёрства: поиск компаний null — «Ничего не найдено», приглашение не падает", async ({ page, api }) => {
    api.on("companySearch", (route) => json(route, null));
    await openPartnerships(page);
    await page.getByRole("button", { name: "Пригласить" }).click();
    const dlg = page.getByRole("dialog", { name: "Заявка на партнёрство" });
    await dlg.getByPlaceholder("Минимум 3 символа названия").fill("Нов");
    await expect(dlg.getByText("Ничего не найдено")).toBeVisible();
  });

  test("остатки: список товаров null → страница жива", async ({ page, api }) => {
    api.on("warehouseProducts", (route) => json(route, { count: 0, next: null, previous: null, results: null }));
    api.on("groups", (route) => json(route, null));
    await page.goto(URLS.stocks);
    await expect(stocksHeading(page)).toBeVisible(FIRST_RENDER);
    await expect(page.getByText("Групп нет")).toBeVisible();
    await expect(page.getByText("Товары не найдены")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("остатки: 500 на группах → «Не удалось загрузить/изменить группы», таблица работает", async ({ page, api }) => {
    api.on("groups", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await page.goto(URLS.stocks);
    await expect(page.getByText("Не удалось загрузить/изменить группы")).toBeVisible(FIRST_RENDER);
    await expect(rowWith(page, "Молоко 1л")).toBeVisible();
  });

  test("остатки: неизвестный склад — название по умолчанию, страница не падает", async ({ page, api }) => {
    api.db.warehouses = [];
    await page.goto("/crm/warehouse/stocks/unknown-id");
    await expect(page.getByRole("heading", { level: 1, name: "Товары склада" })).toBeVisible(FIRST_RENDER);
    await expect(page.getByText("Управление товарами на складе")).toBeVisible();
  });

  test("остатки: удаление группы 500 → оповещение «Ошибка», группа остаётся", async ({ page, api }) => {
    api.on("groupItem", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openStocks(page);
    await groupRow(page, "Напитки").getByTitle("Удалить группу").click();
    await confirmAction(page);
    await closeAlert(page, "Ошибка сервера");
    await expect(groupRow(page, "Напитки")).toBeVisible();
  });

  test("остатки: массовое удаление 500 → оповещение, товары остаются", async ({ page, api }) => {
    api.on("bulkDelete", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await page.getByRole("button", { name: "Удалить выбранные" }).click();
    await page
      .getByRole("dialog")
      .filter({ hasText: "Подтверждение удаления" })
      .getByRole("button", { name: "Удалить" })
      .click();
    await closeAlert(page, "Ошибка сервера");
    await expect(rowWith(page, "Хлеб")).toBeVisible();
  });

  test("остатки: перемещение 500 → оповещение «Не удалось переместить товар в группу.»", async ({ page, api }) => {
    api.on("productItem", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openStocks(page);
    await productCheckbox(page, "Хлеб").check();
    await page
      .locator("div")
      .filter({ has: page.getByText("Переместить в", { exact: true }) })
      .last()
      .locator("select")
      .selectOption({ label: "Напитки" });
    await page.getByRole("button", { name: /^Переместить \(\d+\)$/ }).click();
    await closeAlert(page, "Не удалось переместить товар в группу.");
  });

  test("создание товара: товары склада null не вызывают необработанных исключений", async ({ page, api }) => {
    // Регрессия (исправлено): productSlice.fetchProductsAsync.fulfilled делает action.payload.results без проверки, и null-ответ
    // списка товаров даёт необработанное исключение «Cannot read properties of null (reading 'results')».
    api.on("warehouseProducts", (route) => json(route, null));
    await page.goto(URLS.addProduct);
    await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
  });

  test("создание товара: списки складов и групп null — форма открывается", async ({ page, api }) => {
    api.on("warehouses", (route) => json(route, null));
    api.on("groups", (route) => json(route, null));
    await page.goto(URLS.addProduct);
    await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
    await expect(addField(page, "Склад *", "select").locator("option")).toHaveCount(1);
    await expectNoRenderGarbage(page);
  });

  test("создание товара: бренды и категории null не вызывают необработанных исключений", async ({ page, api }) => {
    // Регрессия (исправлено): редьюсеры брендов/категорий делают action.payload.results без проверки, и null-ответ даёт
    // необработанное исключение «Cannot read properties of null (reading 'results')».
    api.on("brands", (route) => json(route, null));
    api.on("warehouseCategories", (route) => json(route, null));
    await page.goto(URLS.addProduct);
    await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
  });

  test("создание товара: неизвестный warehouse_id не подставляется в выбор склада", async ({ page }) => {
    await page.goto("/crm/warehouse/stocks/add-product?warehouse_id=unknown-wh");
    await expect(addHeading(page)).toBeVisible(FIRST_RENDER);
    await expect(addField(page, "Склад *", "select")).not.toHaveValue("unknown-wh");
  });

  test("история продаж: null вместо ответа и results = null → «Нет продаж», страница жива", async ({ page, api }) => {
    api.on("partnerSales", (route) => json(route, null));
    await page.goto(URLS.sales);
    await expect(salesHeading(page, "Партнёр")).toBeVisible(FIRST_RENDER);
    await expect(page.getByText("Нет продаж за выбранный период.")).toBeVisible();

    api.on("partnerSales", (route) => json(route, { count: 7, results: null, summary: null }));
    await page.getByRole("button", { name: "Обновить" }).click();
    await expect(page.getByText("Нет продаж за выбранный период.")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("история продаж: 403 «Партнёр скрыл историю продаж» показывается, фильтры остаются", async ({ page, api }) => {
    api.on("partnerSales", (route) =>
      json(route, { detail: "Партнёр скрыл историю продаж.", code: "sales_history_hidden" }, 403),
    );
    await page.goto(URLS.sales);
    await expect(page.getByText("Партнёр скрыл историю продаж.", { exact: true })).toBeVisible(FIRST_RENDER);
    await expect(salesTab(page, "Тип документов", "Возвраты")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Документ / })).toHaveCount(0);
  });

  test("история продаж: эндпоинт не поддерживается (404 HTML) → заглушка со ссылкой на аналитику", async ({ page, api }) => {
    api.on("partnerSales", (route) =>
      route.fulfill({ status: 404, contentType: "text/html", body: "<h1>Not Found</h1>" }),
    );
    await page.goto(URLS.sales);
    await expect(page.getByText(/История продаж партнёра станет доступна после обновления сервера/)).toBeVisible(
      FIRST_RENDER,
    );
    await expect(page.getByRole("link", { name: "аналитике партнёра", exact: true })).toBeVisible();
    await expect(salesSearch(page)).toHaveCount(0);
  });

  test("история продаж: 500 и обрыв сети → сообщение, «Обновить» восстанавливает", async ({ page, api }) => {
    let fail = true;
    api.on("partnerSales", (route, _c, db) =>
      fail ? json(route, { detail: "Ошибка сервера" }, 500) : json(route, { ...pageOf(db.sales.filter((s) => s.doc_type === "SALE"), 1, 50), summary: { count: 2, amount: 2200 } }),
    );
    await page.goto(URLS.sales);
    await expect(page.getByText("Ошибка сервера")).toBeVisible(FIRST_RENDER);
    fail = false;
    await page.getByRole("button", { name: "Обновить" }).click();
    await expect(saleRow(page, "S-101")).toBeVisible();
    await expect(page.getByText("Ошибка сервера")).toBeHidden();
  });

  test("история продаж: детали документа 404 → ошибка в карточке, список жив", async ({ page, api }) => {
    api.on("partnerSale", (route) => json(route, { detail: "Документ не найден" }, 404));
    await openSales(page);
    await saleRow(page, "S-101").click();
    const dlg = page.getByRole("dialog", { name: "Продажа S-101" });
    await expect(dlg.getByText("Документ не найден")).toBeVisible();
    await dlg.getByRole("button", { name: "Закрыть" }).click();
    await expect(saleRow(page, "S-102")).toBeVisible();
  });

  test("история продаж: быстрая смена фильтров — побеждает последний выбор, а не самый медленный ответ", async ({ page, api }) => {
    // Регрессия (исправлено): load() без отмены (useLatestRequest рядом есть, но не подключён). Ответ на «Возвраты» приходит
    // позже ответа на «Продажи» и затирает таблицу: выбран таб «Продажи», а строки — возвраты.
    await openSales(page);
    api.on("partnerSales", async (route, { url }, db) => {
      const type = url.searchParams.get("doc_type") ?? "SALE";
      if (type === "SALE_RETURN") await delay(1500);
      const list = db.sales.filter((s) => s.doc_type === type);
      return json(route, { ...pageOf(list, 1, 50), summary: { count: list.length, amount: 0 } });
    });
    await salesTab(page, "Тип документов", "Возвраты").click();
    await salesTab(page, "Тип документов", "Продажи").click();
    await page.waitForTimeout(2_200);
    await expect(salesTab(page, "Тип документов", "Продажи")).toHaveAttribute("aria-selected", "true");
    await expect(saleRow(page, "S-101")).toBeVisible();
    await expect(saleRow(page, "R-001")).toHaveCount(0);
  });
});

/* ======================================================================
   Часовой пояс Asia/Bishkek (UTC+6 — основной рынок продукта)
   ====================================================================== */

test.describe("Часовой пояс Asia/Bishkek", () => {
  test.use({ timezoneId: "Asia/Bishkek" });

  test("история продаж: даты в таблице — локальное время; 23:30 UTC — уже следующий день", async ({ page, api }) => {
    api.db.sales = [
      makeSale(1, { date: "2026-10-01T10:30:00+06:00", status: "POSTED" }),
      makeSale(2, { date: "2026-10-01T23:30:00Z", status: "POSTED" }),
    ];
    await page.goto(URLS.sales);
    await expect(saleRow(page, "S-101")).toContainText(/01\.10\.2026,?\s*10:30/, FIRST_RENDER);
    await expect(saleRow(page, "S-102")).toContainText(/02\.10\.2026,?\s*05:30/);
  });

  test("партнёрства: дата «Партнёр с» и даты заявок — по локальному календарю", async ({ page, api }) => {
    api.db.partners = [{ ...PARTNERS[0], since: "2026-09-30T20:00:00Z" }]; // 01.10 02:00 в Бишкеке
    await page.goto(URLS.partnerships);
    await expect(rowWith(page, "ОсОО Партнёр")).toContainText("01.10.2026", FIRST_RENDER);
  });
});

/* ======================================================================
   5. СТРЕСС И ПРОИЗВОДИТЕЛЬНОСТЬ
   ====================================================================== */

test.describe("5. Стресс и производительность", () => {
  test.slow();

  test("Big Data: 3000 складов — серверная пагинация, поиск и переходы отзывчивы", async ({ page, api }) => {
    test.setTimeout(perfBudget(90_000));
    await openWarehouses(page); // прогрев чанков Vite
    api.db.warehouses = Array.from({ length: 3000 }, (_, i) => ({
      id: `bulk-${i + 1}`,
      name: `Склад нагрузка ${i + 1}`,
      location: `Адрес ${i + 1}`,
      products_count: i,
    }));
    const t0 = Date.now();
    await page.reload();
    await expect(page.getByText("Страница 1 из 60 (3000 складов)")).toBeVisible({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 3000 warehouses, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(15_000));
    await expect(page.getByRole("row").filter({ hasText: /Склад нагрузка/ })).toHaveCount(50);

    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 60 (3000 складов)")).toBeVisible();
    await warehouseSearch(page).fill("нагрузка 2999");
    await expect(rowWith(page, "Склад нагрузка 2999")).toBeVisible({ timeout: perfBudget(15_000) });
  });

  test("Big Data: 3000 товаров на складе — пагинация, поиск и выбор строк отзывчивы", async ({ page, api }) => {
    test.setTimeout(perfBudget(90_000));
    await openStocks(page);
    api.db.products = Array.from({ length: 3000 }, (_, i) => ({
      id: `bp-${i + 1}`,
      name: `Товар нагрузка ${String(i + 1).padStart(4, "0")}`,
      price: String(10 + i),
      quantity: String(i),
      unit: "шт",
      kind: "product",
    }));
    const t0 = Date.now();
    await page.reload();
    await expect(page.getByText(/Страница 1 из 60/)).toBeVisible({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 3000 products, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(15_000));
    await expect(page.getByRole("row").filter({ hasText: /Товар нагрузка/ })).toHaveCount(50);

    // Выбор всех строк страницы и сброс.
    await page.getByRole("row").first().getByRole("checkbox").check();
    await expect(page.getByText(/50\s*товаров выбрано/)).toBeVisible({ timeout: perfBudget(10_000) });
    await page.getByRole("button", { name: "Сбросить" }).first().click();

    await stocksSearch(page).fill("Товар нагрузка 2999");
    await expect(page.getByRole("row").filter({ hasText: /Товар нагрузка/ }).first()).toBeVisible({
      timeout: perfBudget(15_000),
    });
  });

  test("Big Data: 3000 продаж партнёра — страницы по 50, смена типа и статуса отзывчивы", async ({ page, api }) => {
    test.setTimeout(perfBudget(90_000));
    await openSales(page);
    api.db.sales = Array.from({ length: 3000 }, (_, i) => makeSale(i + 1, { status: "POSTED" }));
    const t0 = Date.now();
    await page.reload();
    await expect(page.getByText("Страница 1 из 60 (3000 документов)")).toBeVisible({ timeout: perfBudget(30_000) });
    const renderMs = Date.now() - t0;
    test.info().annotations.push({ type: "render 3000 sales, ms", description: String(renderMs) });
    expect(renderMs).toBeLessThan(perfBudget(15_000));
    await expect(page.getByRole("button", { name: /^Документ / })).toHaveCount(50);
    await page.getByRole("button", { name: "Вперед" }).click();
    await expect(page.getByText("Страница 2 из 60 (3000 документов)")).toBeVisible();
    await salesTab(page, "Статус", "Проведённые").click();
    await expect(page.getByText("Страница 1 из 60 (3000 документов)")).toBeVisible();
  });

  test("Big Data: 5000 товаров в справочнике комплекта — поиск показывает не больше 10 и не тормозит", async ({
    page,
    api,
  }) => {
    test.setTimeout(perfBudget(90_000));
    api.db.products = Array.from({ length: 5000 }, (_, i) => ({
      id: `kit-${i + 1}`,
      name: `Компонент ${i + 1}`,
      price: "10",
      purchase_price: "5",
      unit: "шт",
      quantity: "1",
    }));
    const t0 = Date.now();
    await openAddProduct(page);
    const loadMs = Date.now() - t0;
    test.info().annotations.push({ type: "add-product with 5000 products, ms", description: String(loadMs) });
    expect(loadMs).toBeLessThan(perfBudget(25_000));

    await page.getByRole("button", { name: /^Комплект/ }).click();
    await page.getByPlaceholder("поиск...").fill("Компонент 49");
    await expect(page.getByText(/^Компонент 49/).first()).toBeVisible({ timeout: perfBudget(10_000) });
    const shown = await page.getByText(/^Компонент 49/).count();
    expect(shown).toBeLessThanOrEqual(10);
    // Форма остаётся отзывчивой: цена считается мгновенно.
    await page.getByRole("button", { name: /^Товар/ }).first().click();
    await priceFields(page).purchase.fill("100");
    await priceFields(page).markup.fill("25");
    await expect(priceFields(page).sale).toHaveValue("125.000", { timeout: perfBudget(5_000) });
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

  test("CPU ×6 (CDP): форма товара — расчёт цены, переключение типов, выбор страны без лагов", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    await openAddProduct(page); // прогрев без замедления
    const cdp = await throttleCpu(page, 6);

    const p = priceFields(page);
    const calcMs = await measure(
      async () => {
        await p.purchase.fill("100");
        await p.markup.fill("25");
      },
      () => expect(p.sale).toHaveValue("125.000"),
    );
    const typeMs = await measure(
      () => page.getByRole("button", { name: /^Услуга/ }).click(),
      () => expect(addField(page, "Цена продажи", "input")).toBeVisible(),
    );
    await page.getByRole("button", { name: /^Товар/ }).first().click();
    const countryMs = await measure(
      () => page.getByText("Выберите страну").click(),
      () => expect(page.getByPlaceholder("Поиск страны...")).toBeVisible(),
    );
    await page.getByPlaceholder("Поиск страны...").fill("Рос");
    await expect(page.getByText("Россия", { exact: true })).toBeVisible();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 add-product, ms",
      description: JSON.stringify({ calcMs, typeMs, countryMs }),
    });
    expect(calcMs).toBeLessThan(perfBudget(4_000));
    expect(typeMs).toBeLessThan(perfBudget(3_000));
    expect(countryMs).toBeLessThan(perfBudget(3_000));
  });

  test("CPU ×6 (CDP): остатки на 1000 товаров — группы, выбор строк и модалка удаления", async ({
    page,
    api,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    await openStocks(page); // прогрев
    api.db.products = Array.from({ length: 1000 }, (_, i) => ({
      id: `bp-${i + 1}`,
      name: `Товар нагрузка ${String(i + 1).padStart(4, "0")}`,
      price: "10",
      quantity: "1",
      unit: "шт",
      kind: "product",
    }));
    await page.reload();
    await expect(page.getByText(/Страница 1 из 20/)).toBeVisible({ timeout: perfBudget(30_000) });

    const cdp = await throttleCpu(page, 6);
    const selectMs = await measure(
      () => page.getByRole("row").first().getByRole("checkbox").check(),
      () => expect(page.getByText(/50\s*товаров выбрано/)).toBeVisible(),
    );
    const modalMs = await measure(
      () => page.getByRole("button", { name: "Удалить выбранные" }).click(),
      () => expect(page.getByRole("dialog").filter({ hasText: "Подтверждение удаления" })).toBeVisible(),
    );
    await page.keyboard.press("Escape");
    const pagerMs = await measure(
      () => page.getByRole("button", { name: "Вперед" }).click(),
      () => expect(page.getByText(/Страница 2 из 20/)).toBeVisible(),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({
      type: "CPU x6 stocks, ms",
      description: JSON.stringify({ selectMs, modalMs, pagerMs }),
    });
    expect(selectMs).toBeLessThan(perfBudget(4_000));
    expect(modalMs).toBeLessThan(perfBudget(3_000));
    expect(pagerMs).toBeLessThan(perfBudget(4_000));
  });

  test("CPU ×6 (CDP): история продаж и партнёрства — модалка документа и переключение вкладок", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "CDP доступен только в Chromium");
    test.setTimeout(perfBudget(120_000));
    await openSales(page); // прогрев
    const cdp = await throttleCpu(page, 6);
    const modalMs = await measure(
      () => saleRow(page, "S-101").click(),
      () => expect(page.getByRole("dialog", { name: "Продажа S-101" })).toBeVisible(),
    );
    await page.getByRole("dialog", { name: "Продажа S-101" }).getByRole("button", { name: "Закрыть" }).click();
    const tabMs = await measure(
      () => salesTab(page, "Тип документов", "Возвраты").click(),
      () => expect(saleRow(page, "R-001")).toBeVisible(),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    test.info().annotations.push({ type: "CPU x6 sales, ms", description: JSON.stringify({ modalMs, tabMs }) });
    expect(modalMs).toBeLessThan(perfBudget(4_000));
    expect(tabMs).toBeLessThan(perfBudget(4_000));
  });
});
