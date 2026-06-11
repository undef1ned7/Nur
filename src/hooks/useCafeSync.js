import { useState, useEffect, useRef, useCallback } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import { getPendingQueue, markSynced } from "../services/cafeOfflineService";
import api from "../api";

export function useCafeSync() {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [justSynced, setJustSynced] = useState(false);
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    const updateCount = async () => {
      const queue = await getPendingQueue();
      setPendingCount(queue.length);
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const syncQueue = useCallback(async () => {
    const queue = await getPendingQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await api.post("/cafe/offline-sync/", {
        actions: queue.map((item) => ({
          type: item.type,
          payload: item.payload,
          created_at: item.created_at,
        })),
      });

      await markSynced(queue.map((item) => item.id));
      setPendingCount(0);
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);

      console.log("Sync результат:", response.data);
    } catch (err) {
      setSyncError(err.message);
      console.error("Ошибка синхронизации:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (prevOnline.current === false && isOnline === true) {
      syncQueue();
    }
    prevOnline.current = isOnline;
  }, [isOnline, syncQueue]);

  return { isOnline, pendingCount, isSyncing, syncError, justSynced, syncQueue };
}
