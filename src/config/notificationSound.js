/**
 * Звук уведомлений.
 *
 * Чтобы заменить звук на свой — положите свой файл в `public/sounds/`
 * и поменяйте имя ниже (или задайте VITE_NOTIFICATION_SOUND в .env).
 * Файл по умолчанию: public/sounds/notification.mp3
 */
export const NOTIFICATION_SOUND =
  import.meta.env.VITE_NOTIFICATION_SOUND || "/sounds/notification.mp3";

let audioInstance = null;

/**
 * Воспроизвести звук уведомления.
 * Best-effort: если файла нет или браузер блокирует автоплей —
 * НЕ бросаем ошибку (тихо игнорируем).
 */
export function playNotificationSound() {
  try {
    if (typeof Audio === "undefined") return;
    if (!audioInstance) {
      audioInstance = new Audio(NOTIFICATION_SOUND);
      audioInstance.preload = "auto";
    }
    // сбрасываем позицию, чтобы звук срабатывал на каждое уведомление
    audioInstance.currentTime = 0;
    const p = audioInstance.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* автоплей заблокирован/файл отсутствует — игнорируем */
      });
    }
  } catch {
    /* никогда не ломаем поток уведомлений из-за звука */
  }
}
