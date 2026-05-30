import { lazy } from "react";

export const NewLanding = lazy(
  () => import("./NewLanding"),
);
export const VideoLessons = lazy(
  () => import("./VideoLessons/VideoLessons"),
);
export const VideoLessonView = lazy(
  () => import("./VideoLessons/VideoLessonView"),
);
export const VideoLessonsAdmin = lazy(
  () => import("./VideoLessons/VideoLessonsAdmin"),
);
