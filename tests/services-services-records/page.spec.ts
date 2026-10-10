/**
 * E2E: сектор «Услуги» — каталог услуг и журнал записей.
 *
 *   /crm/services/services   каталог (Barber/Services/Services.jsx): вкладки «Услуги / Категории», поиск (debounce 400 мс),
 *                            панель «Фильтры» (категория, сортировка), таблица / карточки, пагинация,
 *                            ServiceModal (POST/PATCH/DELETE barbershop/services/), CategoryModal (barbershop/service-categories/);
 *   /crm/services/records    журнал записей (Barber/Recorda/Recorda.jsx): итог за день, список / календарь, фильтры
 *                            (мастер, статус), RecordaModal — пошаговый мастер «Когда → Клиент → Мастер → Услуги»
 *                            (POST/PATCH barbershop/appointments/), «Клиент пришёл» (walk-in), скидка и цена.
 *
 * Как пункты общего чек-листа легли на эти страницы:
 *   «форма + отправка»   → создание услуги, категории, записи (booking и walk-in);
 *   «расчёты»            → «Итого» в сводке записи: сумма услуг, скидка %, ручная цена; «Итого за день» в журнале;
 *   «тройной клик»       → «Сохранить» в ServiceModal и «Сохранить запись» в RecordaModal;
 *   «POST/PUT 500»       → 500 / обрыв сети на создании, правке, удалении услуги и на создании записи;
 *   «GET → null»         → null вместо списков услуг, категорий, сотрудников, клиентов и записей;
 *   «Big Data и CPU»     → 3 000 услуг и 2 000 записей за день, CPU ×4 (только chromium, через CDP).
 *
 * Чего на этих страницах НЕТ (поэтому в наборе этого нет):
 *   toast-уведомлений и window.alert — вся обратная связь inline (красный блок внутри модалки / над списком);
 *   подтверждения закрытия «несохранённой формы»; автосохранения черновика.
 *
 * Бэкенд замокан ПОЛНОСТЬЮ (page.route на любой /api/** + routeWebSocket): по умолчанию фронт ходит на
 * боевой https://app.nurcrm.kg/api, и тесты не должны ни читать, ни менять продовые данные.
 * Мок хранит состояние: созданная услуга появляется в выдаче, PATCH меняет её, DELETE убирает.
 * Время страницы «Записи» зафиксировано (12.10.2026 10:00, Asia/Bishkek), иначе слоты и «сегодня» плавают.
 *
 * Запуск (dev-сервер на порту 3100 Playwright поднимет сам, см. webServer в playwright.config.js):
 *   npx playwright test tests/services-services-records --project=chromium
 * Замеры раздела 5 честнее в одиночку:
 *   npx playwright test tests/services-services-records -g "5. Стресс" --workers=1 --project=chromium
 * Тесты, помеченные knownDefect(), по умолчанию ОЖИДАЕМО падают (test.fail); увидеть причину:
 *   E2E_SHOW_DEFECTS=1 npx playwright test tests/services-services-records --project=chromium
 */
import {
  test as base,
  expect as baseExpect,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

// 10 с вместо 5: при полном прогоне в нескольких браузерах рядом идут стресс-тесты раздела 5.
const expect = baseExpect.configure({ timeout: 10_000 });

// Часовой пояс и локаль: форматы чисел («1 500 сом») и дат не должны зависеть от машины разработчика.
base.use({ locale: "ru-RU", timezoneId: "Asia/Bishkek" });

/* ======================================================================
   Тестовые данные
   ====================================================================== */

const URLS = {
  services: "/crm/services/services",
  records: "/crm/services/records",
};

/** «Сегодня» на странице записей (см. page.clock.setFixedTime в openRecords). */
const NOW_ISO = "2026-10-12T10:00:00+06:00";
const TODAY = "2026-10-12";

// Эндпоинты матчим только по ПУТИ, начинающемуся с /api/ — иначе зацепим исходники Vite
// вроде http://localhost:3100/src/api/barberAppointments.js.
const apiPath = (path: string): RegExp =>
  new RegExp(`^https?://[^/]+/api/${path}(\\?.*)?$`);

const API_ANY = /^https?:\/\/[^/]+\/api\//;
const ENDPOINTS = {
  profile: apiPath("users/profile/"),
  company: apiPath("users/company/"),
  employees: apiPath("users/employees/"),
  clients: apiPath("barbershop/clients/"),
  services: apiPath("barbershop/services/"),
  serviceItem: apiPath("barbershop/services/[^/?]+/"),
  categories: apiPath("barbershop/service-categories/"),
  categoryItem: apiPath("barbershop/service-categories/[^/?]+/"),
  appointments: apiPath("barbershop/appointments/"),
  appointmentItem: apiPath("barbershop/appointments/[^/?]+/"),
} as const;
type Endpoint = keyof typeof ENDPOINTS;

interface ServiceRow {
  id: string;
  name: string;
  price: string | number | null;
  time: string | null;
  category: string | null;
  category_name: string;
  is_active: boolean;
  barbers: string[];
  barbers_detail: { id: string; full_name: string }[];
  created_at: string;
}
interface CategoryRow {
  id: string;
  name: string;
  is_active: boolean;
}
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}
interface ClientRow {
  id: string;
  full_name: string;
  phone: string;
  status: string;
}
interface Appointment {
  id: string;
  client: string | null;
  client_name?: string;
  barber: string | null;
  services: string[] | null;
  services_names?: string[];
  start_at: string;
  end_at: string;
  status: string;
  price: number | string | null;
  discount?: number | null;
  comment?: string | null;
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

// Название сектора «Услуги» → slug `services` (utils/sectorMapping.js), меню и маршруты /crm/services/*.
const COMPANY = {
  id: "e2e-company",
  name: "E2E Company",
  end_date: futureDate(),
  sector: { id: "s-services", name: "Услуги" },
  industry: { id: "i-services", name: "Услуги" },
  subscription_plan: { id: "p-pro", name: "Про" },
};

const EMPLOYEES: Employee[] = [
  { id: "emp-1", first_name: "Иван", last_name: "Иванов", email: "ivan@e2e.test" },
  { id: "emp-2", first_name: "Пётр", last_name: "Петров", email: "petr@e2e.test" },
];
const EMP_DETAIL = (id: string) => {
  const e = EMPLOYEES.find((x) => x.id === id)!;
  return { id, full_name: `${e.last_name} ${e.first_name}` };
};

const CATEGORIES: CategoryRow[] = [
  { id: "cat-1", name: "Парикмахерские", is_active: true },
  { id: "cat-2", name: "Окрашивание", is_active: true },
];

const CLIENTS: ClientRow[] = [
  { id: "cl-1", full_name: "Асанов Азамат", phone: "+996555111222", status: "active" },
  { id: "cl-2", full_name: "Бекова Айгуль", phone: "+996555333444", status: "active" },
];

const makeService = (
  i: number,
  name: string,
  price: number | string | null,
  time: string | null,
  category: string | null,
  barbers: string[] = ["emp-1", "emp-2"],
  isActive = true,
): ServiceRow => ({
  id: `svc-${i}`,
  name,
  price,
  time,
  category,
  category_name: CATEGORIES.find((c) => c.id === category)?.name ?? "",
  is_active: isActive,
  barbers,
  barbers_detail: barbers.map(EMP_DETAIL),
  // Чем больше i, тем новее: сортировка по умолчанию «Новые» (-created_at) покажет большие i первыми.
  created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
});

const defaultServices = (): ServiceRow[] => [
  makeService(1, "Стрижка", 500, "30", "cat-1"),
  makeService(2, "Борода", 300, "20", "cat-1"),
  makeService(3, "Окрашивание", 1500, "90", "cat-2", ["emp-1"]),
  makeService(4, "Консультация", 200, "15", null),
  makeService(5, "Архивная услуга", 100, "10", null, ["emp-1"], false),
];

const defaultAppointments = (): Appointment[] => [
  {
    id: "ap-1",
    client: "cl-1",
    client_name: "Асанов Азамат",
    barber: "emp-1",
    services: ["svc-1"],
    services_names: ["Стрижка"],
    start_at: `${TODAY}T12:00:00+06:00`,
    end_at: `${TODAY}T12:30:00+06:00`,
    status: "booked",
    price: 500,
  },
  {
    id: "ap-2",
    client: "cl-2",
    client_name: "Бекова Айгуль",
    barber: "emp-2",
    services: ["svc-3"],
    services_names: ["Окрашивание"],
    start_at: `${TODAY}T14:00:00+06:00`,
    end_at: `${TODAY}T15:30:00+06:00`,
    status: "confirmed",
    price: 800,
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
interface Db {
  services: ServiceRow[];
  categories: CategoryRow[];
  appointments: Appointment[];
  clients: ClientRow[];
  employees: Employee[];
}
type Handler = (route: Route, call: Call, db: Db) => unknown;
interface Api {
  db: Db;
  /** Подменить обработчик эндпоинта целиком. */
  on(name: Endpoint, handler: Handler): void;
  /** Подменить обработчик только для одного HTTP-метода, остальные идут по-старому. */
  intercept(name: Endpoint, method: string, handler: Handler): void;
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

const lastSegment = (url: URL): string => url.pathname.split("/").filter(Boolean).at(-1) ?? "";

/** DRF-подобная пагинация: page / page_size (по умолчанию 20). */
function paginate<T>(list: T[], url: URL) {
  const size = Number(url.searchParams.get("page_size") ?? 20) || 20;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const slice = list.slice((page - 1) * size, page * size);
  const link = (p: number) => {
    const u = new URL(url.toString());
    u.searchParams.set("page", String(p));
    return u.toString();
  };
  return {
    count: list.length,
    next: page * size < list.length ? link(page + 1) : null,
    previous: page > 1 ? link(page - 1) : null,
    results: slice,
  };
}

function orderServices(list: ServiceRow[], ordering: string | null): ServiceRow[] {
  const out = [...list];
  const by = (key: "name" | "price" | "created_at", dir: 1 | -1) =>
    out.sort((a, b) => {
      const av = key === "price" ? Number(a.price) : String(a[key]);
      const bv = key === "price" ? Number(b.price) : String(b[key]);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  switch (ordering) {
    case "name":
      return by("name", 1);
    case "-name":
      return by("name", -1);
    case "price":
      return by("price", 1);
    case "-price":
      return by("price", -1);
    case "created_at":
      return by("created_at", 1);
    case "-created_at":
      return by("created_at", -1);
    default:
      return out;
  }
}

async function mockBackend(page: Page): Promise<Api> {
  const db: Db = {
    services: defaultServices(),
    categories: CATEGORIES.map((c) => ({ ...c })),
    appointments: defaultAppointments(),
    clients: CLIENTS.map((c) => ({ ...c })),
    employees: EMPLOYEES.map((e) => ({ ...e })),
  };
  const log = {} as Record<Endpoint, Call[]>;
  let seq = 0;

  const enrichService = (s: ServiceRow): ServiceRow => {
    s.category_name = db.categories.find((c) => c.id === s.category)?.name ?? "";
    s.barbers_detail = (s.barbers ?? []).map(EMP_DETAIL);
    return s;
  };

  const handlers: Record<Endpoint, Handler> = {
    profile: (route) => json(route, PROFILE),
    company: (route) => json(route, COMPANY),
    employees: (route, _c, state) => json(route, paginated(state.employees)),
    clients: (route, _c, state) => json(route, paginated(state.clients)),

    services: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created = enrichService({
          id: `svc-new-${seq}`,
          name: body.name,
          price: body.price,
          time: body.time,
          category: body.category ?? null,
          is_active: body.is_active !== false,
          barbers: body.barbers ?? [],
          barbers_detail: [],
          category_name: "",
          created_at: new Date(Date.UTC(2027, 0, 1, 0, 0, seq)).toISOString(),
        });
        state.services.unshift(created);
        return json(route, created, 201);
      }
      let list = [...state.services];
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      if (q) list = list.filter((s) => s.name.toLowerCase().includes(q));
      const cat = url.searchParams.get("category");
      if (cat) list = list.filter((s) => s.category === cat);
      if (url.searchParams.get("is_active") === "true") list = list.filter((s) => s.is_active);
      list = orderServices(list, url.searchParams.get("ordering"));
      return json(route, paginate(list, url));
    },
    serviceItem: (route, { method, url, body }, state) => {
      const id = lastSegment(url);
      const found = state.services.find((s) => s.id === id);
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "DELETE") {
        state.services = state.services.filter((s) => s.id !== id);
        return route.fulfill({ status: 204 });
      }
      if (method === "PATCH" || method === "PUT") {
        Object.assign(found, body);
        enrichService(found);
      }
      return json(route, found);
    },

    categories: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: CategoryRow = { id: `cat-new-${seq}`, name: body.name, is_active: body.is_active !== false };
        state.categories.push(created);
        return json(route, created, 201);
      }
      let list = [...state.categories];
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
      list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      if (url.searchParams.get("ordering") === "-name") list.reverse();
      return json(route, paginate(list, url));
    },
    categoryItem: (route, { method, url, body }, state) => {
      const id = lastSegment(url);
      const found = state.categories.find((c) => c.id === id);
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "DELETE") {
        state.categories = state.categories.filter((c) => c.id !== id);
        return route.fulfill({ status: 204 });
      }
      if (method === "PATCH" || method === "PUT") Object.assign(found, body);
      return json(route, found);
    },

    appointments: (route, { method, url, body }, state) => {
      if (method === "POST") {
        seq += 1;
        const created: Appointment = {
          id: `ap-new-${seq}`,
          ...body,
          client_name: state.clients.find((c) => c.id === body.client)?.full_name,
          services_names: (body.services ?? []).map(
            (sid: string) => state.services.find((s) => s.id === sid)?.name ?? sid,
          ),
        };
        state.appointments.push(created);
        return json(route, created, 201);
      }
      return json(route, paginate(state.appointments, url));
    },
    appointmentItem: (route, { method, url, body }, state) => {
      const id = lastSegment(url);
      // GET /barbershop/appointments/summary/ — эндпоинт «ещё не на бэке»: фронт считает итог сам (404 → null).
      if (id === "summary") return json(route, { detail: "Не найдено." }, 404);
      const found = state.appointments.find((a) => a.id === id);
      if (!found) return json(route, { detail: "Не найдено." }, 404);
      if (method === "PATCH" || method === "PUT") Object.assign(found, body);
      return json(route, found);
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
    intercept: (name, method, handler) => {
      const prev = handlers[name];
      handlers[name] = (route, call, state) =>
        call.method === method ? handler(route, call, state) : prev(route, call, state);
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
   Хелперы
   ====================================================================== */

// Запас на холодную компиляцию ленивых чанков Vite при первом заходе.
const FIRST_RENDER = { timeout: 20_000 };

/**
 * Бюджет времени с поправкой на параллельный прогон: когда несколько воркеров гоняют браузеры,
 * CPU делится, и абсолютные замеры раздуваются. Строгий замер — с --workers=1.
 */
const perfBudget = (ms: number): number => (test.info().config.workers > 1 ? ms * 3 : ms);

/** Печатает замер в консоль прогона: видно, сколько реально занимает операция, а не только «уложилась / нет». */
function expectWithinBudget(label: string, ms: number, budgetMs: number): void {
  const budget = perfBudget(budgetMs);
  console.log(`[perf] ${label}: ${Math.round(ms)} мс (бюджет ${Math.round(budget)} мс)`);
  expect(ms, label).toBeLessThan(budget);
}

const SEP = "[\\s\\u00a0\\u202f]";

/**
 * Регулярка для денег в формате ru-RU: «1 500 сом». Разделитель тысяч в разных браузерах и версиях ICU —
 * пробел, NBSP (U+00A0) или узкий NBSP (U+202F); четырёхзначные числа иногда не группируются вовсе.
 */
function money(n: number): RegExp {
  const int = String(Math.abs(Math.round(n)));
  let out = "";
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % 3 === 0) out += `${SEP}?`;
    out += int[i];
  }
  return new RegExp(`(^|[^\\d])${out}${SEP}сом`);
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

/** Диалоги window.alert/confirm/prompt: на этих страницах их быть не должно (XSS-проверки). */
function trackDialogs(page: Page): string[] {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(d.message());
    void d.dismiss();
  });
  return seen;
}

/** Выбрать опцию в BarberSelect (выпадашка рендерится порталом в body c role=listbox). */
async function pickBarberSelect(page: Page, current: Locator, option: string | RegExp) {
  await current.click();
  await page.getByRole("listbox").getByRole("button", { name: option }).click();
}

/** Сумма и максимум long tasks (>50 мс), накопленные с момента addInitScript. */
async function longTasks(page: Page): Promise<{ count: number; max: number; total: number }> {
  return page.evaluate(() => {
    const list: number[] = (window as any).__longTasks ?? [];
    return { count: list.length, max: Math.max(0, ...list), total: list.reduce((a, b) => a + b, 0) };
  });
}

/** «Отзывчивость»: сколько мс проходит от запроса до двух подряд отрисованных кадров. */
async function frameLatency(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
      }),
  );
}

/**
 * Помечает тест как «известный дефект приложения»: он ДОЛЖЕН падать (test.fail), пока дефект не исправлен.
 * Когда дефект починят, тест начнёт «неожиданно проходить» и попросит снять пометку.
 * E2E_SHOW_DEFECTS=1 отключает пометку — тест падает по-настоящему, видно причину в отчёте.
 */
function knownDefect(reason: string): void {
  if (!process.env.E2E_SHOW_DEFECTS) test.fail(true, `Известный дефект: ${reason}`);
}

/* ---------- Услуги ---------- */

const servicesTab = (page: Page) => page.getByRole("tab", { name: "Услуги" });
const categoriesTab = (page: Page) => page.getByRole("tab", { name: "Категории" });
const addButton = (page: Page) => page.getByRole("button", { name: "Добавить", exact: true });
const searchBox = (page: Page) => page.getByRole("textbox", { name: "Поиск" });
const filtersButton = (page: Page) => page.getByRole("button", { name: /^Фильтры/ });
const serviceRow = (page: Page, text: string | RegExp) =>
  recordRow(page, text);

async function openServices(page: Page): Promise<void> {
  await page.goto(URLS.services);
  await expect(servicesTab(page)).toBeVisible(FIRST_RENDER);
  await expect(page.getByText("Загрузка услуг...")).toBeHidden(FIRST_RENDER);
}

/** Модалка услуги: портал с id (у самой модалки role="dialog" без имени, а ConfirmModal — тоже dialog). */
const serviceModal = (page: Page) => page.locator("#barber-service-modal");
const serviceFields = (page: Page) => {
  const modal = serviceModal(page);
  return {
    modal,
    title: modal.getByRole("heading"),
    name: modal.getByLabel(/^Название/),
    price: modal.getByLabel(/^Цена/),
    time: modal.getByLabel(/^Длительность/),
    category: modal.getByText("Общее", { exact: true }),
    submit: modal.getByRole("button", { name: /^(Сохранить|Сохранение…)$/ }),
    saving: modal.getByRole("button", { name: "Сохранение…" }),
    cancel: modal.getByRole("button", { name: "Отмена" }),
    remove: modal.getByRole("button", { name: "Удалить" }),
    close: modal.getByRole("button", { name: "Закрыть" }),
    alerts: modal.locator("[class*='alert']"),
  };
};

async function openNewService(page: Page) {
  await openServices(page);
  await addButton(page).click();
  const f = serviceFields(page);
  await expect(f.name).toBeVisible();
  return f;
}

async function openEditService(page: Page, rowText: string) {
  await openServices(page);
  await serviceRow(page, rowText).click();
  const f = serviceFields(page);
  await expect(f.title).toHaveText("Редактировать");
  return f;
}

const categoryModal = (page: Page) => page.locator("#barber-category-modal");

/* ---------- Записи ---------- */

/** Строки списка дня — <tr role="button"> (кликабельны с клавиатуры), поэтому role="row" к ним не подходит. */
const recordRow = (page: Page, text: string | RegExp) =>
  page.locator("tr").filter({ hasText: text });
const dayTotal = (page: Page) =>
  page.getByRole("button", { name: /Итого за день/ });
const bookButton = (page: Page) => page.getByRole("button", { name: "Запланировать запись" });
const walkInButton = (page: Page) => page.getByRole("button", { name: "Клиент пришёл без записи" });
const bookingDialog = (page: Page) => page.getByRole("dialog", { name: "Запланировать запись" });
const walkInDialog = (page: Page) => page.getByRole("dialog", { name: "Клиент пришёл" });

async function openRecords(page: Page): Promise<void> {
  // Фиксируем только Date (таймеры идут как обычно): «сегодня» = 12.10.2026 10:00 по Бишкеку.
  await page.clock.setFixedTime(new Date(NOW_ISO));
  await page.goto(URLS.records);
  await expect(bookButton(page)).toBeVisible(FIRST_RENDER);
  await expect(page.getByText("Загрузка…")).toBeHidden(FIRST_RENDER);
}

async function openBooking(page: Page) {
  await openRecords(page);
  await bookButton(page).click();
  const dlg = bookingDialog(page);
  await expect(dlg).toBeVisible();
  return dlg;
}

const stepNav = (dlg: Locator, label: "Когда" | "Клиент" | "Мастер" | "Услуги") =>
  dlg.getByRole("complementary", { name: "Шаги" }).getByRole("button", { name: new RegExp(label) });
const submitRecord = (dlg: Locator) =>
  dlg.getByRole("button", { name: /^(Сохранить запись|Сохранение…|Принять клиента)$/ });

/** Выбрать значение в комбобоксе мастера/клиента (RecordaServicesPicker, single). */
async function pickCombo(dlg: Locator, placeholder: RegExp, option: string | RegExp) {
  await dlg.getByRole("button", { name: placeholder }).click();
  await dlg.getByRole("button", { name: option }).click();
}

/** Услуга-плитка в шаге «Услуги»: имя начинается с названия (кнопки ± имеют aria-label «Добавить «…»»). */
const serviceTile = (dlg: Locator, name: string) =>
  dlg.getByRole("button", { name: new RegExp(`^${name}`) });

/**
 * Пошагово заполняет валидную бронь: мастер → услуги → слот времени → клиент.
 * Возвращает диалог. Итог: Стрижка (500) + Борода (300) = 800 сом, 50 мин.
 */
async function fillBooking(dlg: Locator, opts: { slot?: string; withClient?: boolean } = {}) {
  const { slot = "16:00", withClient = true } = opts;
  await stepNav(dlg, "Мастер").click();
  await pickCombo(dlg, /Выберите мастера/, /Иванов Иван/);
  await stepNav(dlg, "Услуги").click();
  await serviceTile(dlg, "Стрижка").click();
  await serviceTile(dlg, "Борода").click();
  await stepNav(dlg, "Когда").click();
  await dlg.getByRole("button", { name: slot, exact: true }).click();
  if (withClient) {
    await stepNav(dlg, "Клиент").click();
    await pickCombo(dlg, /Выберите клиента/, /Асанов Азамат/);
  }
  return dlg;
}

/* ======================================================================
   0. СМОКИ: обе страницы открываются
   ====================================================================== */

test.describe("0. Смоки", () => {
  test("/crm/services/services: каталог, счётчик и строки без мусора в рендере", async ({ page }) => {
    // Проверяем, что маршрут секторa «Услуги» вообще отдаёт страницу и данные мока доходят до таблицы.
    await openServices(page);
    await expect(serviceRow(page, "Стрижка")).toBeVisible();
    await expect(serviceRow(page, "Борода")).toBeVisible();
    // 5 услуг в базе → «5 услуг» (счётчик берёт count пагинации).
    await expect(page.getByText("5 услуг", { exact: true })).toBeVisible();
    // Формат: цена с «сом», пустая категория → «Общее», длительность с «мин», нет сотрудников → «—».
    await expect(serviceRow(page, "Консультация")).toContainText("Общее");
    await expect(serviceRow(page, "Стрижка")).toContainText(money(500));
    await expect(serviceRow(page, "Стрижка")).toContainText("30 мин");
    await expectNoRenderGarbage(page);
  });

  test("/crm/services/records: журнал показывает записи дня и «Итого за день»", async ({ page }) => {
    // Две записи на 12.10: 500 + 800 = 1 300 сом. Сводка с бэка недоступна (404) → считает фронт.
    await openRecords(page);
    await expect(recordRow(page, "Асанов Азамат")).toBeVisible();
    await expect(recordRow(page, "Бекова Айгуль")).toBeVisible();
    await expect(dayTotal(page)).toContainText(money(1300));
    await expect(page.getByText("Показано 2 записи")).toBeVisible();
    await expectNoRenderGarbage(page);
  });
});

/* ======================================================================
   1. ХЕППИ-ПАТ
   ====================================================================== */

test.describe("1. Хеппи-пат: каталог услуг (/crm/services/services)", () => {
  test("создание услуги: валидная форма → POST с правильным payload → модалка закрыта, строка в таблице", async ({
    page,
    api,
  }) => {
    const f = await openNewService(page);

    // Заполняем все поля, включая категорию (BarberSelect) и сотрудника.
    await f.name.fill("Укладка");
    await f.price.fill("1 200,50"); // пробелы и запятая должны нормализоваться: parseMoney → 1200.5
    await f.time.fill("45");
    await pickBarberSelect(page, f.category, "Окрашивание");
    await pickBarberSelect(page, f.modal.getByText("Выберите сотрудника"), /Петров Пётр/);
    await expect(f.modal.getByText("Петров Пётр")).toBeVisible(); // тег выбранного сотрудника

    await f.submit.click();

    // Модалка закрылась, список перезапрошен, новая услуга сверху (сортировка «Новые»).
    await expect(f.modal).toHaveCount(0);
    await expect(serviceRow(page, "Укладка")).toBeVisible();
    await expect(serviceRow(page, "Укладка")).toContainText("Окрашивание");
    await expect(serviceRow(page, "Укладка")).toContainText("45 мин");
    await expect(serviceRow(page, "Укладка")).toContainText("Петров Пётр");

    const posts = api.calls("services", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({
      name: "Укладка",
      price: 1200.5,
      time: "45",
      category: "cat-2",
      is_active: true,
      barbers: ["emp-2"],
    });
    await expect(page.getByText("6 услуг", { exact: true })).toBeVisible();
  });

  test("редактирование: PATCH меняет цену, остальные поля сохраняются", async ({ page, api }) => {
    const f = await openEditService(page, "Борода");
    await expect(f.name).toHaveValue("Борода");
    await expect(f.price).toHaveValue("300");

    await f.price.fill("350");
    await f.submit.click();

    await expect(f.modal).toHaveCount(0);
    await expect(serviceRow(page, "Борода")).toContainText(money(350));
    const patches = api.calls("serviceItem", "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].url.pathname).toMatch(/\/barbershop\/services\/svc-2\/$/);
    expect(patches[0].body).toMatchObject({ name: "Борода", price: 350, category: "cat-1" });
  });

  test("удаление: «Удалить» → подтверждение → DELETE → строка исчезла; «Отменить» оставляет услугу", async ({
    page,
    api,
  }) => {
    const f = await openEditService(page, "Консультация");

    // Отмена подтверждения — запроса DELETE нет.
    await f.remove.click();
    const confirm = page.locator("#confirm-modal");
    await expect(confirm.getByText("Удалить услугу «Консультация» безвозвратно?")).toBeVisible();
    await confirm.getByRole("button", { name: "Отменить" }).click();
    expect(api.calls("serviceItem", "DELETE")).toHaveLength(0);

    // Подтверждение — DELETE и обновлённый список.
    await f.remove.click();
    await confirm.getByRole("button", { name: "Подтвердить" }).click();
    await expect(f.modal).toHaveCount(0);
    await expect(serviceRow(page, "Консультация")).toHaveCount(0);
    expect(api.calls("serviceItem", "DELETE")).toHaveLength(1);
    await expect(page.getByText("4 услуги", { exact: true })).toBeVisible();
  });

  test("категории: вкладка → создание → карточка в списке, счётчик «категории»", async ({ page, api }) => {
    await openServices(page);
    await categoriesTab(page).click();
    await expect(page.getByRole("heading", { name: "Парикмахерские" })).toBeVisible();

    await addButton(page).click();
    const modal = categoryModal(page);
    await modal.getByLabel(/^Название/).fill("Маникюр");
    await modal.getByRole("button", { name: "Сохранить" }).click();

    await expect(modal).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Маникюр" })).toBeVisible();
    await expect(page.getByText("3 категории", { exact: true })).toBeVisible();
    expect(api.calls("categories", "POST")[0].body).toMatchObject({ name: "Маникюр", is_active: true });
  });

  test("поиск: debounce 400 мс — на набор «Бор» уходит ОДИН запрос с search; «ничего не найдено»", async ({
    page,
    api,
  }) => {
    await openServices(page);
    const before = api.calls("services", "GET").length;

    // Быстрый набор по символам не должен порождать запрос на каждую букву.
    await searchBox(page).pressSequentially("Бор", { delay: 30 });
    await expect(serviceRow(page, "Борода")).toBeVisible();
    await expect(serviceRow(page, "Стрижка")).toHaveCount(0);

    const searches = api
      .calls("services", "GET")
      .slice(before)
      .map((c) => c.url.searchParams.get("search"));
    expect(searches).toEqual(["Бор"]);

    await searchBox(page).fill("zzz-нет-такой");
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
  });

  test("фильтры: категория и сортировка уходят в запрос, бейдж считает активные фильтры, «Сбросить» чистит", async ({
    page,
    api,
  }) => {
    await openServices(page);
    await filtersButton(page).click();

    await pickBarberSelect(page, page.getByText("Все", { exact: true }), "Окрашивание");
    await expect(serviceRow(page, "Окрашивание")).toBeVisible();
    await expect(serviceRow(page, "Стрижка")).toHaveCount(0);
    expect(api.calls("services", "GET").at(-1)!.url.searchParams.get("category")).toBe("cat-2");

    await pickBarberSelect(page, page.getByText("Новые", { exact: true }), "Дороже");
    expect(api.calls("services", "GET").at(-1)!.url.searchParams.get("ordering")).toBe("-price");
    await expect(filtersButton(page)).toContainText("2");

    await page.getByRole("button", { name: "Сбросить" }).click();
    await expect(serviceRow(page, "Стрижка")).toBeVisible();
    expect(api.calls("services", "GET").at(-1)!.url.searchParams.get("category")).toBeNull();
  });

  test("пагинация: 45 услуг → «Далее» запрашивает page=2, «Назад» возвращает на 1", async ({ page, api }) => {
    api.db.services = Array.from({ length: 45 }, (_, i) =>
      makeService(i + 1, `Услуга ${String(i + 1).padStart(2, "0")}`, 100 + i, "30", null),
    );
    await openServices(page);
    await expect(page.getByText("45 услуг", { exact: true })).toBeVisible();
    await expect(page.getByText("Страница 1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Назад" })).toBeDisabled();

    await page.getByRole("button", { name: "Далее" }).click();
    await expect(page.getByText("Страница 2")).toBeVisible();
    expect(api.calls("services", "GET").at(-1)!.url.searchParams.get("page")).toBe("2");
    // «Новые» первыми: на 2-й странице идут услуги 25..06.
    await expect(serviceRow(page, "Услуга 25")).toBeVisible();

    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page.getByText("Страница 1")).toBeVisible();
    await expect(serviceRow(page, "Услуга 45")).toBeVisible();
  });

  test("переключатель вида: таблица ↔ карточки показывает те же данные", async ({ page }) => {
    await openServices(page);
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("button", { name: "Вид карточками" }).click();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("article").filter({ hasText: "Стрижка" })).toContainText(money(500));
    await page.getByRole("button", { name: "Вид таблицей" }).click();
    await expect(serviceRow(page, "Стрижка")).toBeVisible();
  });
});

test.describe("1. Хеппи-пат: журнал записей (/crm/services/records)", () => {
  test("бронь: мастер → услуги → слот → клиент; сводка считает сумму и время; POST с верным payload", async ({
    page,
    api,
  }) => {
    const dlg = await openBooking(page);
    await fillBooking(dlg);

    // Расчёты: Стрижка 500 + Борода 300 = 800 сом; 30 + 20 = 50 мин; слот 16:00 → конец 16:50.
    const aside = dlg.getByRole("complementary", { name: "Шаги" });
    await expect(aside).toContainText("2 · 50 мин");
    await expect(aside).toContainText("Иванов Иван");
    await expect(aside).toContainText("Асанов Азамат");
    await expect(aside).toContainText("16:00–16:50");
    await expect(aside).toContainText(money(800));

    await submitRecord(dlg).click();

    // Модалка закрылась, запись появилась в списке дня, итог за день вырос на 800: 1 300 → 2 100.
    await expect(dlg).toHaveCount(0);
    const row = recordRow(page, "16:00");
    await expect(row).toContainText("Асанов Азамат");
    await expect(row).toContainText("Стрижка");
    await expect(dayTotal(page)).toContainText(money(2100));

    const posts = api.calls("appointments", "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({
      barber: "emp-1",
      client: "cl-1",
      start_at: `${TODAY}T16:00:00+06:00`,
      end_at: `${TODAY}T16:50:00+06:00`,
      status: "booked",
      price: 800,
    });
    expect([...posts[0].body.services].sort()).toEqual(["svc-1", "svc-2"]);
  });

  test("расчёт скидки: 10% от 800 → 720; ручная цена перекрывает скидку и уходит в payload без discount", async ({
    page,
    api,
  }) => {
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    const aside = dlg.getByRole("complementary", { name: "Шаги" });
    await expect(aside).toContainText(money(800));

    await dlg.getByRole("button", { name: /Дополнительно/ }).click();
    await dlg.getByLabel("Скидка %").fill("10");
    // Поле «Цена» пересчиталось само, а «Итого» в сводке обновилось.
    await expect(dlg.getByLabel("Цена")).toHaveValue("720");
    await expect(aside).toContainText(money(720));

    // Ручная цена: сумма из сводки следует за ней.
    await dlg.getByLabel("Цена").fill("500");
    await expect(aside).toContainText(money(500));

    await submitRecord(dlg).click();
    await expect(dlg).toHaveCount(0);
    const body = api.calls("appointments", "POST")[0].body;
    expect(body.price).toBe(500);
    expect(body).not.toHaveProperty("discount");
    expect(body.client).toBeNull(); // клиент необязателен
  });

  test("walk-in «Клиент пришёл»: услуга → мастер → «Принять клиента»; статус confirmed, время — текущий слот", async ({
    page,
    api,
  }) => {
    await openRecords(page);
    await walkInButton(page).click();
    const dlg = walkInDialog(page);
    await expect(dlg).toBeVisible();

    // В walk-in шаг переключается сам: после услуги открывается выбор мастера.
    await serviceTile(dlg, "Борода").click();
    await dlg.getByRole("button", { name: /Иванов Иван/ }).click();
    await submitRecord(dlg).click();

    await expect(dlg).toHaveCount(0);
    const body = api.calls("appointments", "POST")[0].body;
    expect(body).toMatchObject({
      barber: "emp-1",
      status: "confirmed",
      start_at: `${TODAY}T10:00:00+06:00`,
      end_at: `${TODAY}T10:20:00+06:00`,
      price: 300,
    });
  });

  test("редактирование записи: клик по строке → смена статуса → PATCH; удаление через подтверждение → status=deleted", async ({
    page,
    api,
  }) => {
    await openRecords(page);
    await recordRow(page, "Асанов Азамат").click();
    const dlg = page.getByRole("dialog", { name: "Редактировать запись" });
    await expect(dlg).toBeVisible();

    // Расширенная секция в режиме правки открыта: меняем комментарий и сохраняем.
    await dlg.getByLabel("Комментарий").fill("Придёт с другом");
    await submitRecord(dlg).click();
    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointmentItem", "PATCH")[0].body).toMatchObject({ comment: "Придёт с другом", barber: "emp-1" });

    // «Удалить» — мягкое удаление: PATCH {status:"deleted"}, запись пропадает из расписания.
    await recordRow(page, "Асанов Азамат").click();
    await dlg.getByRole("button", { name: "Удалить" }).click();
    await page.locator("#confirm-modal").getByRole("button", { name: "Подтвердить" }).click();
    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointmentItem", "PATCH").at(-1)!.body).toEqual({ status: "deleted" });
    await expect(recordRow(page, "Асанов Азамат")).toHaveCount(0);
    await expect(dayTotal(page)).toContainText(money(800)); // осталась только запись на 800
  });

  test("навигация по дням и фильтры: «Следующий день» → пусто; фильтр по мастеру оставляет его записи", async ({
    page,
  }) => {
    await openRecords(page);
    await page.getByRole("button", { name: "Следующий день" }).click();
    await expect(page.getByText("На этот день записей нет")).toBeVisible();
    await page.getByRole("button", { name: "Сегодня", exact: true }).click();
    await expect(recordRow(page, "Асанов Азамат")).toBeVisible();

    await page.getByRole("button", { name: /^Фильтры/ }).click();
    await pickBarberSelect(page, page.getByText("Все мастера", { exact: true }), /Петров Пётр/);
    await expect(recordRow(page, "Асанов Азамат")).toHaveCount(0);
    await expect(recordRow(page, "Бекова Айгуль")).toBeVisible();
  });

  test("сводка «Сумма по клиентам»: клик по «Итого за день» открывает разбивку с суммами", async ({ page }) => {
    await openRecords(page);
    await dayTotal(page).click();
    const summary = page.getByRole("dialog", { name: "Сумма по клиентам" });
    await expect(summary).toBeVisible();
    // Сумма — последняя ячейка строки (иначе цифры телефона и счётчика «слипаются» с ней в одну строку).
    const sumOf = (name: string) =>
      summary.getByRole("row").filter({ hasText: name }).getByRole("cell").last();
    await expect(sumOf("Асанов Азамат")).toContainText(money(500));
    await expect(sumOf("Бекова Айгуль")).toContainText(money(800));
    await expect(sumOf("Всего")).toContainText(money(1300));
    await page.keyboard.press("Escape");
    await expect(summary).toBeHidden();
  });
});

/* ======================================================================
   2. ЗАЩИТА ОТ ДУРАКА
   ====================================================================== */

test.describe("2. Абуз интерфейса: каталог услуг", () => {
  test("тройной клик по «Сохранить»: кнопка блокируется («Сохранение…»), POST уходит ровно один раз", async ({
    page,
    api,
  }) => {
    // Медленный бэкенд: между первым и третьим кликом ответ ещё не пришёл.
    api.intercept("services", "POST", async (route, { body }) => {
      await delay(800);
      return json(route, { id: "svc-slow", ...body, category_name: "", barbers_detail: [], created_at: "2027-01-01T00:00:00Z" }, 201);
    });
    const f = await openNewService(page);
    await f.name.fill("Тройной клик");
    await f.price.fill("100");

    await f.submit.click({ clickCount: 3, delay: 20 });

    // Пока идёт запрос, кнопка disabled и подписана «Сохранение…».
    await expect(f.saving).toBeDisabled();
    await expect(f.modal).toHaveCount(0); // дождались ответа и закрытия
    expect(api.calls("services", "POST")).toHaveLength(1);
  });

  test("пустая форма: подсветка полей, список ошибок, фокус на «Название», запросов нет", async ({ page, api }) => {
    const f = await openNewService(page);
    await f.submit.click();

    await expect(f.modal.getByText("Исправьте ошибки в форме.")).toBeVisible();
    await expect(f.modal.getByText("Введите название.")).toBeVisible();
    await expect(f.modal.getByText("Введите цену.")).toBeVisible();
    await expect(f.name).toBeFocused(); // focusFirstError
    // Невалидные поля подсвечены (класс --invalid на самом поле, ищем по модификатору, а не по вёрстке карточки).
    await expect(f.name).toHaveClass(/--invalid/);
    await expect(f.price).toHaveClass(/--invalid/);
    expect(api.calls("services", "POST")).toHaveLength(0);
    await expect(f.name).toBeVisible();
  });

  test("пробелы вместо названия считаются пустым названием", async ({ page, api }) => {
    const f = await openNewService(page);
    await f.name.fill("     ");
    await f.price.fill("100");
    await f.submit.click();
    await expect(f.modal.getByText("Введите название.")).toBeVisible();
    expect(api.calls("services", "POST")).toHaveLength(0);
  });

  for (const bad of ["-100", "-0,01", "abc", "12abc", "Infinity", "--5", "1,2,3"]) {
    test(`цена «${bad}» отклоняется: «Цена должна быть числом.», запроса нет`, async ({ page, api }) => {
      // Отрицательные, нечисловые и «полу-числовые» значения не должны уйти на сервер.
      const f = await openNewService(page);
      await f.name.fill("Тест цены");
      await f.price.fill(bad);
      await f.submit.click();
      await expect(f.modal.getByText("Цена должна быть числом.")).toBeVisible();
      expect(api.calls("services", "POST")).toHaveLength(0);
    });
  }

  test("дубликат: «  консультация  » в той же категории (Общее) → «Такая услуга уже есть в этой категории.»", async ({
    page,
    api,
  }) => {
    const f = await openNewService(page);
    await f.name.fill("  консультация  ");
    await f.price.fill("100");
    await f.submit.click();
    await expect(f.modal.getByText("Такая услуга уже есть в этой категории.")).toBeVisible();
    expect(api.calls("services", "POST")).toHaveLength(0);
  });

  test("спецсимволы <script>, {{ }}, &, кавычки сохраняются буквально и НЕ исполняются (XSS)", async ({
    page,
    api,
  }) => {
    const dialogs = trackDialogs(page);
    const evil =
      `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script> {{constructor.constructor('alert(1)')()}} &amp; "q" 'q' \${7*7} {}`;
    const f = await openNewService(page);
    await f.name.fill(evil);
    await f.price.fill("10");
    await f.submit.click();

    await expect(f.modal).toHaveCount(0);
    // В payload — ровно то, что ввели (без экранирования на клиенте), в таблице — как текст, без разметки.
    expect(api.calls("services", "POST")[0].body.name).toBe(evil);
    await expect(page.getByRole("cell", { name: evil, exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await page.locator("table img, table script").count()).toBe(0);
    expect(dialogs).toEqual([]);
    await expect(serviceRow(page, "Стрижка")).toBeVisible(); // страница жива
  });

  test("гигантская строка (10 000 символов): UI не зависает, сервер отвечает 400 — его текст показан в модалке", async ({
    page,
    api,
  }) => {
    api.intercept("services", "POST", (route, { body }) =>
      String(body.name).length > 255
        ? json(route, { name: ["Убедитесь, что это значение содержит не более 255 символов."] }, 400)
        : json(route, { id: "x", ...body }, 201),
    );
    const f = await openNewService(page);
    await f.name.fill("А".repeat(10_000));
    await f.price.fill("10");
    await f.submit.click();

    await expect(f.modal.getByText("Убедитесь, что это значение содержит не более 255 символов.")).toBeVisible();
    // Кнопка снова доступна (не «залипла» в «Сохранение…»), модалку можно закрыть.
    await expect(f.submit).toBeEnabled();
    await f.cancel.click();
    await expect(f.modal).toHaveCount(0);
    await expectNoPageHScroll(page);
  });

  test("гигантское значение в поиске (50 000 символов): страница не падает и показывает «Ничего не найдено»", async ({
    page,
  }) => {
    await openServices(page);
    await searchBox(page).fill("Ж".repeat(50_000));
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("Esc / клик по подложке / «Закрыть» закрывают модалку без запросов; повторное открытие даёт чистую форму", async ({
    page,
    api,
  }) => {
    const f = await openNewService(page);
    await f.name.fill("Черновик");
    await f.close.click();
    await expect(f.modal).toHaveCount(0);
    await addButton(page).click();
    await expect(f.name).toHaveValue("");
    expect(api.calls("services", "POST")).toHaveLength(0);
  });

  test("длительность: отрицательное и нечисловое значение не должно уходить на сервер", async ({ page, api }) => {
    // Поле «Длительность (мин)» сейчас НЕ валидируется (ServiceModal.jsx: time уходит как есть) —
    // тест описывает ожидаемое поведение: либо ошибка в форме, либо нормализация.
    knownDefect("«Длительность» не валидируется на клиенте, '-30' и 'abc' уходят на бэк");
    const f = await openNewService(page);
    await f.name.fill("Минус время");
    await f.price.fill("100");
    await f.time.fill("-30");
    await f.submit.click();
    await expect(f.modal.getByText(/длительн/i)).toBeVisible({ timeout: 2000 });
    expect(api.calls("services", "POST")).toHaveLength(0);
  });
});

test.describe("2. Абуз интерфейса: журнал записей", () => {
  test("пустая бронь: «Сохранить запись» заблокирована, подсказка в title, запросов нет", async ({ page, api }) => {
    const dlg = await openBooking(page);
    // Без мастера и услуг форма невалидна — кнопка disabled (защита от пустой отправки).
    await expect(submitRecord(dlg)).toBeDisabled();
    await expect(submitRecord(dlg)).toHaveAttribute("title", /Выберите мастера, услугу/);
    // Принудительный клик «в обход» тоже ничего не отправляет.
    await submitRecord(dlg).click({ force: true });
    expect(api.calls("appointments", "POST")).toHaveLength(0);
    await expect(dlg).toBeVisible();
  });

  test("тройной клик по «Сохранить запись»: POST ровно один раз, кнопка «Сохранение…» disabled", async ({
    page,
    api,
  }) => {
    api.intercept("appointments", "POST", async (route, { body }) => {
      await delay(800);
      return json(route, { id: "ap-slow", ...body }, 201);
    });
    const dlg = await openBooking(page);
    await fillBooking(dlg);

    await submitRecord(dlg).click({ clickCount: 3, delay: 20 });
    await expect(dlg.getByRole("button", { name: "Сохранение…" })).toBeDisabled();
    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointments", "POST")).toHaveLength(1);
  });

  test("занятый мастер: слот, пересекающийся с чужой записью, недоступен; кнопка отправки не активируется", async ({
    page,
    api,
  }) => {
    const dlg = await openBooking(page);
    await stepNav(dlg, "Мастер").click();
    await pickCombo(dlg, /Выберите мастера/, /Иванов Иван/);
    await stepNav(dlg, "Услуги").click();
    await serviceTile(dlg, "Стрижка").click();
    await stepNav(dlg, "Когда").click();
    // У Иванова запись 12:00–12:30 → слот 12:00 занят, 11:30 и 12:30 свободны.
    await expect(dlg.getByRole("button", { name: "12:00", exact: true })).toBeDisabled();
    await expect(dlg.getByRole("button", { name: "12:30", exact: true })).toBeEnabled();
    await dlg.getByRole("button", { name: "12:00", exact: true }).click({ force: true });
    expect(api.calls("appointments", "POST")).toHaveLength(0);
  });

  test("скидка: нечисловой ввод игнорируется и не даёт NaN в цене и сводке", async ({ page }) => {
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    await dlg.getByRole("button", { name: /Дополнительно/ }).click();
    await dlg.getByLabel("Скидка %").fill("abc<script>");
    await expect(dlg.getByLabel("Цена")).toHaveValue("800");
    await expect(dlg.getByRole("complementary", { name: "Шаги" })).toContainText(money(800));
    await expectNoRenderGarbage(page);
  });

  test("скидка -50% / 150%: итог не должен превышать сумму услуг и не должен «схлопываться» в 0", async ({ page }) => {
    // Сейчас calcFinalPrice не ограничивает процент: -50% даёт 1 200 (наценка), 150% даёт 0 сом.
    knownDefect("скидка вне диапазона 0–100% не отсекается (RecordaUtils.calcFinalPrice)");
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    await dlg.getByRole("button", { name: /Дополнительно/ }).click();
    const price = dlg.getByLabel("Цена");

    // Цена пересчитывается эффектом React уже после fill — ждём два кадра, чтобы не прочитать устаревшее значение.
    await dlg.getByLabel("Скидка %").fill("-50");
    await frameLatency(page);
    expect(Number(await price.inputValue())).toBeLessThanOrEqual(800);

    await dlg.getByLabel("Скидка %").fill("150");
    await frameLatency(page);
    expect(Number(await price.inputValue())).toBeGreaterThan(0);
  });

  test("ручная цена -100 не уходит на сервер отрицательной", async ({ page, api }) => {
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    await dlg.getByRole("button", { name: /Дополнительно/ }).click();
    await dlg.getByLabel("Цена").fill("-100");
    await submitRecord(dlg).click();
    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointments", "POST")[0].body.price).toBeGreaterThanOrEqual(0);
  });

  test("комментарий со спецсимволами и 10 000 символов уходит буквально, интерфейс не ломается", async ({
    page,
    api,
  }) => {
    const dialogs = trackDialogs(page);
    const evil = `<script>window.__xss=1</script>{}&amp;"'` + "Ф".repeat(10_000);
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    await dlg.getByRole("button", { name: /Дополнительно/ }).click();
    await dlg.getByLabel("Комментарий").fill(evil);
    await submitRecord(dlg).click();

    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointments", "POST")[0].body.comment).toBe(evil);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
  });

  test("поиск услуги в мастере: спецсимволы и гигантская строка → «Услуги не найдены», без падения", async ({
    page,
  }) => {
    const dlg = await openBooking(page);
    await fillBooking(dlg, { withClient: false });
    await stepNav(dlg, "Услуги").click();
    const search = dlg.getByPlaceholder("Поиск услуги...");
    for (const q of ["<script>", "{}", "&", "%", "Я".repeat(20_000)]) {
      await search.fill(q);
      await expect(dlg.getByText("Услуги не найдены")).toBeVisible();
    }
    await search.fill("");
    await expect(serviceTile(dlg, "Стрижка")).toBeVisible();
  });
});

/* ======================================================================
   3. КЛИЕНТСКОЕ ОКРУЖЕНИЕ: ноутбук 1366×768
   ====================================================================== */

test.describe("3. Окружение: офисный ноутбук 1366×768", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test("услуги: кнопка «Добавить» и «Сохранить» в модалке видны без горизонтального скролла", async ({ page }) => {
    await openServices(page);
    // Кнопка создания видна сразу, без прокрутки страницы.
    await expect(addButton(page)).toBeInViewport();
    await addButton(page).click();
    const f = serviceFields(page);
    await expect(f.submit).toBeVisible();
    // Кнопка отправки физически на экране 1366×768 (или, как минимум, до неё доскроллить).
    await f.submit.scrollIntoViewIfNeeded();
    await expect(f.submit).toBeInViewport({ ratio: 1 });
    await expectNoPageHScroll(page);
  });

  test("записи: кнопка «Сохранить запись» в футере мастера видна на КАЖДОМ шаге, горизонтального скролла нет", async ({
    page,
  }) => {
    const dlg = await openBooking(page);
    await expect(submitRecord(dlg)).toBeInViewport({ ratio: 1 });
    for (const step of ["Мастер", "Услуги", "Когда", "Клиент"] as const) {
      // Недоступные шаги (например, «Услуги» до выбора мастера) — disabled, их пропускаем.
      if (await stepNav(dlg, step).isEnabled()) await stepNav(dlg, step).click();
      await expect(submitRecord(dlg)).toBeInViewport({ ratio: 1 });
    }
    // «Услуги» открываем честно: сначала мастер.
    await stepNav(dlg, "Мастер").click();
    await pickCombo(dlg, /Выберите мастера/, /Иванов Иван/);
    await stepNav(dlg, "Услуги").click();
    await expect(serviceTile(dlg, "Стрижка")).toBeVisible();
    await expect(submitRecord(dlg)).toBeInViewport({ ratio: 1 });
    // Модалка не выше экрана: не выпадает за нижний край.
    const box = await dlg.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(768 + 1);
    await expectNoPageHScroll(page);
  });

  test("записи: журнал с кнопками «Записать» и «Клиент пришёл» помещается в ширину 1366", async ({ page }) => {
    await openRecords(page);
    await expect(bookButton(page)).toBeInViewport();
    await expect(walkInButton(page)).toBeInViewport();
    await expectNoPageHScroll(page);
  });
});

/* ======================================================================
   4. СБОИ БЭКЕНДА
   ====================================================================== */

test.describe("4. Ошибки сервера: каталог услуг", () => {
  test("POST 500 с {detail}: показан текст сервера «Ошибка сервера», модалка и введённые данные на месте, кнопка снова активна", async ({
    page,
    api,
  }) => {
    api.intercept("services", "POST", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const f = await openNewService(page);
    await f.name.fill("Упавшая услуга");
    await f.price.fill("100");
    await f.submit.click();

    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(f.name).toHaveValue("Упавшая услуга"); // данные не потеряны
    await expect(f.submit).toBeEnabled(); // можно повторить
    await expect(f.name).toBeVisible();
    await expect(page.locator("#root")).not.toBeEmpty(); // не белый экран
    expect(api.calls("services", "POST")).toHaveLength(1);
  });

  test("обрыв сети на POST: показывается запасное «Ошибка сохранения.», форма не потеряна", async ({ page, api }) => {
    // Ответа нет вообще (connection reset) → err.response пуст → срабатывает запасной текст.
    api.intercept("services", "POST", (route) => route.abort("connectionreset"));
    const f = await openNewService(page);
    await f.name.fill("Обрыв сети");
    await f.price.fill("100");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сохранения.")).toBeVisible();
    await expect(f.name).toHaveValue("Обрыв сети");
    await expect(f.submit).toBeEnabled();
  });

  test("POST 500 с ПУСТЫМ телом: пользователь должен увидеть запасное «Ошибка сохранения.», а не пустую красную плашку", async ({
    page,
    api,
  }) => {
    // Пустое тело приходит как строка "" → msgs=[""] → `!msgs.length` ложно, запасной текст не показывается.
    knownDefect("ServiceModal/CategoryModal/RecordaModal при пустом теле ошибки рисуют пустую плашку");
    api.intercept("services", "POST", (route) => route.fulfill({ status: 500, body: "" }));
    const f = await openNewService(page);
    await f.name.fill("Без тела");
    await f.price.fill("100");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сохранения.")).toBeVisible({ timeout: 2000 });
  });

  test("POST 502 с HTML-страницей nginx: сырой HTML не вываливается пользователю", async ({ page, api }) => {
    // Прокси часто отвечает не JSON, а HTML. Ожидание: понятное сообщение, а не «<html><head>…».
    knownDefect("строковое тело ответа выводится в модалку как есть (ServiceModal.handleSubmit)");
    api.intercept("services", "POST", (route) =>
      route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<html><head><title>502 Bad Gateway</title></head><body><center>nginx</center></body></html>",
      }),
    );
    const f = await openNewService(page);
    await f.name.fill("HTML ошибка");
    await f.price.fill("100");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сохранения.")).toBeVisible({ timeout: 2000 });
    await expect(f.modal).not.toContainText("<html>");
  });

  test("PATCH 500 при правке: список не меняется, ошибка в модалке", async ({ page, api }) => {
    api.intercept("serviceItem", "PATCH", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const f = await openEditService(page, "Борода");
    await f.price.fill("999");
    await f.submit.click();
    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await f.cancel.click();
    await expect(serviceRow(page, "Борода")).toContainText(money(300)); // осталась старая цена
  });

  test("DELETE 500: запрос ушёл один раз, услуга остаётся в списке, страница жива", async ({ page, api }) => {
    api.intercept("serviceItem", "DELETE", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const f = await openEditService(page, "Консультация");
    await f.remove.click();
    await page.locator("#confirm-modal").getByRole("button", { name: "Подтвердить" }).click();
    await expect.poll(() => api.calls("serviceItem", "DELETE").length).toBe(1);
    await expect(f.name).toHaveValue("Консультация"); // форма на месте, ничего не потеряно
    await expectNoRenderGarbage(page);
  });

  test("DELETE 500: окно подтверждения должно закрыться, а текст ошибки — быть виден пользователю", async ({
    page,
    api,
  }) => {
    // handleDelete не сбрасывает confirmDelete: после сбоя «Подтвердите ваше действие» висит поверх,
    // а модалка с ошибкой остаётся прозрачной (opacity 0, pointer-events none) — ошибку не видно.
    knownDefect("после неудачного удаления ConfirmModal не закрывается (ServiceModal.handleDelete)");
    api.intercept("serviceItem", "DELETE", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const f = await openEditService(page, "Консультация");
    await f.remove.click();
    const confirm = page.locator("#confirm-modal").getByRole("dialog");
    await confirm.getByRole("button", { name: "Подтвердить" }).click();
    await expect(f.modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(confirm).toHaveCount(0, { timeout: 2000 });
  });

  test("категория: POST 500 {detail} → текст сервера в модалке категории, форма на месте", async ({ page, api }) => {
    api.intercept("categories", "POST", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openServices(page);
    await categoriesTab(page).click();
    await addButton(page).click();
    const modal = categoryModal(page);
    await modal.getByLabel(/^Название/).fill("Упавшая категория");
    await modal.getByRole("button", { name: "Сохранить" }).click();
    await expect(modal.getByText("Ошибка сервера")).toBeVisible();
    await expect(modal.getByLabel(/^Название/)).toHaveValue("Упавшая категория");
  });

  test("GET списка услуг → 500 с detail: красный блок над списком, страница жива, поиск работает дальше", async ({
    page,
    api,
  }) => {
    api.on("services", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openServices(page);
    await expect(page.getByText("Ошибка сервера")).toBeVisible();
    await expect(servicesTab(page)).toBeVisible();
    await expect(addButton(page)).toBeEnabled();
  });

  test("GET списка услуг → 500 без тела: запасной текст «Ошибка загрузки услуг.»", async ({ page, api }) => {
    api.on("services", (route) => route.fulfill({ status: 500, body: "" }));
    await openServices(page);
    await expect(page.getByText("Ошибка загрузки услуг.")).toBeVisible();
  });

  test("GET категорий → 500: вкладка «Категории» показывает «Ошибка загрузки категорий.»", async ({ page, api }) => {
    api.intercept("categories", "GET", (route) => route.fulfill({ status: 500, body: "" }));
    await openServices(page);
    await categoriesTab(page).click();
    await expect(page.getByText("Ошибка загрузки категорий.")).toBeVisible();
  });
});

test.describe("4. GET → null / мусор: каталог услуг", () => {
  const nullBody = (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" });

  test("вместо списка услуг пришёл null: «Нет услуг», «0 услуг», без падения", async ({ page, api }) => {
    api.on("services", nullBody);
    await openServices(page);
    await expect(page.getByText("Нет услуг", { exact: true })).toBeVisible();
    await expect(page.getByText("0 услуг", { exact: true })).toBeVisible();
    await expectNoRenderGarbage(page);
  });

  test("results: null и count: null — тоже безопасно", async ({ page, api }) => {
    api.on("services", (route) => json(route, { count: null, next: null, previous: null, results: null }));
    await openServices(page);
    await expect(page.getByText("Нет услуг", { exact: true })).toBeVisible();
  });

  test("категории и сотрудники — null: вкладка категорий и модалка услуги открываются", async ({ page, api }) => {
    api.on("categories", nullBody);
    api.on("employees", nullBody);
    await openServices(page);
    await filtersButton(page).click(); // фильтр категорий строится из null → только «Все»
    await expect(page.getByText("Все", { exact: true })).toBeVisible();
    await page.reload(); // панель фильтров закрывается подложкой-оверлеем — проще перезагрузить страницу (моки сохраняются)
    await expect(servicesTab(page)).toBeVisible(FIRST_RENDER);

    await categoriesTab(page).click();
    await expect(page.getByText("Нет категорий", { exact: true })).toBeVisible();

    await servicesTab(page).click();
    await addButton(page).click();
    const f = serviceFields(page);
    await expect(f.name).toBeVisible();
    await expect(f.modal.getByText("Нет доступных сотрудников")).toBeVisible();
  });

  test("строки с null-полями (name/price/time/category/barbers) рисуются без NaN и undefined", async ({
    page,
    api,
  }) => {
    api.db.services = [
      {
        id: "svc-bad-1",
        name: null as unknown as string,
        price: null,
        time: null,
        category: null,
        category_name: null as unknown as string,
        is_active: true,
        barbers: null as unknown as string[],
        barbers_detail: null as unknown as [],
        created_at: "2026-01-01T00:00:00Z",
      },
      makeService(2, "Цена-строка", "не число", "полчаса", null),
    ];
    await openServices(page);
    await expect(page.getByRole("row")).toHaveCount(3); // шапка + 2 строки
    await expect(serviceRow(page, "Цена-строка")).toContainText("—"); // fmtMoney("не число") → «—»
    await expect(serviceRow(page, "Цена-строка")).toContainText("полчаса"); // нечисловая длительность — как есть
    await expectNoRenderGarbage(page);
  });
});

test.describe("4. Ошибки сервера и null: журнал записей", () => {
  const nullBody = (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" });

  test("POST записи 500: ошибка в модалке, данные формы и выбранные шаги сохранены, повторная отправка возможна", async ({
    page,
    api,
  }) => {
    api.intercept("appointments", "POST", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    const dlg = await openBooking(page);
    await fillBooking(dlg);
    await submitRecord(dlg).click();

    await expect(dlg.getByText("Ошибка сервера")).toBeVisible();
    await expect(dlg.getByRole("complementary", { name: "Шаги" })).toContainText(money(800));
    await expect(submitRecord(dlg)).toBeEnabled();

    // Сервер «ожил» — повтор проходит.
    api.intercept("appointments", "POST", (route, { body }) => json(route, { id: "ap-ok", ...body }, 201));
    await submitRecord(dlg).click();
    await expect(dlg).toHaveCount(0);
    expect(api.calls("appointments", "POST")).toHaveLength(2);
  });

  test("POST записи: 400 с ошибками по полям — все сообщения показаны списком", async ({ page, api }) => {
    api.intercept("appointments", "POST", (route) =>
      json(route, { barber: ["Мастер недоступен."], start_at: ["Неверное время."] }, 400),
    );
    const dlg = await openBooking(page);
    await fillBooking(dlg);
    await submitRecord(dlg).click();
    await expect(dlg.getByText("Мастер недоступен.")).toBeVisible();
    await expect(dlg.getByText("Неверное время.")).toBeVisible();
  });

  test("PATCH при удалении записи 500: запись остаётся, в модалке «Ошибка сервера»", async ({ page, api }) => {
    api.intercept("appointmentItem", "PATCH", (route) => json(route, { detail: "Ошибка сервера" }, 500));
    await openRecords(page);
    await recordRow(page, "Асанов Азамат").click();
    const dlg = page.getByRole("dialog", { name: "Редактировать запись" });
    await dlg.getByRole("button", { name: "Удалить" }).click();
    await page.locator("#confirm-modal").getByRole("button", { name: "Подтвердить" }).click();
    await expect(dlg.getByText("Ошибка сервера")).toBeVisible();
  });

  test("GET записей 500: сообщение «Не удалось загрузить данные.», кнопки «Записать» остаются рабочими", async ({
    page,
    api,
  }) => {
    api.intercept("appointments", "GET", (route) => route.fulfill({ status: 500, body: "" }));
    await openRecords(page);
    await expect(page.getByText("Не удалось загрузить данные.")).toBeVisible();
    await bookButton(page).click();
    await expect(bookingDialog(page)).toBeVisible();
  });

  test("все справочники и записи пришли как null: журнал пуст, но не падает; бронь открывается", async ({
    page,
    api,
  }) => {
    for (const name of ["employees", "clients", "services", "categories"] as const) api.on(name, nullBody);
    api.intercept("appointments", "GET", nullBody);
    await openRecords(page);
    await expect(page.getByText("На этот день записей нет")).toBeVisible();
    await expectNoRenderGarbage(page);

    await bookButton(page).click();
    const dlg = bookingDialog(page);
    await expect(dlg).toBeVisible();
    await stepNav(dlg, "Услуги").click({ force: true });
    await expectNoRenderGarbage(page);
  });

  test("записи с null-полями (services, barber, client, price) не валят список и итог дня", async ({
    page,
    api,
  }) => {
    api.db.appointments.push(
      {
        id: "ap-null-1",
        client: null,
        barber: null,
        services: null,
        start_at: `${TODAY}T18:00:00+06:00`,
        end_at: `${TODAY}T18:30:00+06:00`,
        status: "booked",
        price: null,
      },
      {
        id: "ap-null-2",
        client: "cl-unknown",
        barber: "emp-unknown",
        services: ["svc-unknown"],
        start_at: `${TODAY}T19:00:00+06:00`,
        end_at: `${TODAY}T19:30:00+06:00`,
        status: "weird-status",
        price: "не число",
      },
    );
    await openRecords(page);
    await expect(recordRow(page, "18:00")).toBeVisible();
    await expect(recordRow(page, "19:00")).toBeVisible();
    await expectNoRenderGarbage(page);
    await expect(dayTotal(page)).toBeVisible();
  });

  test("сводка дня с бэка отдаёт мусор ({expected_total: 'abc'}): итог не превращается в NaN", async ({
    page,
    api,
  }) => {
    api.intercept("appointmentItem", "GET", (route, { url }) =>
      lastSegment(url) === "summary"
        ? json(route, { scope: "day", expected_count: "x", expected_total: "abc" })
        : json(route, {}, 404),
    );
    await openRecords(page);
    await expectNoRenderGarbage(page);
  });
});

/* ======================================================================
   5. СТРЕСС И ПРОИЗВОДИТЕЛЬНОСТЬ
   ====================================================================== */

const bigServices = (n: number): ServiceRow[] =>
  Array.from({ length: n }, (_, i) =>
    makeService(
      i + 1,
      `Услуга №${String(i + 1).padStart(4, "0")}`,
      100 + (i % 50) * 10,
      String(15 + (i % 6) * 15),
      i % 2 ? "cat-1" : "cat-2",
    ),
  );

const bigAppointments = (n: number): Appointment[] =>
  Array.from({ length: n }, (_, i) => {
    // 10:30 … 20:00 по кругу: все записи позже «текущих» 10:00, иначе сработает авто-завершение (PATCH на каждую).
    const startMin = 10 * 60 + 30 + (i % 20) * 30;
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    const endMin = startMin + 30;
    return {
      id: `ap-big-${i}`,
      client: i % 2 ? "cl-1" : "cl-2",
      client_name: `Клиент №${String(i).padStart(4, "0")}`,
      barber: i % 2 ? "emp-1" : "emp-2",
      services: ["svc-1"],
      services_names: ["Стрижка"],
      start_at: `${TODAY}T${hh}:${mm}:00+06:00`,
      end_at: `${TODAY}T${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00+06:00`,
      status: i % 3 === 0 ? "completed" : "booked",
      price: 500,
    };
  });

test.describe("5. Стресс: Big Data", () => {
  test.setTimeout(120_000);

  test("3 000 услуг одним ответом: страница рендерится, поиск и переключение вида отзывчивы", async ({
    page,
    api,
  }) => {
    api.db.services = bigServices(3000);
    // Реальный бэкенд ограничил бы страницу; здесь специально отдаём «тяжёлый» массив целиком.
    api.intercept("services", "GET", (route, { url }) => {
      const q = (url.searchParams.get("search") ?? "").toLowerCase();
      const list = api.db.services.filter((s) => s.name.toLowerCase().includes(q));
      return json(route, { count: list.length, next: null, previous: null, results: list });
    });

    const t0 = Date.now();
    await openServices(page);
    await expect(page.getByText("3000 услуг", { exact: true })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3001); // шапка + 3000
    expectWithinBudget("первая отрисовка 3 000 строк", Date.now() - t0, 8000);

    // Поиск по точному номеру → ровно одна строка.
    await searchBox(page).fill("№2999");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(serviceRow(page, "Услуга №2999")).toBeVisible();
    await searchBox(page).fill("");
    await expect(page.getByRole("row")).toHaveCount(3001);

    // Переключение вида на 3 000 карточек и обратно, затем открытие модалки по строке.
    await page.getByRole("button", { name: "Вид карточками" }).click();
    await expect(page.getByRole("article")).toHaveCount(3000);
    await page.getByRole("button", { name: "Вид таблицей" }).click();
    await serviceRow(page, "Услуга №0100").click();
    await expect(serviceFields(page).name).toHaveValue("Услуга №0100");
    await expectNoRenderGarbage(page);
  });

  test("2 000 записей за день (пагинация по 500): журнал загружается, итог дня верный, фильтры живы", async ({
    page,
    api,
  }) => {
    api.db.appointments = bigAppointments(2000);

    const t0 = Date.now();
    await openRecords(page);
    await expect(page.getByText("Показано 2000 записей")).toBeVisible({ timeout: 30_000 });
    expectWithinBudget("загрузка 4 страниц по 500 записей + рендер списка", Date.now() - t0, 9000);
    // 2 000 × 500 сом — все статусы, кроме canceled/no_show, входят в ожидаемую выручку.
    await expect(dayTotal(page)).toContainText(money(1_000_000));
    // 4 страницы выдачи по page_size=500 (в dev-сборке эффект монтирования выполняется дважды — StrictMode).
    expect(api.calls("appointments", "GET").length).toBeGreaterThanOrEqual(4);
    expect(api.calls("appointments", "GET").length % 4).toBe(0);

    // UI отзывчив: фильтр по статусу срезает список, «Календарь» переключается.
    await page.getByRole("button", { name: /^Фильтры/ }).click();
    await pickBarberSelect(page, page.getByText("Все статусы", { exact: true }), "Завершено");
    await expect(page.getByText("Показано 667 записей")).toBeVisible(); // i % 3 === 0 → 667 из 2000
    expectWithinBudget("кадр после фильтра", await frameLatency(page), 500);
  });

  test("500 записей в режиме «Календарь»: отрисовка в разумное время, клик по записи открывает модалку", async ({
    page,
    api,
  }) => {
    api.db.appointments = bigAppointments(500);
    await openRecords(page);
    await page.getByRole("button", { name: "Календарь" }).click();
    await expect(page.getByText("Иванов Иван").first()).toBeVisible({ timeout: 30_000 });
    const t0 = Date.now();
    // Блок записи (и «палочка», и карточка) несёт в title клиента — по нему надёжнее, чем по тексту.
    await page.getByTitle(/Клиент №0001/).first().click();
    await expect(page.getByRole("dialog", { name: "Редактировать запись" })).toBeVisible();
    expectWithinBudget("открытие записи в календаре", Date.now() - t0, 1500);
  });

  test("1 000 услуг в мастере записи: плитки выбираются, поиск по плиткам отфильтровывает мгновенно", async ({
    page,
    api,
  }) => {
    api.db.services = bigServices(1000);
    const dlg = await openBooking(page);
    await stepNav(dlg, "Мастер").click();
    await pickCombo(dlg, /Выберите мастера/, /Иванов Иван/);
    await stepNav(dlg, "Услуги").click();

    await dlg.getByPlaceholder("Поиск услуги...").fill("№0777");
    await expect(serviceTile(dlg, "Услуга №0777")).toBeVisible();
    await serviceTile(dlg, "Услуга №0777").click();
    await expect(dlg.getByText("1 поз.")).toBeVisible();
    // 777-я: i=776 → цена 100 + (776 % 50) * 10 = 360
    await expect(dlg.getByRole("complementary", { name: "Шаги" })).toContainText(money(360));
  });
});

test.describe("5. Стресс: замедленный CPU (CDP, только chromium)", () => {
  test.setTimeout(180_000);

  /** Включает троттлинг CPU через Chrome DevTools Protocol. */
  async function throttleCpu(page: Page, rate: number): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }

  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP Emulation.setCPUThrottlingRate есть только в chromium");
    // Наблюдатель long tasks ставим до загрузки приложения.
    await page.addInitScript(() => {
      (window as any).__longTasks = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) (window as any).__longTasks.push(e.duration);
        }).observe({ entryTypes: ["longtask"] });
      } catch {
        /* longtask не поддержан — замер просто будет пустым */
      }
    });
  });

  test("CPU ×4, каталог 1 000 услуг: список рисуется, модалка услуги открывается ≤ 1,5 с, нет «фризов» дольше 1,5 с", async ({
    page,
    api,
  }) => {
    api.db.services = bigServices(1000);
    api.intercept("services", "GET", (route) =>
      json(route, { count: 1000, next: null, previous: null, results: api.db.services }),
    );
    await throttleCpu(page, 4);

    await openServices(page);
    await expect(page.getByRole("row")).toHaveCount(1001, { timeout: 30_000 });

    // Открытие «тяжёлого» окна: клик по строке → форма с загрузкой сотрудников.
    const t0 = Date.now();
    await serviceRow(page, "Услуга №0500").click();
    await expect(serviceFields(page).name).toHaveValue("Услуга №0500");
    const openMs = Date.now() - t0;
    expectWithinBudget("открытие ServiceModal при CPU ×4", openMs, 1500);

    // Ввод в поле остаётся плавным: кадр рисуется быстро даже после набора.
    await serviceFields(page).name.pressSequentially(" проверка", { delay: 0 });
    expectWithinBudget("кадр после действия", await frameLatency(page), 500);

    const lt = await longTasks(page);
    expectWithinBudget("самая длинная задача (long task)", lt.max, 1500);
  });

  test("CPU ×6, журнал на 300 записей: список, открытие мастера записи и переход по шагам укладываются в бюджет", async ({
    page,
    api,
  }) => {
    api.db.appointments = bigAppointments(300);
    api.db.services = bigServices(300);
    await throttleCpu(page, 6);

    await openRecords(page);
    await expect(page.getByText("Показано 300 записей")).toBeVisible({ timeout: 30_000 });

    const t0 = Date.now();
    await bookButton(page).click();
    const dlg = bookingDialog(page);
    await expect(dlg).toBeVisible();
    const openMs = Date.now() - t0;
    expectWithinBudget("открытие RecordaModal при CPU ×6", openMs, 2500);

    // Шаг «Услуги» с 300 плитками — самый тяжёлый.
    await stepNav(dlg, "Мастер").click();
    await pickCombo(dlg, /Выберите мастера/, /Иванов Иван/);
    const t1 = Date.now();
    await stepNav(dlg, "Услуги").click();
    await expect(serviceTile(dlg, "Услуга №0001")).toBeVisible();
    expectWithinBudget("рендер шага «Услуги» (300 плиток) при CPU ×6", Date.now() - t1, 2500);

    await serviceTile(dlg, "Услуга №0001").click();
    expectWithinBudget("кадр после действия", await frameLatency(page), 500);

    const lt = await longTasks(page);
    expectWithinBudget("самая длинная задача (long task)", lt.max, 1500);
  });

  test("CPU ×4: дебаунс поиска не копит запросы — на быстрый набор из 10 символов уходит один GET", async ({
    page,
    api,
  }) => {
    await throttleCpu(page, 4);
    await openServices(page);
    const before = api.calls("services", "GET").length;
    await searchBox(page).pressSequentially("Стрижка 12", { delay: 10 });
    await expect(serviceRow(page, "Стрижка")).toHaveCount(0); // «Стрижка 12» ничего не находит
    const after = api.calls("services", "GET").length;
    expect(after - before).toBeLessThanOrEqual(2);
  });
});
