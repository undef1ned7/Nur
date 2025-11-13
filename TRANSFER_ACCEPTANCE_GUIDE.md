# Руководство по системе передач и приёмок

## Обзор

Система передач и приёмок позволяет управлять движением товаров между агентами и отслеживать их статус. Система состоит из двух основных компонентов:

1. **ManufactureSubreal (Передачи)** - создание передач товаров агентам
2. **Acceptance (Приёмки)** - приёмка товаров от агентов

## API Endpoints

### 1. Передачи (ManufactureSubreal)

#### GET /api/main/subreals/

Получить список всех передач компании

```javascript
// Response
{
  "results": [
    {
      "id": "uuid",
      "company": "uuid-компании",
      "user": "uuid-создателя",
      "agent": "uuid-агента",
      "agent_name": "Иван Иванов",
      "product": "uuid-товара",
      "product_name": "Хлеб",
      "qty_transferred": 100,
      "qty_accepted": 0,
      "qty_remaining": 100,
      "status": "open",
      "created_at": "2025-09-27T12:34:56Z"
    }
  ]
}
```

#### POST /api/main/subreals/

Создать новую передачу

```javascript
// Request
{
  "agent": "uuid-пользователя-агента",
  "product": "uuid-товара",
  "qty_transferred": 100
}

// Response
{
  "id": "uuid",
  "company": "uuid-компании",
  "user": "uuid-создателя",
  "agent": "uuid-агента",
  "agent_name": "Иван Иванов",
  "product": "uuid-товара",
  "product_name": "Хлеб",
  "qty_transferred": 100,
  "qty_accepted": 0,
  "qty_remaining": 100,
  "status": "open",
  "created_at": "2025-09-27T12:34:56Z"
}
```

### 2. Приёмки (Acceptance)

#### GET /api/main/acceptances/

Получить список всех приёмок

```javascript
// Response
{
  "results": [
    {
      "id": "uuid",
      "company": "uuid-компании",
      "subreal": "uuid-передачи",
      "accepted_by": "uuid-пользователя",
      "qty": 20,
      "accepted_at": "2025-09-27T12:40:00Z"
    }
  ]
}
```

#### POST /api/main/acceptances/

Создать приёмку вручную

```javascript
// Request
{
  "subreal": "uuid-передачи",
  "qty": 20
}

// Response
{
  "id": "uuid",
  "company": "uuid-компании",
  "subreal": "uuid-передачи",
  "accepted_by": "uuid-пользователя",
  "qty": 20,
  "accepted_at": "2025-09-27T12:40:00Z"
}
```

### 3. Inline приёмка

#### POST /api/main/accept/

Упрощённый эндпоинт для создания приёмки

```javascript
// Request
{
  "agent_id": "uuid-агента",
  "product_id": "uuid-товара",
  "qty": 30
}

// Response
{
  "agent": "Иван Иванов",
  "product": "Хлеб",
  "qty_transferred": 100,
  "qty_accept": 30,
  "qty_remaining_after": 70
}
```

## Redux Integration

### Store Structure

```javascript
// store/slices/transferSlice.js
{
  list: [],           // список передач
  current: null,      // текущая передача
  loading: false,     // загрузка
  error: null,        // ошибки
  creating: false,    // создание
  createError: null,  // ошибки создания
  // ... другие состояния
}

// store/slices/acceptanceSlice.js
{
  list: [],              // список приёмок
  current: null,         // текущая приёмка
  loading: false,        // загрузка
  error: null,          // ошибки
  creating: false,      // создание
  createError: null,    // ошибки создания
  acceptingInline: false, // inline приёмка
  acceptInlineError: null, // ошибки inline приёмки
  // ... другие состояния
}
```

### Actions

```javascript
// Передачи
import {
  fetchTransfersAsync,
  createTransferAsync,
  getTransferAsync,
  updateTransferAsync,
  deleteTransferAsync,
} from "../store/creators/transferCreators";

// Приёмки
import {
  fetchAcceptancesAsync,
  createAcceptanceAsync,
  getAcceptanceAsync,
  updateAcceptanceAsync,
  deleteAcceptanceAsync,
  acceptInlineAsync,
} from "../store/creators/transferCreators";
```

## Использование в компонентах

### 1. Создание передачи

```javascript
import { useDispatch, useSelector } from 'react-redux';
import { createTransferAsync } from '../store/creators/transferCreators';

const TransferModal = ({ onClose, item }) => {
  const dispatch = useDispatch();
  const { creating, createError } = useSelector((state) => state.transfer);

  const handleSubmit = async (transferData) => {
    try {
      await dispatch(createTransferAsync(transferData)).unwrap();
      onClose();
    } catch (error) {
      console.error('Transfer creation failed:', error);
    }
  };

  return (
    // ... форма передачи
  );
};
```

### 2. Inline приёмка

```javascript
import { useDispatch, useSelector } from 'react-redux';
import { acceptInlineAsync } from '../store/creators/transferCreators';

const AcceptModal = ({ onClose, item }) => {
  const dispatch = useDispatch();
  const { acceptingInline, acceptInlineError } = useSelector((state) => state.acceptance);

  const handleSubmit = async (acceptData) => {
    try {
      const result = await dispatch(acceptInlineAsync(acceptData)).unwrap();
      alert(`Приёмка успешно создана!\nАгент: ${result.agent}\nТовар: ${result.product}\nПринято: ${result.qty_accept}\nОстаток: ${result.qty_remaining_after}`);
      onClose();
    } catch (error) {
      console.error('Accept creation failed:', error);
    }
  };

  return (
    // ... форма приёмки
  );
};
```

### 3. Использование хуков

```javascript
import { useTransfers, useAcceptances } from "../hooks/useTransfers";

const MyComponent = () => {
  const transfers = useTransfers();
  const acceptances = useAcceptances();

  return (
    <div>
      <h2>Передачи: {transfers.list?.length || 0}</h2>
      <h2>Приёмки: {acceptances.list?.length || 0}</h2>
    </div>
  );
};
```

## Обновлённые компоненты

### TransferProductModal

- Использует `createTransferAsync` для создания передач
- Валидация полей (агент, количество)
- Обработка ошибок и состояний загрузки

### AcceptProductModal

- Использует `acceptInlineAsync` для inline приёмки
- Автоматическое обновление остатков
- Показ результата приёмки

## Тестирование

Для тестирования функциональности создан компонент `TransferTest`:

```javascript
import TransferTest from "./Components/Test/TransferTest";

// Добавить в роутинг для тестирования
<Route path="/test-transfers" component={TransferTest} />;
```

## Workflow

1. **Создание передачи**: Администратор создаёт передачу товара агенту
2. **Приёмка товара**: Агент принимает товар через inline API
3. **Автоматическое закрытие**: Если остаток становится 0, передача автоматически закрывается
4. **Отслеживание**: Все операции логируются и доступны для просмотра

## Обработка ошибок

Система включает полную обработку ошибок:

- Валидация данных на клиенте
- Обработка ошибок API
- Показ пользователю понятных сообщений об ошибках
- Логирование ошибок в консоль для отладки

## Безопасность

- Все операции требуют авторизации
- Валидация данных на сервере
- Проверка прав доступа к операциям
- Логирование всех действий пользователей
