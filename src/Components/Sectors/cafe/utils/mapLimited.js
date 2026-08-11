/**
 * Параллельный map с ограничением concurrency — чтобы hydrate N заказов
 * не открывал N одновременных GET на /cafe/orders/:id/.
 */
export async function mapLimited(items, limit, mapper) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];

  const concurrency = Math.max(1, Math.min(Number(limit) || 1, list.length));
  const results = new Array(list.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
