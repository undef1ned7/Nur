import { useState, useEffect, useRef, useCallback } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  getPendingQueue,
  markSynced,
  saveIdMapping,
  remapQueueOrderIds,
  saveSnapshot,
} from "../services/cafeOfflineService";
import api from "../api";

export function useCafeSync() {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [justSynced, setJustSynced] = useState(false);
  const [lastFailed, setLastFailed] = useState([]);
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
    setLastFailed([]);

    try {
      const createOrderItems = queue.filter(
        (item) => item.type === "CREATE_ORDER",
      );

      const response = await api.post("/cafe/offline-sync/", {
        actions: queue.map((item) => ({
          type: item.type,
          payload: item.payload,
          created_at: item.created_at,
        })),
      });

      const { failed, created_order_ids } = response.data;

      if (Array.isArray(created_order_ids) && createOrderItems.length) {
        for (let i = 0; i < createOrderItems.length; i++) {
          const offlineId =
            createOrderItems[i].payload?.client_id ||
            createOrderItems[i].payload?.order_id;
          const serverId = created_order_ids[i];
          if (offlineId && serverId) {
            await saveIdMapping(String(offlineId), String(serverId));
            await remapQueueOrderIds(String(offlineId), String(serverId));
          }
        }
      }

      const failedIndexes = new Set((failed || []).map((f) => f.action_index));
      const syncedIds = queue
        .filter((_, idx) => !failedIndexes.has(idx))
        .map((item) => item.id);

      await markSynced(syncedIds);

      if (failed && failed.length > 0) {
        setLastFailed(failed);
      }

      try {
        const { data: snapshot } = await api.get("/cafe/offline-snapshot/");
        await saveSnapshot(snapshot);
      } catch {
        // снимок не critical — продолжаем
      }

      window.dispatchEvent(new Event("orders:refresh"));

      const newPending = await getPendingQueue();
      setPendingCount(newPending.length);
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

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncError,
    justSynced,
    syncQueue,
    lastFailed,
  };
}
