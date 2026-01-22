// utils/usePlurize.js
import { useCallback, useMemo } from 'react';

// Кэш для Intl.PluralRules экземпляров
const pluralRulesCache = new Map();

/**
 * Получить экземпляр Intl.PluralRules с кэшированием
 * @param {string} locale - Локаль
 * @returns {Intl.PluralRules} Экземпляр PluralRules
 */
const getPluralRules = (locale = 'ru-RU') => {
  if (!pluralRulesCache.has(locale)) {
    pluralRulesCache.set(locale, new Intl.PluralRules(locale));
  }
  return pluralRulesCache.get(locale);
};

// Кэш для результатов склонений
const pluralResultsCache = new Map();

/**
 * Получить ключ для кэша
 */
const getCacheKey = (count, locale, rules) => {
  return `${locale}:${count}:${JSON.stringify(rules)}`;
};

/**
 * Предопределенные правила для русского языка
 */
export const RUSSIAN_RULES = {
  // Товары
  products: {
    zero: 'товаров',
    one: 'товар',
    few: 'товара',
    many: 'товаров',
    other: 'товаров'
  },
  // Пользователи
  users: {
    zero: 'пользователей',
    one: 'пользователь',
    few: 'пользователя',
    many: 'пользователей',
    other: 'пользователей'
  },
  // Заказы
  orders: {
    zero: 'заказов',
    one: 'заказ',
    few: 'заказа',
    many: 'заказов',
    other: 'заказов'
  },
  // Дни
  days: {
    zero: 'дней',
    one: 'день',
    few: 'дня',
    many: 'дней',
    other: 'дней'
  },
  // Часы
  hours: {
    zero: 'часов',
    one: 'час',
    few: 'часа',
    many: 'часов',
    other: 'часов'
  },
  // Минуты
  minutes: {
    zero: 'минут',
    one: 'минута',
    few: 'минуты',
    many: 'минут',
    other: 'минут'
  },
  // Секунды
  seconds: {
    zero: 'секунд',
    one: 'секунда',
    few: 'секунды',
    many: 'секунд',
    other: 'секунд'
  }
};

/**
 * Предопределенные правила для английского языка
 */
export const ENGLISH_RULES = {
  products: {
    one: 'product',
    other: 'products'
  },
  users: {
    one: 'user',
    other: 'users'
  },
  days: {
    one: 'day',
    other: 'days'
  }
};

/**
 * Основной хук usePlurize
 */
export default function usePlurize() {
  /**
   * Основная функция для склонения слов
   * @param {number} count - Число
   * @param {Object|string} rulesOrKey - Объект правил или ключ из предопределенных правил
   * @param {Object} options - Дополнительные опции
   * @returns {string} Слово в правильной форме
   */
  const plurize = useCallback((count, rulesOrKey, options = {}) => {
    const {
      locale = 'ru-RU',
      showNumber = false,
      formatNumber = false,
      fallback = '',
      useCache = true
    } = options;

    // Получаем абсолютное значение (для отрицательных чисел)
    const absCount = Math.abs(count);
    
    // Получаем правила
    let rules;
    if (typeof rulesOrKey === 'string') {
      // Используем предопределенные правила
      if (locale.startsWith('ru')) {
        rules = RUSSIAN_RULES[rulesOrKey];
      } else if (locale.startsWith('en')) {
        rules = ENGLISH_RULES[rulesOrKey];
      } else {
        // Для других языков пробуем английские правила
        rules = ENGLISH_RULES[rulesOrKey];
      }
    } else {
      // Используем переданные правила
      rules = rulesOrKey;
    }

    // Если правил нет, возвращаем fallback
    if (!rules) {
      return fallback;
    }

    // Проверяем кэш
    if (useCache) {
      const cacheKey = getCacheKey(absCount, locale, rules);
      if (pluralResultsCache.has(cacheKey)) {
        const cachedResult = pluralResultsCache.get(cacheKey);
        if (showNumber) {
          return formatNumber 
            ? `${new Intl.NumberFormat(locale).format(count)} ${cachedResult}`
            : `${count} ${cachedResult}`;
        }
        return cachedResult;
      }
    }

    // Получаем PluralRules
    const pluralRules = getPluralRules(locale);
    
    // Определяем форму
    const form = pluralRules.select(absCount);
    
    // Получаем слово
    let word;
    
    // Для русского языка специальная обработка
    if (locale.startsWith('ru')) {
      // Русский язык: one, few, many
      switch (form) {
        case 'one':
          word = rules.one || rules.other || '';
          break;
        case 'few':
          word = rules.few || rules.other || '';
          break;
        case 'many':
          word = rules.many || rules.other || '';
          break;
        default:
          word = rules.other || '';
      }
    } else {
      // Для других языков используем стандартную логику
      word = rules[form] || rules.other || '';
    }

    // Для нуля используем специальное правило если есть
    if (absCount === 0 && rules.zero) {
      word = rules.zero;
    }

    // Сохраняем в кэш
    if (useCache && word) {
      const cacheKey = getCacheKey(absCount, locale, rules);
      pluralResultsCache.set(cacheKey, word);
    }

    // Форматируем результат
    if (showNumber) {
      const numberToShow = formatNumber 
        ? new Intl.NumberFormat(locale).format(count)
        : count;
      return `${numberToShow} ${word}`;
    }

    return word;
  }, []);

  /**
   * Функция для получения полной строки с числом
   */
  const plurizeWithNumber = useCallback((count, rulesOrKey, options = {}) => {
    return plurize(count, rulesOrKey, { ...options, showNumber: true });
  }, [plurize]);

  /**
   * Функция для форматирования числа со словом
   */
  const formatPlural = useCallback((count, rulesOrKey, options = {}) => {
    return plurize(count, rulesOrKey, { 
      ...options, 
      showNumber: true, 
      formatNumber: true 
    });
  }, [plurize]);

  /**
   * Функция для очистки кэша
   */
  const clearCache = useCallback(() => {
    pluralResultsCache.clear();
  }, []);

  /**
   * Хелпер для создания правил
   */
  const createRules = useCallback((one, few, many, other = many, zero = many) => {
    return { one, few, many, other, zero };
  }, []);

  // Возвращаем объект с функциями
  return useMemo(() => ({
    plurize,
    plurizeWithNumber,
    formatPlural,
    clearCache,
    createRules,
    RULES: {
      ru: RUSSIAN_RULES,
      en: ENGLISH_RULES
    }
  }), [plurize, plurizeWithNumber, formatPlural, clearCache, createRules]);
}

/**
 * Альтернативная версия: простой хук без дополнительных функций
 */
export function useSimplePlurize(locale = 'ru-RU') {
  const pluralRules = useMemo(() => 
    new Intl.PluralRules(locale), 
    [locale]
  );

  const plurize = useCallback((count, rules) => {
    const form = pluralRules.select(Math.abs(count));
    return rules[form] || rules.other || '';
  }, [pluralRules]);

  return plurize;
}