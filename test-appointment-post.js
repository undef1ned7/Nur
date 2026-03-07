/**
 * Тест POST /barbershop/appointments/ с services
 * Запуск: node test-appointment-post.js
 * Нужен токен: вставь свой accessToken в TOKEN ниже, или передай как аргумент:
 *   node test-appointment-post.js "твой_токен"
 */

const TOKEN = process.argv[2] || "PASTE_YOUR_TOKEN";

const payload = {
  client: null,
  barber: "254b2d73-2ad3-4557-9636-52cf93fe90d5",
  services: [
    "f6064bad-8f79-4a79-b63e-f4fb76dadeee",
    "f6064bad-8f79-4a79-b63e-f4fb76dadeee",
  ],
  start_at: "2025-03-06T10:00:00",
  end_at: "2025-03-06T11:00:00",
  status: "booked",
  comment: null,
  company: "68804423-961e-455d-9ee7-4cd0709e2b26",
  price: 222,
  discount: 0,
};

fetch("https://app.nurcrm.kg/api/barbershop/appointments/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify(payload),
})
  .then(async (r) => {
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    console.log("Status:", r.status, r.statusText);
    console.log("Response:", JSON.stringify(data, null, 2));
    if (data?.services?.length === 0 && payload.services?.length > 0) {
      console.log("\n⚠️ ПРОБЛЕМА: services в ответе пустой, хотя мы отправили:", payload.services);
    } else if (data?.services?.length > 0) {
      console.log("\n✅ OK: services сохранены:", data.services?.length);
    }
  })
  .catch((e) => console.error("Error:", e));
