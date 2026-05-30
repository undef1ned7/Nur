const BASE_URL =
  import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api";

const KB_URL = `${BASE_URL}/main/public/knowledge-base`;

function normalizeCoursesList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export function formatKnowledgeBaseErrors(data) {
  if (!data || typeof data !== "object") return null;
  if (typeof data.detail === "string") return data.detail;

  const parts = [];

  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      value.forEach((item, index) => {
        Object.entries(item).forEach(([field, messages]) => {
          const text = Array.isArray(messages) ? messages.join(", ") : messages;
          parts.push(`Урок ${index + 1}, ${field}: ${text}`);
        });
      });
      return;
    }

    const text = Array.isArray(value) ? value.join(", ") : String(value);
    parts.push(`${key}: ${text}`);
  });

  return parts.length ? parts.join("\n") : null;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      formatKnowledgeBaseErrors(data) ||
      `Ошибка запроса (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function fetchKnowledgeBaseCourses() {
  const response = await fetch(`${KB_URL}/`);
  if (!response.ok) {
    throw new Error("Не удалось загрузить базу знаний");
  }

  const data = await response.json();
  let courses = normalizeCoursesList(data);

  let nextUrl = data?.next;
  while (nextUrl) {
    const pageRes = await fetch(nextUrl);
    if (!pageRes.ok) break;
    const page = await pageRes.json();
    courses = courses.concat(normalizeCoursesList(page));
    nextUrl = page?.next;
  }

  return courses;
}

export async function fetchKnowledgeBaseCourse(courseId) {
  const response = await fetch(`${KB_URL}/${courseId}/`);
  return parseResponse(response);
}

export async function createKnowledgeBaseCourse(payload) {
  const response = await fetch(`${KB_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

export async function updateKnowledgeBaseCourse(courseId, payload) {
  const response = await fetch(`${KB_URL}/${courseId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}
