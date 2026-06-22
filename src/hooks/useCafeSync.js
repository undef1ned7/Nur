import { useState, useEffect, useRef, useCallback } from "react";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  getPendingQueue,
  markSynced,
  saveIdMapping,
  remapQueueOrderIds,
  saveSnapshot,
  pruneDeadQueueActions,
  pruneFailedCreateOrderDependents,
  getFailedQueueDetails,
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
  const hasSyncedOnMount = useRef(false);
  const hasRefreshedSnapshotRef = useRef(false);

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
    await pruneDeadQueueActions();

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
        const failedOrderIds = failed
          .map((f) => queue[f.action_index])
          .filter((item) => item?.type === "CREATE_ORDER")
          .map((item) =>
            String(item.payload?.client_id || item.payload?.order_id || ""),
          )
          .filter(Boolean);
        if (failedOrderIds.length) {
          await pruneFailedCreateOrderDependents(failedOrderIds);
        }

        const detailed = await getFailedQueueDetails(failed, queue);
        setLastFailed(detailed);
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
    if (hasSyncedOnMount.current) return;
    hasSyncedOnMount.current = true;
    if (!isOnline) return;

    (async () => {
      const queue = await getPendingQueue();
      if (queue.length > 0) {
        console.log(
          `[useCafeSync] Found ${queue.length} pending on mount — syncing`,
        );
        syncQueue();
      }
    })();
  }, []);

  useEffect(() => {
    if (prevOnline.current === false && isOnline === true) {
      syncQueue();
    }
    prevOnline.current = isOnline;
  }, [isOnline, syncQueue]);

  const refreshSnapshot = useCallback(async () => {
    if (!isOnline) return;
    try {
      const { data: snapshot } = await api.get("/cafe/offline-snapshot/");
      await saveSnapshot(snapshot);
    } catch {
      // не критично
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    if (!hasRefreshedSnapshotRef.current) {
      hasRefreshedSnapshotRef.current = true;
      refreshSnapshot();
    }
    const interval = setInterval(refreshSnapshot, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, refreshSnapshot]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncError,
    justSynced,
    syncQueue,
    lastFailed,
    refreshSnapshot,
  };
}
