import { describe, expect, it } from "vitest";
import { buildLessonWritePayload } from "./knowledgeBase";

describe("buildLessonWritePayload", () => {
  const baseLesson = {
    title: "Урок",
    description: "Описание",
    url: "https://youtu.be/abc",
    thumbnail: "",
    thumbnailFile: null,
    thumbnailCleared: false,
    thumbnailTouched: false,
  };

  it("includes id for existing lessons", () => {
    expect(
      buildLessonWritePayload({
        ...baseLesson,
        id: "lesson-uuid",
      }),
    ).toEqual({
      id: "lesson-uuid",
      title: "Урок",
      description: "Описание",
      url: "https://youtu.be/abc",
    });
  });

  it("omits thumbnail when preview was not touched", () => {
    expect(
      buildLessonWritePayload({
        ...baseLesson,
        id: "lesson-uuid",
        thumbnail: "https://app.nurcrm.kg/media/old.jpg",
      }),
    ).toEqual({
      id: "lesson-uuid",
      title: "Урок",
      description: "Описание",
      url: "https://youtu.be/abc",
    });
  });

  it("sends empty thumbnail on explicit clear", () => {
    expect(
      buildLessonWritePayload({
        ...baseLesson,
        id: "lesson-uuid",
        thumbnail: "",
        thumbnailCleared: true,
        thumbnailTouched: true,
      }),
    ).toMatchObject({ thumbnail: "" });
  });

  it("sends thumbnail URL when user entered a link", () => {
    expect(
      buildLessonWritePayload({
        ...baseLesson,
        thumbnail: "https://cdn.example.com/p.jpg",
        thumbnailTouched: true,
      }),
    ).toMatchObject({
      thumbnail: "https://cdn.example.com/p.jpg",
    });
  });

  it("returns thumbnailFile for multipart upload", () => {
    const file = new File(["x"], "preview.jpg", { type: "image/jpeg" });

    expect(
      buildLessonWritePayload({
        ...baseLesson,
        id: "lesson-uuid",
        thumbnailFile: file,
        thumbnailTouched: true,
      }),
    ).toEqual({
      id: "lesson-uuid",
      title: "Урок",
      description: "Описание",
      url: "https://youtu.be/abc",
      thumbnailFile: file,
    });
  });
});
