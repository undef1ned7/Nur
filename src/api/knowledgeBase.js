const BASE_URL =
  import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api";

const KB_URL = `${BASE_URL}/main/public/knowledge-base`;

function normalizeCoursesList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
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
  if (!response.ok) {
    throw new Error("Не удалось загрузить курс");
  }
  return response.json();
}
