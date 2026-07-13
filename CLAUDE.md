# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NUR CRM — многопрофильная CRM (React 18 + Vite SPA) для разных отраслей бизнеса. UI, комментарии и коммиты — преимущественно на русском. Полная документация проекта: [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).

## Commands

```bash
npm run dev          # dev-сервер Vite (проксирует /api на DEV_BACKEND из .env, по умолчанию http://localhost:8000)
npm run build        # production-сборка
npm run lint         # eslint .
npm test             # vitest run (все тесты)
npx vitest run src/ProtectedRoute.test.jsx   # один тестовый файл
npm run printer-bridge   # локальный мост для принтера (tools/printer-bridge.mjs)
```

Тесты: Vitest + jsdom + Testing Library, setup в `src/test/setup.js`. Тесты лежат рядом с кодом (`*.test.jsx`), плюс `tools/**/*.test.js`.

## Architecture

Приложение разделено по «секторам» бизнеса (barber, market, cafe, building, hostel, school, production, warehouse, consulting, logistics, pilorama). Активный сектор берётся из профиля компании и определяет меню и доступные маршруты.

- **Роутинг**: публичные маршруты — `src/config/routes.jsx`; все CRM-маршруты (под `/crm`, внутри `Layout`) — `src/config/crmRoutes.jsx` (~765 строк, лениво загружается в `src/App.jsx` и строится от `profile`). Меню секторов — `src/Components/Sectors/registry.js`.
- **Компоненты секторов**: `src/Components/Sectors/<Sector>/`. `src/Components/Deposits/` — legacy общие модули (Sklad, Kassa, Vitrina, Zakaz и т.д.), переиспользуются несколькими секторами — правки там влияют сразу на несколько секторов.
- **Redux**: `src/store/index.js` — ~29 общих slices в `src/store/slices/` + 18 building-slices в `src/store/slices/building/`. Async thunks вынесены в `src/store/creators/` (38 файлов).
- **API-слой**: `src/api/` — модуль на домен; общий axios instance в `src/api/index.js` (baseURL `VITE_API_URL`, по умолчанию `https://app.nurcrm.kg/api`). Interceptors: Bearer-токен из `localStorage.accessToken`, refresh-логика в `src/api/authInterceptors.js`, offline-fallback для кафе (`src/services/cafeOfflineFallback.js`, Dexie/IndexedDB в `src/db/`).
- **Auth**: поток логина и guard — `src/ProtectedRoute.jsx` и `src/Components/Auth/AuthGuard/`; токены и профиль в localStorage.
- **PWA/офлайн**: vite-plugin-pwa со strategy `injectManifest`, service worker — `src/sw.js`. Также есть Electron-упаковка (electron-builder).
- **Стили**: SCSS-модули (`*.module.scss`) в старом коде + Tailwind 4 в новом; UI-киты MUI и Radix используются параллельно.

## Environment

`.env` (см. `.env.example`): `VITE_API_URL`, `VITE_WS_API_URL`, `DEV_BACKEND` (прокси dev-сервера), `VITE_REGISTER_ACCESS_*`.
