# Структура модулей компонента Warehouse

## Обзор

Компонент `Warehouse` разделен на модули и компоненты для улучшения поддерживаемости, переиспользования и тестируемости кода.

## Структура файлов

```
Warehouse/
├── Warehouse.jsx              # Основной компонент (оркестратор)
├── Warehouse.scss             # Основные стили
├── constants.js               # Константы и конфигурация
├── utils.js                   # Утилиты форматирования
├── components/                # UI компоненты
│   ├── WarehouseHeader.jsx   # Заголовок склада
│   ├── SearchSection.jsx     # Секция поиска и фильтров
│   ├── BulkActionsBar.jsx    # Панель массовых действий
│   ├── ProductTable.jsx       # Таблица товаров
│   ├── ProductCards.jsx       # Карточки товаров
│   ├── Pagination.jsx        # Компонент пагинации
│   ├── FilterModal.jsx       # Модальное окно фильтров
│   └── index.js              # Экспорт компонентов
├── hooks/                     # Кастомные хуки
│   ├── useSearch.js          # Хук для поиска с debounce
│   ├── usePagination.js      # Хук для пагинации
│   ├── useProductSelection.js # Хук для выбора товаров
│   ├── useWarehouseData.js   # Хук для загрузки данных
│   └── index.js              # Экспорт хуков
└── WAREHOUSE_STRUCTURE.md     # Эта документация
```

## Модули

### constants.js
Константы и конфигурация:
- `STORAGE_KEY` - ключ для localStorage
- `PAGE_SIZE` - размер страницы (100)
- `DEBOUNCE_DELAY` - задержка debounce (300ms)
- `VIEW_MODES` - режимы отображения (TABLE, CARDS)
- `getInitialViewMode()` - функция определения начального режима

### utils.js
Утилиты форматирования:
- `formatPrice(price)` - форматирование цены
- `formatStock(stock)` - форматирование остатков
- `getPrimaryImage(product)` - получение основного изображения
- `formatDeleteMessage(count)` - форматирование сообщения удаления

## Хуки

### useSearch.js
Управление поиском с debounce:
```javascript
const { searchTerm, debouncedSearchTerm, setSearchTerm } = useSearch();
```

### usePagination.js
Управление пагинацией:
```javascript
const {
  currentPage,
  totalPages,
  hasNextPage,
  hasPrevPage,
  getRowNumber,
  handlePageChange,
  resetToFirstPage,
} = usePagination(count, next, previous);
```

### useProductSelection.js
Управление выбором товаров:
```javascript
const {
  selectedRows,
  isAllSelected,
  selectedCount,
  handleRowSelect,
  handleSelectAll,
  clearSelection,
} = useProductSelection(products);
```

### useWarehouseData.js
Загрузка данных склада:
```javascript
// Загрузка товаров
const { products, loading, count, next, previous } = 
  useWarehouseData(requestParams);

// Загрузка справочников
const { brands, categories } = useWarehouseReferences();
```

## Компоненты

### WarehouseHeader
Заголовок склада с кнопкой создания товара.

**Props:**
- `onCreateProduct` - функция создания товара

### SearchSection
Секция поиска и переключения режимов отображения.

**Props:**
- `searchTerm` - текущий поисковый запрос
- `onSearchChange` - обработчик изменения поиска
- `viewMode` - текущий режим отображения
- `onViewModeChange` - обработчик смены режима
- `onOpenFilters` - обработчик открытия фильтров
- `count` - общее количество товаров
- `foundCount` - количество найденных товаров

### BulkActionsBar
Панель массовых действий (отображается при выборе товаров).

**Props:**
- `selectedCount` - количество выбранных товаров
- `onClearSelection` - обработчик сброса выбора
- `onBulkDelete` - обработчик массового удаления
- `isDeleting` - флаг процесса удаления

### ProductTable
Таблица товаров.

**Props:**
- `products` - массив товаров
- `loading` - состояние загрузки
- `selectedRows` - Set выбранных товаров
- `isAllSelected` - флаг "выбрано все"
- `onRowSelect` - обработчик выбора строки
- `onSelectAll` - обработчик выбора всех
- `onProductClick` - обработчик клика по товару
- `getRowNumber` - функция получения номера строки

### ProductCards
Карточки товаров.

**Props:** (те же что и ProductTable)

### Pagination
Компонент пагинации.

**Props:**
- `currentPage` - текущая страница
- `totalPages` - общее количество страниц
- `count` - общее количество элементов
- `loading` - состояние загрузки
- `hasNextPage` - наличие следующей страницы
- `hasPrevPage` - наличие предыдущей страницы
- `onPageChange` - обработчик смены страницы

## Основной компонент Warehouse.jsx

Оркестрирует все модули и компоненты:
- Управляет состоянием фильтров и модальных окон
- Координирует работу хуков
- Обрабатывает бизнес-логику (массовое удаление, применение фильтров)
- Рендерит дочерние компоненты

## Преимущества модульной структуры

1. **Переиспользование** - компоненты и хуки можно использовать в других местах
2. **Тестируемость** - каждый модуль можно тестировать отдельно
3. **Поддерживаемость** - легче находить и исправлять ошибки
4. **Читаемость** - код более структурирован и понятен
5. **Производительность** - React.memo предотвращает лишние ререндеры

## Использование

```javascript
import Warehouse from "./Warehouse";

// В роутере
<Route path="/warehouse" element={<Warehouse />} />
```

## Зависимости

- React, React Router
- Redux Toolkit
- Lucide React (иконки)
- SCSS для стилей

