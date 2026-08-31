import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

export function flattenLessons(courses) {
  if (!courses?.length) return [];

  return courses.flatMap((course) =>
    (course.lessons || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({
        ...lesson,
        courseId: course.id,
        courseTitle: course.title,
      })),
  );
}

export function formatLessonDate(dateString, localeCode = "ru") {
  if (!dateString) return "";
  try {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: ru,
    });
  } catch {
    return "";
  }
}

export function filterLessons(lessons, { courseId, search }) {
  let result = lessons;

  if (courseId) {
    result = result.filter((lesson) => lesson.courseId === courseId);
  }

  const query = search?.trim().toLowerCase();
  if (query) {
    result = result.filter(
      (lesson) =>
        lesson.title?.toLowerCase().includes(query) ||
        lesson.description?.toLowerCase().includes(query),
    );
  }

  return result;
}

export function findLessonById(courses, lessonId) {
  for (const course of courses || []) {
    const lesson = course.lessons?.find((l) => l.id === lessonId);
    if (lesson) {
      return {
        ...lesson,
        courseId: course.id,
        courseTitle: course.title,
      };
    }
  }
  return null;
}

export function parseVideoUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      let videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace(/^\//, "").split("/")[0];
      }
      if (videoId) return { provider: "youtube", id: videoId };
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const videoId = segments[segments.length - 1];
      if (videoId) return { provider: "vimeo", id: videoId };
    }
  } catch {
    return null;
  }

  return null;
}

export function getVideoThumbnail(url) {
  const video = parseVideoUrl(url);
  if (!video) return null;

  if (video.provider === "youtube") {
    return `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
  }

  if (video.provider === "vimeo") {
    return `https://vumbnail.com/${video.id}.jpg`;
  }

  return null;
}

export function resolveMediaUrl(url) {
  const trimmed = url?.trim();
  if (!trimmed) return "";

  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return trimmed;
  }

  const base = import.meta.env.VITE_API_URL || "https://app.nurcrm.kg/api";
  const origin = base.replace(/\/api\/?$/, "");
  return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export const THUMBNAIL_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;

export function validateThumbnailFile(file) {
  if (!file) return null;

  if (!file.type?.startsWith("image/")) {
    return "Превью: выберите изображение (JPG, PNG, WebP или GIF)";
  }

  if (file.size > THUMBNAIL_MAX_SIZE) {
    return "Превью: размер файла не более 5 МБ";
  }

  return null;
}

export function revokeLessonThumbnailPreview(lesson) {
  if (lesson?.thumbnailPreview?.startsWith("blob:")) {
    URL.revokeObjectURL(lesson.thumbnailPreview);
  }
}

export function getLessonThumbnail(lesson) {
  if (lesson?.thumbnailPreview) return lesson.thumbnailPreview;

  const custom = lesson?.thumbnail?.trim();
  if (custom) return resolveMediaUrl(custom);

  return getVideoThumbnail(lesson?.url);
}

export function getVideoSource(url) {
  if (!url) return { type: "none" };

  const video = parseVideoUrl(url);

  if (video?.provider === "youtube") {
    return {
      type: "iframe",
      src: `https://www.youtube.com/embed/${video.id}`,
    };
  }

  if (video?.provider === "vimeo") {
    return {
      type: "iframe",
      src: `https://player.vimeo.com/video/${video.id}`,
    };
  }

  return { type: "video", src: url };
}
