import { useState, useEffect, useCallback, useRef } from "react";

// Медиа-запросы для разных устройств (можно настроить под свои нужды)
const MEDIA_QUERIES = {
    mobile: "(max-width: 767px)",
    tablet: "(min-width: 768px) and (max-width: 1023px)",
    desktop: "(min-width: 1024px)",
};

export default function useResize(callback) {
    const [deviceState, setDeviceState] = useState({
        isMobile: false,
        isTablet: false,
        isDesktop: false,
    });

    // Создаем MediaQueryList объекты для каждого медиа-запроса
    const mediaQueries = useCallback(() => {
        if (typeof window !== "undefined") {
            return {
                mobile: window.matchMedia(MEDIA_QUERIES.mobile),
                tablet: window.matchMedia(MEDIA_QUERIES.tablet),
                desktop: window.matchMedia(MEDIA_QUERIES.desktop),
            };
        }
        return null;
    }, []);

    const callbackRef = useRef(callback);

    // Обновляем ref при изменении callback
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);
    // Проверяем текущее состояние устройств
    const checkDeviceState = useCallback(() => {
        const queries = mediaQueries();
        if (!queries) return;

        const newState = {
            isMobile: queries.mobile.matches,
            isTablet: queries.tablet.matches,
            isDesktop: queries.desktop.matches,
        };

        setDeviceState(newState);

        // Вызываем callback с новым состоянием
        if (callbackRef.current && typeof callbackRef.current === "function") {
            callbackRef.current(newState);
        }


        return newState;
    }, [mediaQueries]);

    // Версия с debounce
    const checkDeviceStateDebounced = useCallback(() => {
        const timer = setTimeout(() => {
            checkDeviceState();
        }, 250); // Задержка 250ms

        return () => clearTimeout(timer);
    }, [checkDeviceState]);

    // Инициализация и подписка на изменения
    useEffect(() => {
        const queries = mediaQueries();
        if (!queries) return;
        // Функции-обработчики для медиа-запросов
        const handleMediaChange = () => {
            checkDeviceStateDebounced();
        };

        Object.values(queries).forEach((mq) => {
            // Новый метод
            if (mq.addEventListener) {
                mq.addEventListener("change", handleMediaChange);
            }
        });

        // Первоначальная проверка
        checkDeviceState();

        // Очистка при размонтировании
        return () => {
            Object.values(queries).forEach((mq) => {
                if (mq.removeEventListener) {
                    mq.removeEventListener("change", handleMediaChange);
                }
            });
        };
    }, [mediaQueries, checkDeviceState, checkDeviceStateDebounced]);

    // Также слушаем resize события для дополнительной надежности
    useEffect(() => {
        const handleResize = () => {
            checkDeviceStateDebounced();
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [checkDeviceStateDebounced]);

    // Возвращаем состояние устройств
    return deviceState;
}