/**
 * Общий раннер для массовых операций над лидами (передача сотруднику,
 * перевод на стадию, перенос в воронку) — использует существующие
 * одиночные эндпоинты в цикле по выбранным лидам, без выделенного
 * bulk-эндпоинта на бэке. См. docs/consulting/backend-money-tenant/22-bulk-lead-transfer.md.
 */

/** Не больше `limit` запросов одновременно — щадим бэк на пачках в десятки лидов. */
export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runNext() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
  return results;
}
