import { db } from "../db/cafeOfflineDB";

export async function saveSnapshot(snapshot) {
  await db.transaction(
    "rw",
    db.menu_categories,
    db.menu_items,
    db.cafe_tables,
    db.open_orders,
    db.current_shift,
    async () => {
      await db.menu_categories.clear();
      await db.menu_items.clear();
      await db.cafe_tables.clear();
      await db.open_orders.clear();
      await db.current_shift.clear();

      if (snapshot.menu?.categories?.length) {
        await db.menu_categories.bulkPut(snapshot.menu.categories);
      }

      if (snapshot.menu?.items?.length) {
        await db.menu_items.bulkPut(snapshot.menu.items);
      }

      if (snapshot.tables?.length) {
        await db.cafe_tables.bulkPut(snapshot.tables);
      }

      if (snapshot.open_orders?.length) {
        await db.open_orders.bulkPut(snapshot.open_orders);
      }

      if (snapshot.current_shift) {
        await db.current_shift.put(snapshot.current_shift);
      }
    },
  );

  if (snapshot.snapshot_at) {
    localStorage.setItem("cafe_snapshot_at", snapshot.snapshot_at);
  }
  console.log("Snapshot сохранён:", snapshot.snapshot_at);
}

export async function getSnapshot() {
  const [categories, items, tables, open_orders, shifts] = await Promise.all([
    db.menu_categories.orderBy("sort_order").toArray(),
    db.menu_items.toArray(),
    db.cafe_tables.toArray(),
    db.open_orders.toArray(),
    db.current_shift.toArray(),
  ]);

  return {
    categories,
    items,
    tables,
    open_orders,
    current_shift: shifts[0] || null,
  };
}

export async function addToQueue(type, payload) {
  await db.offline_queue.add({
    type,
    payload,
    created_at: new Date().toISOString(),
    synced: false,
  });
}

export async function getPendingQueue() {
  const all = await db.offline_queue.toArray();
  return all
    .filter((item) => item.synced === false)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

export async function markSynced(ids) {
  await Promise.all(
    ids.map((id) => db.offline_queue.update(id, { synced: true })),
  );
}

export async function updateOrderLocally(orderId, updater) {
  const order = await db.open_orders.get(orderId);
  if (!order) return null;
  const updated = updater(order);
  await db.open_orders.put(updated);
  return updated;
}

export async function createOrderLocally(orderData) {
  const tempId =
    "offline-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const order = {
    id: tempId,
    table_id: orderData.table_id || null,
    status: "open",
    created_at: new Date().toISOString(),
    items:
      orderData.items?.map((item, i) => ({
        id: "offline-item-" + Date.now() + "-" + i,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name || "",
        quantity: item.quantity,
        price: item.price || "0.00",
      })) || [],
    total: "0.00",
    offline: true,
  };
  await db.open_orders.put(order);
  return order;
}
