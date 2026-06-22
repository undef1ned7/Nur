const num = (v) => {
  const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Итог продажи по формуле из docs/messageSELL.txt (превью до ответа сервера). */
export function calcConsultingSaleTotal({
  service,
  tariffId,
  items = [],
  discount = 0,
  markup = 0,
}) {
  if (!service) return 0;

  const tariffs = Array.isArray(service.tariffs) ? service.tariffs : [];
  const tariff = tariffId
    ? tariffs.find((t) => String(t.id) === String(tariffId))
    : null;

  const base = tariff ? num(tariff.price) : num(service.price);
  const installation = num(service.installation_price);
  const itemsSum = items.reduce((s, it) => s + num(it.price), 0);

  return Math.max(0, base + installation + itemsSum - num(discount) + num(markup));
}

export function normalizeTariffsForApi(tariffs = []) {
  return tariffs
    .map((t) => {
      const row = {
        name: String(t.name || "").trim(),
        price: num(t.price),
      };
      const subAmount = num(t.subscription_amount);
      if (subAmount > 0) {
        row.subscription_amount = subAmount;
        row.subscription_period =
          t.subscription_period === "year" ? "year" : "month";
      }
      return row;
    })
    .filter((t) => t.name);
}

export function formatTariffSubscription(tariff) {
  const amount = num(tariff?.subscription_amount);
  if (!amount) return null;
  const period = tariff?.subscription_period === "year" ? "год" : "мес.";
  return `${amount.toLocaleString()} с / ${period}`;
}

export function calcLeadServiceTotal({
  service,
  tariffId,
  includeSubscription = false,
}) {
  if (!service) return 0;
  const tariffs = Array.isArray(service.tariffs) ? service.tariffs : [];
  const tariff = tariffId
    ? tariffs.find((t) => String(t.id) === String(tariffId))
    : null;
  const base = tariff ? num(tariff.price) : num(service.price);
  const installation = num(service.installation_price);
  let total = base + installation;
  if (includeSubscription) {
    const sub = tariff ? num(tariff.subscription_amount) : 0;
    total += sub;
  }
  return Math.max(0, total);
}

export function normalizeSaleItemsForApi(items = []) {
  return items
    .map((it) => ({
      name: String(it.name || "").trim(),
      price: num(it.price),
    }))
    .filter((it) => it.name);
}
