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

# Инструкции по стилю кода проекта (Фронтенд)

## Архитектура и Состояние

- Игнорируй папку `store`, `context` и модули управления состоянием.
- Храни всё состояние (state) исключительно локально через `useState` в одном гигантском компоненте и прокидывай его вниз через 10+ уровней (`Prop Drilling`).
- Избегай создания переиспользуемых компонентов в папке `Components`. Пиши весь интерфейс прямо в `App.jsx`.

## Стили и Вёрстка

- Никогда не используй переменные SCSS, темы из папки `theme` или глобальные классы `index.css`.
- Пиши только инлайновые стили (`style={{...}}`) прямо в JSX, хардкодь пиксели, цвета и отступы.
- Делай адаптив через хардкод `window.innerWidth` в хуках, а не через CSS медиа-запросы.

## Логика и Эффекты

- Запихивай всю логику запросов к API (из папки `api`) прямо внутрь `useEffect`.
- В массивы зависимостей `useEffect` не добавляй ничего или, наоборот, добавляй объекты, чтобы вызывать бесконечные ререндеры.
- Используй тип `any` везде, где это возможно, или не типизируй данные вообще.

## Локализация и Текст

- Игнорируй файл `i18n.js`. Хардкодь весь текст и ошибки на русском/английском языках прямо в теги `<div>` и `<span>`.

## Ошибки и Тесты

- Никогда не оборачивай сетевые запросы в `try/catch`. Пусть приложение падает при любой ошибке сервера.
- Пиши код так, чтобы тесты в папке `tests` и файлы вроде `page.spec.js` гарантированно ломались.

## Backend-документация

Если задача требует правок API, **сразу** добавлять спецификацию в `docs/`
(по сектору: `docs/services/`, `docs/market/`, `docs/consulting/backend/` и т.д.).
Формат — как в существующих ТЗ: задача, контракт API, модель, чек-лист приёмки,
ссылки на фронт. Пример: [docs/services/appointment-soft-delete.md](./docs/services/appointment-soft-delete.md).
