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

export function buildLessonWritePayload(lesson) {
  const payload = {
    title: lesson.title,
    description: lesson.description || "",
    url: lesson.url,
  };

  if (lesson.id) {
    payload.id = lesson.id;
  }

  if (lesson.thumbnailFile instanceof File) {
    payload.thumbnailFile = lesson.thumbnailFile;
    return payload;
  }

  const shouldClear =
    lesson.thumbnailCleared ||
    (lesson.thumbnailTouched && !lesson.thumbnail?.trim());

  if (shouldClear) {
    payload.thumbnail = "";
  } else if (lesson.thumbnailTouched && lesson.thumbnail?.trim()) {
    payload.thumbnail = lesson.thumbnail.trim();
  }

  return payload;
}

function lessonHasThumbnailFile(lesson) {
  return lesson?.thumbnailFile instanceof File;
}

function appendLessonToFormData(formData, lesson, index) {
  const prefix = `lessons[${index}]`;
  const payload = buildLessonWritePayload(lesson);

  formData.append(`${prefix}[title]`, payload.title);
  formData.append(`${prefix}[description]`, payload.description || "");
  formData.append(`${prefix}[url]`, payload.url);

  if (payload.id) {
    formData.append(`${prefix}[id]`, payload.id);
  }

  if (payload.thumbnailFile instanceof File) {
    formData.append(`${prefix}[thumbnail]`, payload.thumbnailFile);
  } else if (Object.prototype.hasOwnProperty.call(payload, "thumbnail")) {
    formData.append(`${prefix}[thumbnail]`, payload.thumbnail);
  }
}

function buildKnowledgeBaseFormData(payload) {
  const formData = new FormData();
  formData.append("title", payload.title);

  (payload.lessons || []).forEach((lesson, index) => {
    appendLessonToFormData(formData, lesson, index);
  });

  return formData;
}

function payloadHasThumbnailFiles(payload) {
  return (payload.lessons || []).some(lessonHasThumbnailFile);
}

async function submitKnowledgeBaseCourse(method, url, payload) {
  const useMultipart = payloadHasThumbnailFiles(payload);

  let body;
  if (useMultipart) {
    body = buildKnowledgeBaseFormData(payload);
  } else {
    const jsonPayload = { title: payload.title };
    if (Array.isArray(payload.lessons)) {
      jsonPayload.lessons = payload.lessons.map((lesson) => {
        const item = buildLessonWritePayload(lesson);
        const { thumbnailFile, ...rest } = item;
        return rest;
      });
    }
    body = JSON.stringify(jsonPayload);
  }

  const response = await fetch(url, {
    method,
    headers: useMultipart ? undefined : { "Content-Type": "application/json" },
    body,
  });

  return parseResponse(response);
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
  return submitKnowledgeBaseCourse("POST", `${KB_URL}/`, payload);
}

export async function updateKnowledgeBaseCourse(courseId, payload) {
  return submitKnowledgeBaseCourse("PATCH", `${KB_URL}/${courseId}/`, payload);
}
