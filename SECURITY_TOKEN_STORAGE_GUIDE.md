# Руководство по безопасному хранению токенов

## Текущая ситуация в проекте

В вашем проекте:

- **Бэкенд возвращает токены в JSON ответе** (не устанавливает HttpOnly cookies)
- **Токены хранятся в `localStorage`** на фронтенде

```javascript
// Бэкенд возвращает:
POST /users/auth/login/
Response: { access: "...", refresh: "...", user: {...} }

// Фронтенд сохраняет:
localStorage.setItem("accessToken", token);
localStorage.setItem("refreshToken", refreshToken);
```

## Проблемы с localStorage

### ❌ Уязвимости:

1. **XSS (Cross-Site Scripting)** - главная угроза

   - Любой JavaScript код на странице может получить доступ к localStorage
   - Если злоумышленник внедрит скрипт (через уязвимость в коде, библиотеке, или через пользовательский ввод), он сможет украсть токены
   - `localStorage` доступен через `window.localStorage` из любого скрипта

2. **Нет защиты от CSRF**

   - localStorage не отправляется автоматически с запросами
   - Но это не защищает от CSRF, если токен отправляется в заголовках

3. **Доступность для всех скриптов**
   - Даже легитимные скрипты (например, расширения браузера) могут читать localStorage

## ✅ Рекомендуемый подход: HttpOnly Cookies

### Преимущества:

1. **Защита от XSS**

   - HttpOnly cookies недоступны через JavaScript (`document.cookie` не вернет их)
   - Даже если злоумышленник внедрит скрипт, он не сможет прочитать токены

2. **Автоматическая отправка**

   - Cookies автоматически отправляются с каждым запросом к домену
   - Не нужно вручную добавлять в заголовки

3. **Дополнительные флаги безопасности**
   - `Secure` - отправка только по HTTPS
   - `SameSite` - защита от CSRF
   - `HttpOnly` - недоступность для JavaScript

### Архитектура с HttpOnly Cookies:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │         │   Backend     │         │   Database   │
│  (Browser)  │         │   (API)       │         │              │
└──────┬──────┘         └──────┬───────┘         └──────┬───────┘
       │                       │                        │
       │ 1. POST /login        │                        │
       │──────────────────────>│                        │
       │                       │ 2. Verify credentials │
       │                       │───────────────────────>│
       │                       │<───────────────────────│
       │                       │                        │
       │ 3. Set-Cookie:        │                        │
       │    access_token=...   │                        │
       │    HttpOnly; Secure   │                        │
       │<──────────────────────│                        │
       │                       │                        │
       │ 4. GET /api/data      │                        │
       │    Cookie: access_... │                        │
       │──────────────────────>│                        │
       │                       │ 5. Validate token     │
       │                       │───────────────────────>│
       │                       │<───────────────────────│
       │ 6. Response           │                        │
       │<──────────────────────│                        │
```

## Защита от XSS (применимо прямо сейчас)

### 1. Content Security Policy (CSP) - КРИТИЧНО!

Добавьте в `public/index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://app.nurcrm.kg;
               font-src 'self' data:;"
/>
```

**Или лучше через заголовки на сервере** (если у вас есть доступ к настройке сервера):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://app.nurcrm.kg;
```

### 2. Санитизация пользовательского ввода

Установите DOMPurify:

```bash
npm install dompurify
```

Используйте везде, где отображаете пользовательский ввод:

```javascript
import DOMPurify from 'dompurify';

// ✅ Безопасно
const safeHtml = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: safeHtml }} />

// ❌ ОПАСНО - не делайте так
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 3. React автоматически защищает

React экранирует данные в JSX:

```jsx
// ✅ Безопасно - React экранирует автоматически
<div>{userInput}</div>
<input value={userInput} />

// ❌ ОПАСНО - используйте только с санитизацией
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 4. Валидация на сервере

Всегда валидируйте данные на бэкенде, даже если валидируете на фронтенде.

### 5. Ограничение доступа к localStorage

Создайте обертку, которая ограничивает доступ:

```javascript
// src/utils/secureStorage.js
class SecureStorage {
  constructor() {
    this.allowedKeys = ["accessToken", "refreshToken", "userData"];
  }

  setItem(key, value) {
    if (!this.allowedKeys.includes(key)) {
      console.warn(`Attempted to set disallowed key: ${key}`);
      return;
    }
    localStorage.setItem(key, value);
  }

  getItem(key) {
    if (!this.allowedKeys.includes(key)) {
      return null;
    }
    return localStorage.getItem(key);
  }

  removeItem(key) {
    if (this.allowedKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  }
}

export const secureStorage = new SecureStorage();
```

### 6. Защита от инъекций в URL

Всегда валидируйте параметры URL:

```javascript
import { useSearchParams } from "react-router-dom";

const MyComponent = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");

  // ✅ Валидация
  if (!userId || !/^\d+$/.test(userId)) {
    return <div>Invalid user ID</div>;
  }

  // Теперь безопасно использовать userId
};
```

## Защита от XSS (общие рекомендации)

Добавьте в `public/index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://app.nurcrm.kg;"
/>
```

### 2. Санитизация пользовательского ввода

```javascript
// Используйте библиотеки для санитизации
import DOMPurify from "dompurify";

const sanitizeInput = (userInput) => {
  return DOMPurify.sanitize(userInput);
};
```

### 3. Валидация на сервере

Всегда валидируйте данные на бэкенде, даже если валидируете на фронтенде.

### 4. Использование React безопасно

React автоматически экранирует данные:

```jsx
// ✅ Безопасно - React экранирует
<div>{userInput}</div>

// ❌ ОПАСНО - не используйте dangerouslySetInnerHTML без санитизации
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## Решения для вашей ситуации

### ⚠️ Ограничение: Бэкенд возвращает токены в JSON

Если бэкенд нельзя изменить (только `/users/auth/login/`, `/users/auth/refresh/`, `/users/auth/register/`), используем компромиссные решения:

---

## Вариант 1: Memory Storage (Рекомендуется, если бэкенд нельзя изменить)

Хранить токены только в памяти JavaScript - они будут недоступны для XSS, но потеряются при перезагрузке страницы.

### Реализация:

```javascript
// src/utils/tokenStorage.js
class TokenStorage {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.storageKey = "token_storage_backup"; // Для восстановления после refresh
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;

    // Опционально: сохраняем только refresh token в sessionStorage
    // для восстановления сессии при случайной перезагрузке
    // НО: это все еще уязвимо к XSS, поэтому лучше не делать
    if (refresh) {
      sessionStorage.setItem(this.storageKey, JSON.stringify({ refresh }));
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    // Сначала пробуем из памяти
    if (this.refreshToken) {
      return this.refreshToken;
    }

    // Если нет в памяти, пробуем восстановить из sessionStorage
    // (только для восстановления сессии)
    try {
      const backup = sessionStorage.getItem(this.storageKey);
      if (backup) {
        const { refresh } = JSON.parse(backup);
        this.refreshToken = refresh;
        return refresh;
      }
    } catch (e) {
      console.error("Failed to restore refresh token:", e);
    }

    return null;
  }

  clear() {
    this.accessToken = null;
    this.refreshToken = null;
    sessionStorage.removeItem(this.storageKey);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
}

export const tokenStorage = new TokenStorage();
```

### Обновление API:

```javascript
// src/api/index.js
import axios from "axios";
import { tokenStorage } from "../utils/tokenStorage";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "https://app.nurcrm.kg/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    const refreshToken = tokenStorage.getRefreshToken();

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return axios(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${
            process.env.REACT_APP_API_BASE_URL || "https://app.nurcrm.kg/api"
          }/users/auth/refresh/`,
          { refresh: refreshToken }
        );

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh || refreshToken;

        // ✅ Сохраняем в память, НЕ в localStorage
        tokenStorage.setTokens(newAccessToken, newRefreshToken);

        api.defaults.headers["Authorization"] = "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] = "Bearer " + newAccessToken;

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        tokenStorage.clear();
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
```

### Обновление логина:

```javascript
// src/store/creators/userCreators.js
import { tokenStorage } from "../../utils/tokenStorage";

export const loginUserAsync = createAsyncThunk(
  "user/login",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await loginUser(formData);
      localStorage.setItem("userData", JSON.stringify(response));

      if (response.access) {
        // ✅ Сохраняем в память, НЕ в localStorage
        tokenStorage.setTokens(response.access, response.refresh || null);

        // Миграция permissions
        try {
          await migrateUserPermissions();
        } catch (migrationError) {
          console.error("Migration failed:", migrationError);
        }
      }

      return response;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Login error" }
      );
    }
  }
);
```

### Обновление logout:

```javascript
// src/utils/authUtils.js
import { tokenStorage } from "./tokenStorage";

export const clearTokens = () => {
  tokenStorage.clear();
};
```

---

## Вариант 2: Улучшенный localStorage с защитой

Если нужно сохранить токены между сессиями, но улучшить безопасность:

### 1. Шифрование токенов перед сохранением

```javascript
// src/utils/tokenEncryption.js
import CryptoJS from "crypto-js";

const SECRET_KEY =
  process.env.REACT_APP_ENCRYPTION_KEY || "default-key-change-me";

export const encryptToken = (token) => {
  if (!token) return null;
  return CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
};

export const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("Decryption error:", e);
    return null;
  }
};
```

### 2. Использование с шифрованием

```javascript
// src/utils/tokenStorage.js
import { encryptToken, decryptToken } from "./tokenEncryption";

class SecureTokenStorage {
  setTokens(access, refresh) {
    if (access) {
      const encrypted = encryptToken(access);
      localStorage.setItem("accessToken", encrypted);
    }
    if (refresh) {
      const encrypted = encryptToken(refresh);
      localStorage.setItem("refreshToken", encrypted);
    }
  }

  getAccessToken() {
    const encrypted = localStorage.getItem("accessToken");
    return encrypted ? decryptToken(encrypted) : null;
  }

  getRefreshToken() {
    const encrypted = localStorage.getItem("refreshToken");
    return encrypted ? decryptToken(encrypted) : null;
  }

  clear() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }
}

export const secureTokenStorage = new SecureTokenStorage();
```

**⚠️ Важно:** Шифрование не защищает от XSS полностью, но усложняет задачу злоумышленнику.

---

## Миграция на HttpOnly Cookies (если бэкенд можно изменить)

### Шаг 1: Изменения на бэкенде

```python
# Django пример
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def login_view(request):
    # ... валидация credentials ...

    response = JsonResponse({
        'user': user_data,
        'message': 'Login successful'
    })

    # Устанавливаем HttpOnly cookies
    response.set_cookie(
        'access_token',
        access_token,
        max_age=15 * 60,  # 15 минут
        httponly=True,
        secure=True,  # Только HTTPS
        samesite='Lax'  # Защита от CSRF
    )

    response.set_cookie(
        'refresh_token',
        refresh_token,
        max_age=7 * 24 * 60 * 60,  # 7 дней
        httponly=True,
        secure=True,
        samesite='Lax'
    )

    return response
```

### Шаг 2: Изменения на фронтенде

#### Удалите работу с localStorage:

```javascript
// ❌ Удалите это
localStorage.setItem("accessToken", token);
localStorage.getItem("accessToken");
```

#### Обновите axios interceptor:

```javascript
// src/api/index.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "https://app.nurcrm.kg/api",
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true, // ✅ Важно! Отправляет cookies
});

// ✅ Удалите interceptor для добавления токена в заголовки
// Cookies отправляются автоматически

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // ✅ Refresh токен тоже через cookie
        const response = await axios.post(
          "/users/auth/refresh/",
          {},
          { withCredentials: true }
        );

        // ✅ Токен обновлен в cookie автоматически
        return api(originalRequest);
      } catch (err) {
        // ✅ При ошибке редирект на логин
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
```

#### Обновите логин:

```javascript
// src/store/creators/userCreators.js
export const loginUserAsync = createAsyncThunk(
  "user/login",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await loginUser(formData);

      // ✅ Не сохраняем токены в localStorage
      // ✅ Токены теперь в HttpOnly cookies

      localStorage.setItem("userData", JSON.stringify(response));

      return response;
    } catch (error) {
      return rejectWithValue(
        error?.response?.data || { detail: error.message || "Login error" }
      );
    }
  }
);
```

#### Обновите logout:

```javascript
// src/utils/authUtils.js
export const logout = async () => {
  try {
    // ✅ Отправляем запрос на бэкенд для очистки cookies
    await api.post("/users/auth/logout/", {}, { withCredentials: true });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Очищаем только userData из localStorage
    localStorage.removeItem("userData");
    window.location.href = "/login";
  }
};
```

## Альтернативный подход: Memory Storage

Если по каким-то причинам нельзя использовать HttpOnly cookies, можно хранить токены в памяти:

```javascript
// src/utils/tokenStorage.js
class TokenStorage {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    return this.refreshToken;
  }

  clear() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export const tokenStorage = new TokenStorage();
```

**Плюсы:**

- Недоступно для XSS (если скрипт не имеет прямого доступа к объекту)
- Токены очищаются при перезагрузке страницы

**Минусы:**

- Токены теряются при перезагрузке страницы
- Нужно логиниться заново

## Рекомендации по безопасности

### 1. Content Security Policy (CSP)

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self';"
/>
```

### 2. X-Frame-Options

Защита от clickjacking:

```
X-Frame-Options: DENY
```

### 3. X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

### 4. Сроки жизни токенов

- **Access Token**: 15-30 минут
- **Refresh Token**: 7-30 дней

### 5. Ротация refresh токенов

При каждом обновлении access token выдавайте новый refresh token.

### 6. Rate Limiting

Ограничьте количество попыток входа.

## Чеклист для вашей ситуации (бэкенд возвращает JSON)

### Вариант A: Memory Storage (рекомендуется)

- [ ] Создать `src/utils/tokenStorage.js` с классом TokenStorage
- [ ] Обновить `src/api/index.js` для использования tokenStorage
- [ ] Обновить `src/store/creators/userCreators.js` для использования tokenStorage
- [ ] Удалить все `localStorage.setItem/getItem` для токенов
- [ ] Добавить CSP в `public/index.html`
- [ ] Установить и использовать DOMPurify для санитизации
- [ ] Протестировать логин/логаут/refresh

### Вариант B: Улучшенный localStorage

- [ ] Установить `crypto-js`: `npm install crypto-js`
- [ ] Создать `src/utils/tokenEncryption.js`
- [ ] Создать `src/utils/tokenStorage.js` с шифрованием
- [ ] Обновить все места использования токенов
- [ ] Добавить CSP в `public/index.html`
- [ ] Установить и использовать DOMPurify

### Обязательно для обоих вариантов:

- [ ] Добавить CSP заголовки (в `public/index.html` или на сервере)
- [ ] Установить DOMPurify: `npm install dompurify`
- [ ] Проверить все места с `dangerouslySetInnerHTML`
- [ ] Валидировать все пользовательские вводы
- [ ] Настроить CORS на бэкенде (если еще не настроен)

## Заключение для вашей ситуации

**Текущее состояние:** ⚠️ Уязвимо к XSS (токены в localStorage)

**Ваша ситуация:** Бэкенд возвращает токены в JSON (`/users/auth/login/`, `/users/auth/refresh/`)

**Рекомендации:**

1. **Краткосрочно (можно сделать сейчас):**

   - ✅ Перейти на Memory Storage (токены в памяти, не в localStorage)
   - ✅ Добавить CSP заголовки
   - ✅ Использовать DOMPurify для санитизации
   - ✅ Валидировать все пользовательские вводы

2. **Среднесрочно (если можно изменить бэкенд):**

   - ✅ Мигрировать на HttpOnly Cookies (лучший вариант)
   - ✅ Настроить CORS для работы с cookies
   - ✅ Добавить флаги Secure и SameSite

3. **Долгосрочно:**
   - ✅ Регулярный аудит безопасности
   - ✅ Мониторинг подозрительной активности
   - ✅ Rate limiting на бэкенде

**Итог:** Даже если бэкенд нельзя изменить, можно значительно улучшить безопасность, используя Memory Storage + CSP + санитизацию. Это защитит от большинства XSS атак.
