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

export function formatLessonDate(dateString) {
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

export function getVideoSource(url) {
  if (!url) return { type: "none" };

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      let videoId = parsed.searchParams.get("v");
      if (!videoId && parsed.hostname.includes("youtu.be")) {
        videoId = parsed.pathname.replace("/", "");
      }
      if (videoId) {
        return {
          type: "iframe",
          src: `https://www.youtube.com/embed/${videoId}`,
        };
      }
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const videoId = segments[segments.length - 1];
      if (videoId) {
        return {
          type: "iframe",
          src: `https://player.vimeo.com/video/${videoId}`,
        };
      }
    }

    return { type: "video", src: url };
  } catch {
    return { type: "video", src: url };
  }
}
