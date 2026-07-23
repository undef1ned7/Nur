import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

/**
 * Реалтайм для сектора «Консалтинг» поверх общего per-user сокета уведомлений
 * (`useNotificationsSocket` → `/ws/notifications/?token=<JWT>`, смонтирован в
 * Header). Соединение авторизуется JWT текущего пользователя, поэтому в
 * redux-слайс `notification` попадают ТОЛЬКО «мои» события — если лид назначили
 * мне, уведомление придёт только мне, а не всем. См.
 * docs/consulting/realtime-notifications.md.
 *
 * Хук следит за самым свежим уведомлением и, если оно подходит под `match`,
 * вызывает `onSignal` (например, чтобы обновить список) и best-effort
 * показывает десктоп-пуш, когда вкладка не в фокусе.
 */

export function ensurePushPermission() {
  try {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* Notification API недоступен — тихо игнорируем */
  }
}

function showDesktopPush(title, body) {
  try {
    if (typeof Notification === "undefined") return;
    if (
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      // eslint-disable-next-line no-new
      new Notification(title, { body: body || "" });
    }
  } catch {
    /* best-effort */
  }
}

export function useConsultingRealtime({ match, onSignal, desktopPush = true }) {
  const list = useSelector((s) => s.notification?.list || []);
  const lastIdRef = useRef(null);
  const initedRef = useRef(false);

  useEffect(() => {
    const newest = list[0];
    if (!newest) return;
    const id = newest.id ?? newest.uuid ?? newest.pk ?? null;

    // Первый проход: запоминаем текущее «последнее», чтобы не срабатывать на
    // уже накопленных (старых) уведомлениях при открытии страницы.
    if (!initedRef.current) {
      initedRef.current = true;
      lastIdRef.current = id;
      return;
    }
    if (id === lastIdRef.current) return;
    lastIdRef.current = id;

    if (typeof match === "function" && match(newest)) {
      onSignal?.(newest);
      if (desktopPush) {
        showDesktopPush(
          newest.title || "Новое уведомление",
          newest.message || newest.body || "",
        );
      }
    }
  }, [list, match, onSignal, desktopPush]);
}

export default useConsultingRealtime;
