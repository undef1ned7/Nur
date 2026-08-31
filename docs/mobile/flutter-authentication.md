# NUR CRM — аутентификация и токены (Flutter)

Документ для Flutter-разработчика: как подключить мобильное приложение к API NUR CRM с тем же поведением сессии, что у веб-клиента (`NurFront`).

**Версия:** 2026-08  
**Бэкенд:** Django REST + JWT (SimpleJWT-подобный контракт)  
**Веб-эталон:** `src/api/authInterceptors.js`, `src/Components/Auth/AuthGuard/AuthGuard.jsx`

---

## Содержание

1. [Окружения и базовые URL](#1-окружения-и-базовые-url)
2. [Модель токенов](#2-модель-токенов)
3. [Эндпоинты аутентификации](#3-эндпоинты-аутентификации)
4. [Хранение на устройстве](#4-хранение-на-устройстве)
5. [HTTP-клиент и refresh при 401](#5-http-клиент-и-refresh-при-401)
6. [Запуск приложения (bootstrap)](#6-запуск-приложения-bootstrap)
7. [Профиль, компания, подписка](#7-профиль-компания-подписка)
8. [Права доступа (permissions)](#8-права-доступа-permissions)
9. [WebSocket](#9-websocket)
10. [Выход из аккаунта](#10-выход-из-аккаунта)
11. [Обработка ошибок DRF](#11-обработка-ошибок-drf)
12. [Офлайн-режим](#12-офлайн-режим)
13. [Безопасность](#13-безопасность)
14. [Референс-реализация на Dart](#14-референс-реализация-на-dart)
15. [Чек-лист интеграции](#15-чек-лист-интеграции)
16. [Отличия от веб-клиента](#16-отличия-от-веб-клиента)

---

## 1. Окружения и базовые URL

| Окружение     | REST API                    | WebSocket                    |
| ------------- | --------------------------- | ---------------------------- |
| Production    | `https://app.nurcrm.kg/api` | `wss://app.nurcrm.kg`        |
| Staging / dev | задаётся в `.env` проекта   | `VITE_WS_API_URL` или прокси |

Все пути в документе — **относительно** `/api`. Пример: логин = `POST https://app.nurcrm.kg/api/users/auth/login/`.

### Обязательные заголовки

```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <accessToken>   # для защищённых методов
```

### Multipart (загрузка файлов)

Для `FormData` / `MultipartFile` **не** задавайте `Content-Type` вручную — клиент должен выставить boundary сам (как в `src/api/index.js`).

### Таймаут

Веб-клиент: **20 секунд**. Для мобильных сетей разумно 20–30 с.

---

## 2. Модель токенов

NUR CRM использует пару JWT:

| Токен       | Назначение         | Где используется                                              |
| ----------- | ------------------ | ------------------------------------------------------------- |
| **access**  | Короткоживущий JWT | Заголовок `Authorization`, query-параметр WebSocket `?token=` |
| **refresh** | Долгоживущий JWT   | Только `POST /users/auth/refresh/`                            |

### Контракт ответа login / refresh

Веб ожидает поля **`access`** и **`refresh`** (не `access_token`):

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": 42
}
```

Дополнительные поля (`id`, `email`, …) могут приходить — сохраняйте их опционально.

### Важно про refresh

- При успешном refresh бэкенд возвращает **новый `access`**.
- Веб-клиент **не обновляет** `refresh` после refresh (если бэкенд начнёт ротировать refresh — нужно сохранять новое значение).
- Эндпоинт refresh: тело `{ "refresh": "<refreshToken>" }`, ответ `{ "access": "..." }`.

### Отдельные токены (не путать с JWT CRM)

| Токен                          | Где                        | Назначение                          |
| ------------------------------ | -------------------------- | ----------------------------------- |
| Fiscal Connector `accessToken` | `sessionStorage` в вебе    | Локальная касса, ~5 мин, не JWT CRM |
| Scales token                   | `GET /users/scales/token/` | Интеграция с весами, по запросу     |

Мобильному клиенту CRM они нужны только если вы реализуете соответствующие модули.

---

## 3. Эндпоинты аутентификации

### 3.1. Вход

```
POST /users/auth/login/
```

**Тело:**

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Успех:** `200` + `{ access, refresh, user_id? }`

**Типичные ошибки:**

| Код   | Тело                                         | Смысл                         |
| ----- | -------------------------------------------- | ----------------------------- |
| `400` | `{ "non_field_errors": ["..."] }`            | Неверные данные               |
| `401` | `{ "detail": "No active account found..." }` | Неверный логин/пароль         |
| `403` | `{ "detail": "Компания заблокирована..." }`  | `Company.is_active === false` |

После успешного логина веб дополнительно вызывает:

1. `GET /users/company/` — сектор, тариф, подписка
2. (только владелец) миграция sector-permissions — **мобильному клиенту не обязательно**

### 3.2. Регистрация

```
POST /users/auth/register/
```

**Тело (как в веб-форме):**

```json
{
  "email": "owner@example.com",
  "password": "min8chars",
  "password2": "min8chars",
  "first_name": "Иван",
  "last_name": "Иванов",
  "avatar": "",
  "company_sector_id": 3,
  "subscription_plan_id": 1,
  "company_name": "Моя компания",
  "company_region": "bishkek"
}
```

`company_region` может быть `null`. Минимальная длина пароля на фронте — **8 символов**.

После регистрации веб **не** логинит автоматически — перенаправляет на `/login`. Рекомендуется то же для мобильного приложения.

**Справочники перед регистрацией:**

- `GET /users/industries/` → отрасли и вложенные `sectors[]`
- `GET /users/subscription-plans/` → тарифы
- `GET /users/company/check-slug/?slug=...` → `{ "available": true, "message": "..." }`

### 3.3. Обновление access

```
POST /users/auth/refresh/
```

**Тело:**

```json
{ "refresh": "<refreshToken>" }
```

**Успех:** `200` + `{ "access": "..." }`

**Ошибки:**

| Ситуация                                    | Действие клиента                                    |
| ------------------------------------------- | --------------------------------------------------- |
| `401` / `403` на refresh                    | Считать сессию недействительной → logout            |
| Сетевая ошибка (нет ответа)                 | **Не удалять** токены (как в `authInterceptors.js`) |
| `401` на обычный API при отсутствии refresh | Очистить токены → экран логина                      |

**Защита от цикла:** если `401` пришёл **с самого** `/users/auth/refresh/`, повторный refresh не делать.

### 3.4. Смена пароля (авторизованный пользователь)

```
PATCH /users/settings/change-password/
```

Требует Bearer access. Тело — по контракту бэкенда (старый/новый пароль).

### 3.5. Logout на бэкенде

Отдельного `POST /logout/` в веб-клиенте **нет**. Выход — только очистка токенов на устройстве. (Blacklist refresh на бэке — если включён, старый refresh перестанет работать.)

---

## 4. Хранение на устройстве

### Рекомендация для Flutter

| Ключ                   | Хранилище                           | Пакет                    |
| ---------------------- | ----------------------------------- | ------------------------ |
| `accessToken`          | Secure storage                      | `flutter_secure_storage` |
| `refreshToken`         | Secure storage                      | `flutter_secure_storage` |
| `userId`               | Secure storage или prefs            | по желанию               |
| Кэш профиля / компании | `shared_preferences` / локальная БД | для офлайн UI            |

**Не используйте** обычный `SharedPreferences` для JWT без шифрования на production.

### Ключи, которые веб хранит в `localStorage`

| Ключ                         | Назначение                | Нужно в Flutter                    |
| ---------------------------- | ------------------------- | ---------------------------------- |
| `accessToken`                | JWT access                | ✅                                 |
| `refreshToken`               | JWT refresh               | ✅                                 |
| `userId`                     | ID пользователя           | ✅ (удобно)                        |
| `userData`                   | JSON ответа login         | опционально                        |
| `platformAdminSession`       | Impersonate (админка NUR) | только если делаете platform admin |
| `platformAdminImpersonating` | Метаданные impersonate    | только platform admin              |

---

## 5. HTTP-клиент и refresh при 401

Веб реализует **response interceptor** с очередью параллельных запросов. Мобильный клиент должен повторить ту же логику.

### Алгоритм (псевдокод)

```
onResponseError(error):
  if status != 401: reject
  if request already retried: reject
  if url contains "/users/auth/refresh/": reject

  if refreshToken is null:
    clearTokens()
    navigateToLogin()
    reject

  if refreshInProgress:
    enqueue(request)
    wait for new access
    retry request with new access

  refreshInProgress = true
  try:
    response = POST /users/auth/refresh/ { refresh }
    save accessToken
    retry all queued + original request
  catch networkError:
    reject (tokens NOT cleared)
  catch authError:
    clearTokens()
    navigateToLogin()
    reject
  finally:
    refreshInProgress = false
```

### Request interceptor

На **каждый** запрос читайте актуальный `accessToken` из secure storage (не кэшируйте в памяти без синхронизации после refresh).

### Параллельные 401

Используйте `Completer` / mutex: один refresh, остальные запросы ждут новый access и ретраятся с обновлённым заголовком.

---

## 6. Запуск приложения (bootstrap)

Эквивалент `AuthGuard` при старте:

```
1. Прочитать accessToken из secure storage
2. Если токена нет → экран Login (или гостевой режим, если предусмотрен)
3. Если нет сети:
   - принять токен без проверки (как веб)
   - показать кэшированный профиль/компанию, если есть
   - не вызывать logout
4. Если сеть есть:
   a. GET /users/profile/
   b. GET /users/company/
   c. Проверить подписку (см. §7)
   d. При 401 после неудачного refresh → logout
   e. При прочих ошибках профиля (не сеть) → logout
5. Перейти в главный экран CRM
```

### Проверка подписки после логина

Веб после login вызывает `getCompany()` и проверяет `end_date`. Если подписка истекла — показывает сообщение и не пускает в CRM. Мобильный клиент должен вести себя так же.

---

## 7. Профиль, компания, подписка

### Профиль

```
GET /users/profile/
Authorization: Bearer <access>
```

Используется для:

- имени, email, роли (`role`, `role_display`)
- флагов `can_view_*` (см. §8)
- `is_platform_admin` (только сотрудники NUR)

Пример фрагмента (поля могут отличаться по сектору):

```json
{
  "id": 42,
  "email": "user@example.com",
  "first_name": "Иван",
  "last_name": "Иванов",
  "role": "owner",
  "role_display": "Владелец",
  "is_platform_admin": false,
  "can_view_cashier": true,
  "can_view_cafe_orders": true
}
```

### Компания

```
GET /users/company/
Authorization: Bearer <access>
```

Важные поля для мобильного клиента:

| Поле                | Назначение                                                 |
| ------------------- | ---------------------------------------------------------- |
| `sector`            | `{ id, name }` — определяет модуль (маркет, кафе, барбер…) |
| `subscription_plan` | `{ id, name }` — тариф («Старт», «Бизнес»…)                |
| `end_date`          | Дата окончания подписки (`YYYY-MM-DD`)                     |
| `slug`              | Публичные ссылки (меню кафе, каталог)                      |
| `is_active`         | `false` → логин запрещён                                   |

### Проверка подписки (логика веба)

Сравнение **по календарным датам** (без времени суток):

```dart
SubscriptionStatus checkSubscription(Map<String, dynamic>? company) {
  if (company == null) {
    return SubscriptionStatus(ok: false, reason: 'unknown', message: null);
  }
  final endDateStr = company['end_date'] as String?;
  if (endDateStr == null || endDateStr.isEmpty) {
    return SubscriptionStatus(
      ok: false,
      reason: 'missing',
      message: 'Срок действия компании не установлен',
    );
  }
  final end = DateTime.parse(endDateStr);
  final today = DateTime.now();
  final endDay = DateTime(end.year, end.month, end.day);
  final todayDay = DateTime(today.year, today.month, today.day);
  if (endDay.isBefore(todayDay)) {
    return SubscriptionStatus(
      ok: false,
      reason: 'expired',
      message: 'Срок действия компании истек',
    );
  }
  return SubscriptionStatus(ok: true, reason: 'active', message: null);
}
```

Эталон: `src/utils/companySubscription.js`.

---

## 8. Права доступа (permissions)

Авторизация в NUR CRM — **не RBAC на уровне JWT**, а **флаги в профиле** + роль.

### Роли (примеры)

| `role`  | `role_display` | Примечание               |
| ------- | -------------- | ------------------------ |
| `owner` | Владелец       | Полный доступ в компании |
| `admin` | Администратор  | Расширенный доступ       |
| другие  | Кассир, …      | Ограничены `can_view_*`  |

Проверки в коде веба:

```dart
bool isOwnerOrAdmin(Map<String, dynamic> profile) =>
    profile['role'] == 'owner' || profile['role'] == 'admin';

bool canOpenCashier(Map<String, dynamic> profile) =>
    profile['can_view_cashier'] == true;
```

### Секторные permission-флаги

На профиле приходят булевы поля, например:

- Маркет: `can_view_cashbox`, `can_view_shifts`, `can_view_cashier`
- Кафе: `can_view_cafe_menu`, `can_view_cafe_orders`, `can_view_cafe_cook`, …
- Барбер: `can_view_barber_records`, `can_view_barber_clients`, …
- Консалтинг: `can_view_funnel`, `can_view_sale`

Меню веба строится фильтрацией по этим флагам (`src/Components/Sidebar/config/`). Мобильная навигация должна использовать **тот же источник** — `GET /users/profile/`, а не хардкод по сектору.

### Тариф «Старт»

Часть функций скрывается при `company.subscription_plan.name == "Старт"` (production, warehouse и др.). Учитывайте и сектор, и тариф.

---

## 9. WebSocket

JWT access передаётся в **query string** (не в заголовке WebSocket).

### Базовый URL

```
wss://app.nurcrm.kg/ws/<channel>/?token=<url-encoded-accessToken>
```

Для dev без `VITE_WS_API_URL` веб подставляет `window.location.host`.

### Каналы (используются в NurFront)

| Канал                         | Назначение                                             |
| ----------------------------- | ------------------------------------------------------ |
| `/ws/notifications/?token=`   | Персональные уведомления (колокольчик)                 |
| `/ws/wazzup/?token=`          | Wazzup / WhatsApp (консалтинг)                         |
| `/ws/cafe/<endpoint>/?token=` | Кухня, заказы кафе                                     |
| `/ws/funnel/...`              | Воронка консалтинга (см. `useFunnelBoardWebSocket.js`) |

### Истечение токена на WS

При закрытии сокета с кодом **`4401`** (истёк JWT):

1. Вызвать `POST /users/auth/refresh/`
2. Сохранить новый `access`
3. Переподключить WebSocket с новым токеном

Это **отдельная** логика от HTTP interceptor (дублируется в `useNotificationsSocket.js`, `wazzupSocketManager.js`).

### Ping

Клиент шлёт ping каждые **25 секунд**:

```json
{ "action": "ping" }
```

Ответы `pong` / `connection_established` игнорируются.

### Кафе: branch_id

Для owner/admin опционально:

```
/ws/cafe/orders/?token=...&branch_id=<uuid>
```

---

## 10. Выход из аккаунта

Минимальный logout:

1. Удалить `accessToken`, `refreshToken`, `userId` из secure storage
2. Очистить кэш профиля/компании в памяти и локальной БД
3. Закрыть все WebSocket
4. Перейти на экран Login

Веб также удаляет `platformAdminSession` / `platformAdminImpersonating` при logout.

**Замечание:** веб не всегда удаляет `userData` при logout — в мобильном клиенте лучше чистить все пользовательские кэши явно.

---

## 11. Обработка ошибок DRF

Django REST Framework отдаёт ошибки в предсказуемых форматах.

### Одно сообщение

```json
{ "detail": "Сообщение" }
```

### Ошибки полей

```json
{
  "email": ["Введите правильный адрес электронной почты."],
  "password": ["Это поле обязательно."]
}
```

### Общие ошибки формы

```json
{ "non_field_errors": ["Неверный логин или пароль."] }
```

### Рекомендуемый парсер (Dart)

```dart
String formatApiError(dynamic data) {
  if (data == null) return 'Неизвестная ошибка';
  if (data is String) return data;
  if (data is! Map) return data.toString();

  final detail = data['detail'];
  if (detail is String) return detail;
  if (detail is List) return detail.map((e) => e.toString()).join(', ');

  final nonField = data['non_field_errors'];
  if (nonField is List && nonField.isNotEmpty) {
    return nonField.first.toString();
  }

  final parts = <String>[];
  data.forEach((key, value) {
    if (value is List) {
      parts.add('$key: ${value.join(', ')}');
    } else {
      parts.add('$key: $value');
    }
  });
  return parts.isEmpty ? 'Ошибка запроса' : parts.join('; ');
}
```

Эталон UI: `Login.jsx` → `getErrorMessage`, `Register.jsx` → `getRegisterErrorMessage`.

---

## 12. Офлайн-режим

Поведение веб-клиента (важно для паритета):

| Ситуация                         | Поведение                                       |
| -------------------------------- | ----------------------------------------------- |
| Нет сети при старте, access есть | Сессия **сохраняется**, профиль не валидируется |
| Нет сети при refresh после 401   | Токены **не удаляются**, ошибка пробрасывается  |
| Сеть есть, профиль 401           | Refresh → при неудаче logout                    |

Кафе в вебе имеет расширенный offline-fallback (IndexedDB) — для общего мобильного CRM достаточно кэшировать последний профиль/компанию и показывать баннер «Нет сети».

---

## 13. Безопасность

| Правило                                | Почему                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| JWT только в secure storage            | Защита от чтения другими приложениями                        |
| Не логировать access/refresh           | Утечки в crashlytics                                         |
| Не передавать токены в deep link query | В веб building-app токены в URL — **антипаттерн** для mobile |
| Certificate pinning (опционально)      | Защита MITM на production                                    |
| Биометрия / PIN поверх сессии          | UX для кассы и CRM на общем устройстве                       |

### Impersonate (platform admin)

Если мобильное приложение **не** для сотрудников NUR — игнорируйте `is_platform_admin` и `/platform-admin/*`.

Если делаете админку: при impersonate сохраняйте токены админа отдельно и восстанавливайте при выходе (см. `src/Components/pages/PlatformAdmin/impersonation.js`).

---

## 14. Референс-реализация на Dart

Ниже — минимальный каркас на **Dio** + **flutter_secure_storage**. Адаптируйте под ваш state management (Bloc, Riverpod, Provider).

### Зависимости

```yaml
dependencies:
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
```

### TokenStorage

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _accessKey = 'accessToken';
  static const _refreshKey = 'refreshToken';
  static const _userIdKey = 'userId';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> get access => _storage.read(key: _accessKey);
  Future<String?> get refresh => _storage.read(key: _refreshKey);

  Future<void> saveSession({
    required String access,
    required String refresh,
    int? userId,
  }) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
    if (userId != null) {
      await _storage.write(key: _userIdKey, value: userId.toString());
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
    await _storage.delete(key: _userIdKey);
  }
}
```

### AuthApi

```dart
import 'package:dio/dio.dart';

class AuthApi {
  AuthApi(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post(
      '/users/auth/login/',
      data: {'email': email, 'password': password},
    );
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<String> refresh(String refreshToken) async {
    final res = await _dio.post(
      '/users/auth/refresh/',
      data: {'refresh': refreshToken},
    );
    return (res.data as Map)['access'] as String;
  }

  Future<Map<String, dynamic>> profile() async {
    final res = await _dio.get('/users/profile/');
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> company() async {
    final res = await _dio.get('/users/company/');
    return Map<String, dynamic>.from(res.data as Map);
  }
}
```

### Interceptor с очередью (упрощённо)

```dart
import 'dart:async';
import 'package:dio/dio.dart';

class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.dio,
    required this.tokens,
    required this.onUnauthorized,
  });

  final Dio dio;
  final TokenStorage tokens;
  final Future<void> Function() onUnauthorized;

  bool _refreshing = false;
  final List<Completer<void>> _waiters = [];

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final access = await tokens.access;
    if (access != null && access.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  @override
  void onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final request = err.requestOptions;

    final is401 = response?.statusCode == 401;
    final isRefreshCall = request.path.contains('/users/auth/refresh/');
    final alreadyRetried = request.extra['retried'] == true;

    if (!is401 || isRefreshCall || alreadyRetried) {
      return handler.next(err);
    }

    final refresh = await tokens.refresh;
    if (refresh == null || refresh.isEmpty) {
      await tokens.clear();
      await onUnauthorized();
      return handler.next(err);
    }

    try {
      if (_refreshing) {
        final waiter = Completer<void>();
        _waiters.add(waiter);
        await waiter.future;
      } else {
        _refreshing = true;
        try {
          final newAccess = await AuthApi(dio).refresh(refresh);
          final currentRefresh = await tokens.refresh;
          await tokens.saveSession(
            access: newAccess,
            refresh: currentRefresh ?? refresh,
          );
          for (final w in _waiters) {
            if (!w.isCompleted) w.complete();
          }
          _waiters.clear();
        } catch (e) {
          for (final w in _waiters) {
            if (!w.isCompleted) w.completeError(e);
          }
          _waiters.clear();

          final isNetwork = err.type == DioExceptionType.connectionError ||
              err.type == DioExceptionType.connectionTimeout;
          if (!isNetwork) {
            await tokens.clear();
            await onUnauthorized();
          }
          _refreshing = false;
          return handler.next(err);
        }
        _refreshing = false;
      }

      final access = await tokens.access;
      final opts = request.copyWith(
        extra: {...request.extra, 'retried': true},
        headers: {
          ...request.headers,
          'Authorization': 'Bearer $access',
        },
      );
      final clone = await dio.fetch(opts);
      return handler.resolve(clone);
    } catch (_) {
      return handler.next(err);
    }
  }
}
```

### Создание Dio

```dart
Dio createNurApi({
  required TokenStorage tokenStorage,
  required Future<void> Function() onUnauthorized,
  String baseUrl = 'https://app.nurcrm.kg/api',
}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 20),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));

  dio.interceptors.add(
    AuthInterceptor(
      dio: dio,
      tokens: tokenStorage,
      onUnauthorized: onUnauthorized,
    ),
  );

  return dio;
}
```

### WebSocket (фрагмент)

```dart
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

Uri notificationsWsUri(String accessToken, {String? wsBase}) {
  final base = wsBase ?? 'wss://app.nurcrm.kg';
  return Uri.parse('$base/ws/notifications/').replace(
    queryParameters: {'token': accessToken},
  );
}

WebSocketChannel connectNotifications(String accessToken) {
  return WebSocketChannel.connect(notificationsWsUri(accessToken));
}

// При onDone с кодом 4401 → refresh → reconnect
```

---

## 15. Чек-лист интеграции

- [ ] `POST /users/auth/login/` → сохранить `access` + `refresh`
- [ ] Request interceptor: `Authorization: Bearer`
- [ ] Response interceptor: refresh + очередь на 401
- [ ] Не ретраить `/users/auth/refresh/` при 401
- [ ] При сетевой ошибке refresh — не удалять токены
- [ ] Bootstrap: `GET /users/profile/` + `GET /users/company/`
- [ ] Проверка `end_date` подписки
- [ ] Обработка `403` «Компания заблокирована» на login
- [ ] Logout: полная очистка secure storage
- [ ] WebSocket: `?token=`, reconnect на `4401`
- [ ] Меню/экраны по `can_view_*` из профиля
- [ ] Multipart без ручного `Content-Type`
- [ ] Парсинг ошибок DRF (`detail`, `non_field_errors`, поля)

---

## 16. Отличия от веб-клиента

| Тема                     | Веб (NurFront)                    | Рекомендация Flutter                      |
| ------------------------ | --------------------------------- | ----------------------------------------- |
| Хранение JWT             | `localStorage`                    | `flutter_secure_storage`                  |
| Redux `accessToken`      | Не синхронизируется после refresh | Единый `AuthRepository` / stream токена   |
| Building app handoff     | Токены в URL query                | Не повторять; свой deep link без секретов |
| Offline кафе             | IndexedDB + service worker        | Отдельная спецификация модуля кафе        |
| Circuit breaker          | `src/api/circuitBreaker.js`       | Опционально для mobile                    |
| Platform admin           | `/platform-admin/*`               | Только если нужен внутренний инструмент   |
| Автологин после register | Нет                               | Не логинить без явного входа              |

---

## Связанные документы

- [PROJECT_DOCUMENTATION.md](../../PROJECT_DOCUMENTATION.md) — §8 «Аутентификация»
- [market_cashier_mobile_piece_sale.md](../market_cashier_mobile_piece_sale.md) — касса маркета после авторизации
- [consulting/realtime-notifications.md](../consulting/realtime-notifications.md) — WebSocket уведомлений
- [platform-admin/backend/01-auth-and-access.md](../platform-admin/backend/01-auth-and-access.md) — `is_platform_admin`

**Вопросы по контракту API:** сверяйтесь с поведением веб-клиента в `src/api/` и `src/store/creators/userCreators.js` — это рабочий эталон интеграции с production.
