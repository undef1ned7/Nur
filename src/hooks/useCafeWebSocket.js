import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useUser } from '../store/slices/userSlice';
import api from '../api';
import logger from '../utils/logger';

/**
 * Универсальный хук для подключения к WebSocket кафе
 */
export const useCafeWebSocket = (endpoint, options = {}) => {
    const {
        branchId = null,
        autoConnect = true,
        onMessage = () => { },
        onError = () => { },
    } = options;

    const user = useUser();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const [error, setError] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const isIntentionalDisconnect = useRef(false);
    const connectionUrlRef = useRef(null);

    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    // Получаем токен из localStorage
    const getToken = useCallback(() => {
        return localStorage.getItem('accessToken');
    }, []);

    // Формируем URL для WebSocket (мемоизировано)
    const getWebSocketUrl = useCallback(() => {
        const token = getToken();
        if (!token) return null;

        const baseUrl = import.meta.env.VITE_WS_API_URL || 'https://app.nurcrm.kg'
        let url = `${baseUrl}/ws/cafe/${endpoint}/?token=${token}`;

        // Добавляем branch_id только если пользователь owner/admin и branchId передан
        if (user?.is_owner && branchId) {
            url += `&branch_id=${branchId}`;
        }

        return url;
    }, [endpoint, branchId, user?.is_owner]);

    // Подключение к WebSocket
    const connect = useCallback(() => {
        const token = getToken();
        if (!token) {
            setError('Пользователь не авторизован');
            return false;
        }

        const url = getWebSocketUrl();
        if (!url) {
            setError('Не удалось сформировать URL для WebSocket');
            return false;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN && connectionUrlRef.current === url) {
            logger(console.log, (`✅ WebSocket ${endpoint} уже подключен, пропускаем переподключение`));
            return true;
        }

        if (wsRef.current?.readyState === WebSocket.CONNECTING && connectionUrlRef.current === url) {
            logger(console.log, (`⏳ WebSocket ${endpoint} уже подключается, ожидаем...`));
            return true;
        }

        // Закрываем существующее соединение только если URL изменился
        if (wsRef.current && connectionUrlRef.current !== url) {
            logger(console.log, (`🔄 URL изменился, закрываем старое соединение`));
            try {
                wsRef.current.close(1000, 'URL changed');
            } catch (e) {
                logger(console.log, ('Ошибка при закрытии старого соединения:', e));
            }
        }

        // Сохраняем URL текущего соединения
        connectionUrlRef.current = url;

        // Сбрасываем флаг преднамеренного отключения
        isIntentionalDisconnect.current = false;

        // Сбрасываем счетчик попыток переподключения
        reconnectAttemptsRef.current = 0;
        clearTimeout(reconnectTimeoutRef.current);

        try {
            logger(console.log, (`🔌 Подключение к WebSocket: ${endpoint}`));
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                logger(console.log, (`✅ WebSocket ${endpoint} подключен`));
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);

                    // Вызываем пользовательский обработчик
                    onMessage(data);
                } catch (error) {
                    logger(console.error, ('❌ Ошибка обработки сообщения:', error));
                }
            };

            ws.onerror = (errorEvent) => {
                logger(console.error, (`❌ WebSocket ${endpoint} ошибка:`, errorEvent));
                setError('Ошибка соединения WebSocket');
                onError(errorEvent);
            };

            ws.onclose = (event) => {
                logger(console.log, (`🔌 WebSocket ${endpoint} закрыт:`, {
                    code: event.code,
                    reason: event.reason,
                    wasClean: event.wasClean
                }));

                setIsConnected(false);
                wsRef.current = null;

                // ✅ КРИТИЧНО: Переподключаемся только если это НЕ преднамеренное отключение
                const shouldReconnect =
                    !isIntentionalDisconnect.current &&
                    event.code !== 1000 && // Normal closure
                    event.code !== 1001 && // Going away
                    reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS;

                if (shouldReconnect) {
                    reconnectAttemptsRef.current += 1;
                    logger(console.log, (`🔄 Попытка переподключения ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`));

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    logger(console.error, (`❌ Превышено максимальное количество попыток переподключения для ${endpoint}`));
                }
            };

            return true;
        } catch (error) {
            logger(console.error, ('❌ Ошибка создания WebSocket:', error));
            setError(error.message);
            return false;
        }
    }, [endpoint, branchId, user?.is_owner, getToken, onMessage, onError]); // ✅ Минимальные зависимости

    // Отключение от WebSocket (преднамеренное)
    const disconnect = useCallback((code = 1000, reason = 'User disconnected') => {
        // ✅ Устанавливаем флаг преднамеренного отключения
        isIntentionalDisconnect.current = true;

        clearTimeout(reconnectTimeoutRef.current);
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;

        if (wsRef.current) {
            try {
                wsRef.current.close(code, reason);
            } catch (e) {
                logger(console.log, ('Ошибка при закрытии соединения:', e));
            }
            wsRef.current = null;
        }

        connectionUrlRef.current = null;
        setIsConnected(false);
        logger(console.log, (`🔌 WebSocket ${endpoint} отключен`));
    }, [endpoint]);

    // Отправка сообщения
    const sendMessage = useCallback((message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
                wsRef.current.send(messageStr);
                logger(console.log, (`📤 Отправлено ${endpoint}:`, message));
                return true;
            } catch (error) {
                logger(console.error, ('❌ Ошибка отправки:', error));
                return false;
            }
        }
        logger(console.warn, (`⚠️ WebSocket ${endpoint} не подключен`));
        return false;
    }, [endpoint]);

    // Ping серверу
    const ping = useCallback(() => {
        return sendMessage({ action: 'ping' });
    }, [sendMessage]);

    // Проверка соединения
    const checkConnection = useCallback(() => {
        return wsRef.current?.readyState === WebSocket.OPEN;
    }, []);

    // ✅ ОПТИМИЗАЦИЯ: Эффект для первоначального подключения (запускается ОДИН раз)
    useEffect(() => {
        if (!autoConnect) return;

        const timer = setTimeout(() => {
            connect();
        }, 500);

        return () => {
            clearTimeout(timer);
        };
    }, []); // ✅ ПУСТОЙ массив зависимостей - запускается только при монтировании

    // ✅ ОПТИМИЗАЦИЯ: Переподключение только при изменении критичных параметров
    useEffect(() => {
        // Пропускаем первый рендер (уже подключаемся в первом useEffect)
        if (!wsRef.current) return;

        const newUrl = getWebSocketUrl();

        // Переподключаемся только если URL изменился
        if (newUrl && connectionUrlRef.current !== newUrl) {
            logger(console.log, (`🔄 URL изменился, переподключение ${endpoint}...`));
            disconnect(1000, 'Parameters changed');
            setTimeout(() => connect(), 500);
        }
    }, [endpoint, branchId, user?.is_owner]); // ✅ Только критичные зависимости

    // Эффект для очистки при размонтировании
    useEffect(() => {
        return () => {
            disconnect(1000, 'Component unmounted');
        };
    }, []); // ✅ Пустой массив - выполняется только при размонтировании

    // Экспортируем состояние WebSocket
    const readyState = useMemo(() => {
        if (!wsRef.current) return 'CLOSED';
        switch (wsRef.current.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }, [isConnected]); // ✅ Обновляется только при изменении isConnected

    return {
        isConnected,
        lastMessage,
        error,
        readyState,
        connect,
        disconnect,
        sendMessage,
        ping,
        checkConnection,
        reconnectAttempts: reconnectAttemptsRef.current,
    };
};

/**
 * Хук для WebSocket заказов кафе
 */
export const useCafeOrdersWebSocket = (options = {}) => {
    const [orders, setOrders] = useState([]);
    const [newOrders, setNewOrders] = useState([]);
    const [updatedOrders, setUpdatedOrders] = useState([]);
    const processedOrdersRef = useRef(new Set()); // ✅ Предотвращаем дубликаты

    const handleMessage = useCallback((message) => {
        switch (message.type) {
            case 'order_created': {
                const newOrder = message.data.order;

                // ✅ Предотвращаем дубликаты
                if (processedOrdersRef.current.has(`created-${newOrder.id}`)) {
                    return;
                }
                processedOrdersRef.current.add(`created-${newOrder.id}`);

                logger(console.log, ('🆕 Новый заказ:', newOrder.id));

                setNewOrders(prev => {
                    if (prev.some(order => order.id === newOrder.id)) return prev;
                    return [...prev, newOrder];
                });

                setOrders(prev => {
                    if (prev.some(order => order.id === newOrder.id)) return prev;
                    return [...prev, newOrder];
                });

                // Уведомление
                if (Notification.permission === 'granted') {
                    new Notification('📋 Новый заказ', {
                        body: `Стол №${newOrder.table_number}, сумма: ${newOrder.total_amount}`,
                        icon: '/favicon.ico',
                        tag: `order-${newOrder.id}`
                    });
                }
                break;
            }

            case 'order_updated': {
                const updatedOrder = message.data.order;

                // ✅ Предотвращаем дубликаты одного и того же события (не блокируем повторные правки с тем же status)
                const updateKey = `updated-${updatedOrder.id}-${updatedOrder.updated_at || updatedOrder.modified_at || updatedOrder.total_amount}-${(updatedOrder.items || []).length}`;
                if (processedOrdersRef.current.has(updateKey)) {
                    return;
                }
                processedOrdersRef.current.add(updateKey);
                logger(console.log, ('📝 Заказ обновлен:', updatedOrder.id));

                // Проверяем, оплачен ли заказ
                const isPaid = updatedOrder.status === 'paid' ||
                    updatedOrder.is_paid === true ||
                    ['paid', 'оплачен', 'оплачено', 'оплачён'].includes(
                        String(updatedOrder.status || '').toLowerCase()
                    );

                setUpdatedOrders(prev => {
                    const exists = prev.find(order => order.id === updatedOrder.id);
                    if (exists) {
                        return prev.map(order =>
                            order.id === updatedOrder.id ? updatedOrder : order
                        );
                    }
                    return [...prev, updatedOrder];
                });

                // Если заказ оплачен, удаляем его из списка, иначе обновляем
                setOrders(prev => {
                    if (isPaid) {
                        // Удаляем оплаченный заказ из списка
                        return prev.filter(order => String(order.id) !== String(updatedOrder.id));
                    } else {
                        // Обновляем заказ
                        return prev.map(order =>
                            String(order.id) === String(updatedOrder.id)
                                ? { ...order, ...updatedOrder }
                                : order
                        );
                    }
                });
                break;
            }

            case 'table_status_changed':
                logger(console.log, ('🔄 Статус стола изменен:', message.data));
                break;

            default:
                logger(console.log, ('📨 Другое сообщение:', message.type));
        }
    }, []);

    const ws = useCafeWebSocket('orders', {
        ...options,
        onMessage: (message) => {
            handleMessage(message);
            options.onMessage?.(message);
        }
    });

    const clearNewOrders = useCallback(() => {
        setNewOrders([]);
    }, []);

    const clearUpdatedOrders = useCallback(() => {
        setUpdatedOrders([]);
    }, []);

    const getOrderById = useCallback((orderId) => {
        return orders.find(order => order.id === orderId);
    }, [orders]);

    const getOrdersByStatus = useCallback((status) => {
        return orders.filter(order => order.status === status);
    }, [orders]);

    const fetchOrdersStatus = useCallback(async () => {
        try {
            const { data } = await api.get(`/cafe/orders/`);
            setOrders(data.results || data);
        } catch (error) {
            logger(console.error, ('❌ Ошибка загрузки заказов:', error));
        }
    }, []);

    return {
        ...ws,
        orders,
        newOrders,
        updatedOrders,
        clearNewOrders,
        clearUpdatedOrders,
        getOrderById,
        getOrdersByStatus,
        fetchOrdersStatus,
    };
};

/**
 * Хук для WebSocket столов кафе
 */
export const useCafeTablesWebSocket = (options = {}) => {
    const [tables, setTables] = useState([]);
    const [tableStatusHistory, setTableStatusHistory] = useState([]);
    const processedStatusRef = useRef(new Set()); // ✅ Предотвращаем дубликаты

    const handleMessage = useCallback((message) => {
        switch (message.type) {
            case 'table_status_changed': {
                const tableData = message.data;
                const tableId = tableData.table_id || tableData.table?.id;

                if (!tableId) {
                    logger(console.warn, ('❌ Нет ID стола в сообщении'));
                    return;
                }

                // ✅ Предотвращаем дубликаты обновлений
                const statusKey = `${tableId}-${tableData.status}-${Date.now()}`;
                if (processedStatusRef.current.has(statusKey)) {
                    return;
                }
                processedStatusRef.current.add(statusKey);

                logger(console.log, ('🔄 Статус стола изменен:', tableId));

                // Обновляем статус стола
                setTables(prev => {
                    const tableIndex = prev.findIndex(table => table.id === tableId);

                    if (tableIndex !== -1) {
                        const updatedTables = [...prev];
                        updatedTables[tableIndex] = {
                            ...updatedTables[tableIndex],
                            status: tableData.status,
                            status_display: tableData.status_display || tableData.status,
                            updated_at: new Date().toISOString()
                        };
                        return updatedTables;
                    }

                    return [...prev, {
                        id: tableId,
                        number: tableData.table_number || tableData.table?.number || 0,
                        status: tableData.status,
                        status_display: tableData.status_display || tableData.status,
                        places: tableData.table?.places || 4,
                        created_at: new Date().toISOString()
                    }];
                });

                // Сохраняем в историю (ограничено 100 записями)
                setTableStatusHistory(prev => [
                    {
                        id: Date.now(),
                        timestamp: new Date().toISOString(),
                        table_id: tableId,
                        table_number: tableData.table_number || tableData.table?.number,
                        status: tableData.status,
                        status_display: tableData.status_display || tableData.status,
                        company_id: tableData.company_id,
                        branch_id: tableData.branch_id
                    },
                    ...prev
                ].slice(0, 100));
                break;
            }

            default:
                logger(console.log, ('📨 Другое сообщение:', message.type));
        }
    }, []);

    const ws = useCafeWebSocket('tables', {
        ...options,
        onMessage: (message) => {
            handleMessage(message);
            options.onMessage?.(message);
        }
    });

    const fetchTables = useCallback(async () => {
        try {
            const { data } = await api.get(`/cafe/tables/`);
            setTables(data.results || data);
            return data;
        } catch (error) {
            logger(console.error, ('❌ Ошибка загрузки столов:', error));
        }
    }, []);

    const getTableById = useCallback((tableId) => {
        return tables.find(table => table.id === tableId);
    }, [tables]);

    const getTablesByStatus = useCallback((status) => {
        return tables.filter(table => table.status === status);
    }, [tables]);

    const getFreeTables = useCallback(() => {
        return tables.filter(table => table.status === 'free');
    }, [tables]);

    const getBusyTables = useCallback(() => {
        return tables.filter(table => table.status === 'busy');
    }, [tables]);

    const clearHistory = useCallback(() => {
        setTableStatusHistory([]);
        processedStatusRef.current.clear();
    }, []);

    return {
        ...ws,
        tables,
        tableStatusHistory,
        fetchTables,
        getTableById,
        getTablesByStatus,
        getFreeTables,
        getBusyTables,
        clearHistory,
    };
};

/**
 * Менеджер всех WebSocket подключений кафе
 */
export const useCafeWebSocketManager = (options = {}) => {
    const ordersWs = useCafeOrdersWebSocket({
        branchId: options.branchId,
        autoConnect: options.autoConnectOrders !== false,
        onMessage: options.onOrdersMessage,
        onError: options.onOrdersError,
    });

    const tablesWs = useCafeTablesWebSocket({
        branchId: options.branchId,
        autoConnect: options.autoConnectTables !== false,
        onMessage: options.onTablesMessage,
        onError: options.onTablesError,
    });

    const connectAll = useCallback(() => {
        logger(console.log, ('🔌 Подключение всех WebSocket...'));
        ordersWs.connect();
        tablesWs.connect();
    }, [ordersWs.connect, tablesWs.connect]); // ✅ Стабильные зависимости

    const disconnectAll = useCallback(() => {
        logger(console.log, ('🔌 Отключение всех WebSocket...'));
        ordersWs.disconnect();
        tablesWs.disconnect();
    }, [ordersWs.disconnect, tablesWs.disconnect]); // ✅ Стабильные зависимости

    const pingAll = useCallback(() => {
        const ordersPing = ordersWs.ping();
        const tablesPing = tablesWs.ping();
        return ordersPing && tablesPing;
    }, [ordersWs.ping, tablesWs.ping]);

    const allConnected = useMemo(
        () => ordersWs.isConnected && tablesWs.isConnected,
        [ordersWs.isConnected, tablesWs.isConnected]
    );

    const fetchAllData = useCallback(async () => {
        logger(console.log, ('📥 Загрузка начальных данных...'));
        const [ordersData, tablesData] = await Promise.all([
            ordersWs.fetchOrdersStatus(),
            tablesWs.fetchTables()
        ]);
        return { ordersData, tablesData };
    }, [ordersWs.fetchOrdersStatus, tablesWs.fetchTables]);

    return {
        allConnected,
        connectAll,
        disconnectAll,
        pingAll,
        fetchAllData,
        orders: ordersWs,
        tables: tablesWs,
    };
};