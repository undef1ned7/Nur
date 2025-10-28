# Интеграция корзины в каталог товаров

## Описание

Добавлена кнопка корзины в компонент ProductionCatalog с возможностью открытия корзины в модальном окне.

## Новая функциональность

### ✅ Реализовано

- **Кнопка корзины** в панели управления каталогом
- **Счетчик товаров** в корзине с бейджем
- **Модальное окно корзины** с полным функционалом
- **Анимация кнопки** при добавлении товаров
- **Адаптивный дизайн** для всех устройств
- **Закрытие модального окна** по клику вне области

## Компоненты

### Кнопка корзины

```jsx
<button className="cart-btn" onClick={handleOpenCart}>
  <ShoppingCart size={20} />
  Корзина
  {cartItemsCount > 0 && <span className="cart-badge">{cartItemsCount}</span>}
</button>
```

**Особенности:**

- Красная кнопка с иконкой корзины
- Счетчик товаров в виде бейджа
- Анимация при добавлении товаров
- Hover эффекты

### Модальное окно корзины

```jsx
{
  showCart && (
    <div className="cart-modal-overlay" onClick={handleCloseCart}>
      <div className="cart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cart-modal-header">
          <h2>Корзина</h2>
          <button className="close-cart-btn" onClick={handleCloseCart}>
            ×
          </button>
        </div>
        <div className="cart-modal-content">
          <Cart />
        </div>
      </div>
    </div>
  );
}
```

**Особенности:**

- Полноэкранное модальное окно
- Заголовок с кнопкой закрытия
- Встроенный компонент Cart
- Закрытие по клику вне области

## Redux интеграция

### Селекторы

```javascript
// Получение количества товаров в корзине
const cartItemsCount = useSelector(selectCartItemsCount);

// Добавление товара в корзину
const handleAddToCart = (product) => {
  dispatch(
    addToCart({
      product,
      quantity: 1,
      store: "Default Store",
    })
  );
};
```

### Состояние

```javascript
const [showCart, setShowCart] = useState(false);

const handleOpenCart = () => {
  setShowCart(true);
};

const handleCloseCart = () => {
  setShowCart(false);
};
```

## Стили

### Кнопка корзины

```scss
.cart-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  background: #dc3545;
  color: white;
  border: 2px solid #dc3545;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  transform: scale(1);

  &:hover {
    background: #c82333;
    border-color: #c82333;
    transform: translateY(-2px) scale(1.05);
  }

  .cart-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ffd600;
    color: #333;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: bold;
    border: 2px solid white;
  }
}
```

### Модальное окно

```scss
.cart-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.cart-modal {
  background: white;
  border-radius: 12px;
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  position: relative;
}
```

## Анимации

### Анимация кнопки при добавлении товара

```javascript
const handleAddToCart = (product) => {
  dispatch(
    addToCart({
      product,
      quantity: 1,
      store: "Default Store",
    })
  );

  // Анимация кнопки корзины
  const cartBtn = document.querySelector(".cart-btn");
  if (cartBtn) {
    cartBtn.style.transform = "scale(1.1)";
    setTimeout(() => {
      cartBtn.style.transform = "scale(1)";
    }, 200);
  }
};
```

### CSS переходы

```scss
.cart-btn {
  transition: all 0.3s ease;
  transform: scale(1);

  &:hover {
    transform: translateY(-2px) scale(1.05);
  }
}
```

## Адаптивность

### Desktop (≥1024px)

- Кнопка корзины в панели управления
- Модальное окно по центру экрана
- Полная функциональность

### Tablet (≤1024px)

- Адаптивные размеры модального окна
- Уменьшенные отступы
- Оптимизированная компоновка

### Mobile (≤768px)

- Вертикальная компоновка панели управления
- Кнопка корзины выносится наверх
- Полноэкранное модальное окно
- Увеличенные области касания

## Использование

### Базовое использование

```jsx
import ProductionCatalog from "./Components/Sectors/Production/Catalog/ProductionCatalog";

function App() {
  return <ProductionCatalog />;
}
```

### Программное открытие корзины

```javascript
// В компоненте
const [showCart, setShowCart] = useState(false);

const openCart = () => {
  setShowCart(true);
};

const closeCart = () => {
  setShowCart(false);
};
```

## Интеграция с существующим кодом

### Добавленные импорты

```javascript
import {
  addToCart,
  selectCartItemsCount,
} from "../../../../store/slices/cartSlice";
import Cart from "./Cart";
```

### Новые состояния

```javascript
const cartItemsCount = useSelector(selectCartItemsCount);
const [showCart, setShowCart] = useState(false);
```

### Новые обработчики

```javascript
const handleOpenCart = () => {
  setShowCart(true);
};

const handleCloseCart = () => {
  setShowCart(false);
};
```

## Производительность

### Оптимизации

- **Мемоизация** селекторов Redux
- **Ленивая загрузка** компонента Cart
- **Оптимизированные анимации** с CSS transitions
- **Условный рендеринг** модального окна

### Рекомендации

- Используйте React.memo для компонента Cart
- Оптимизируйте селекторы cartSlice
- Кэшируйте данные корзины
- Реализуйте виртуализацию для больших списков

## Планы развития

### Ближайшие улучшения

- [ ] Уведомления о добавлении товаров
- [ ] Быстрое добавление в корзину
- [ ] Мини-корзина в выпадающем меню
- [ ] Сохранение состояния модального окна

### Дополнительные функции

- [ ] Drag & Drop для товаров в корзину
- [ ] Быстрый заказ из каталога
- [ ] Сравнение товаров
- [ ] Избранные товары
- [ ] История просмотров
