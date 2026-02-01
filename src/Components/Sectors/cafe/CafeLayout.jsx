import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useCafeWebSocketManager } from '../../../hooks/useCafeWebSocket'
import NotificationCafeSound from '../../common/Notification/NotificationCafeSound'
import { useUser } from '../../../store/slices/userSlice'

export default function CafeLayout() {
    const { orders, tables } = useCafeWebSocketManager();
    const [notificationDeps, setNotificationDeps] = useState(null);
    const [notificationOrder, setNotificationOrder] = useState(null)
    const { profile } = useUser();
    useEffect(() => {
        const { lastMessage } = orders;
        if (!lastMessage) return;
        const { type, data } = lastMessage;
        if (type === "kitchen_task_ready" && data?.task?.waiter === profile?.id) {
            setNotificationDeps(data?.task?.created_at)
            setNotificationOrder(`${data?.task?.menu_item_title} \nдля стола: №: ${data?.task.table_number} готово`);
        } else if (type === '') {

        }
    }, [orders])
    return (
        <>
            <NotificationCafeSound notification={notificationOrder} deps={orders} />
            <Outlet context={{
                socketOrders: orders,
                socketTables: tables
            }} />
        </>
    )
}
