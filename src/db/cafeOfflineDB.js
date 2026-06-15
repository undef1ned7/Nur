import Dexie from "dexie";

export const db = new Dexie("NurCafeOffline");

db.version(1).stores({
  menu_categories: "id",
  menu_items: "id, category_id",
  cafe_tables: "id, hall_id",
  open_orders: "id, table_id, status",
  current_shift: "id",
  offline_queue: "++id, type, created_at, synced",
});

db.version(2).stores({
  menu_categories: "id, sort_order",
  menu_items: "id, category_id",
  cafe_tables: "id, hall_id, status",
  open_orders: "id, table_id, status",
  current_shift: "id",
  offline_queue: "++id, type, created_at, synced",
});

db.version(3).stores({
  menu_categories: "id, sort_order",
  menu_items: "id, category_id",
  cafe_tables: "id, hall_id, status",
  open_orders: "id, table_id, status",
  current_shift: "id",
  offline_queue: "++id, type, created_at, synced",
  id_mapping: "offline_id, server_id",
});

export async function resetOfflineDB() {
  await db.delete();
  await db.open();
  console.log("NurCafeOffline DB сброшена");
}
