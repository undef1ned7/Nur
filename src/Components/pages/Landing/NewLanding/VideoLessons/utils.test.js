import { describe, expect, it } from "vitest";
import {
  getLessonThumbnail,
  getVideoSource,
  getVideoThumbnail,
  parseVideoUrl,
  resolveMediaUrl,
  validateThumbnailFile,
} from "./utils";

describe("parseVideoUrl", () => {
  it("parses youtube.com watch URLs", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      id: "dQw4w9WgXcQ",
    });
  });

  it("parses youtu.be short URLs", () => {
    expect(parseVideoUrl("https://youtu.be/rwJpLv8IIis?list=PLtest")).toEqual({
      provider: "youtube",
      id: "rwJpLv8IIis",
    });
  });

  it("parses vimeo URLs", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")).toEqual({
      provider: "vimeo",
      id: "123456789",
    });
  });

  it("returns null for invalid URLs", () => {
    expect(parseVideoUrl("")).toBeNull();
    expect(parseVideoUrl("not-a-url")).toBeNull();
  });
});

describe("getVideoThumbnail", () => {
  it("returns YouTube thumbnail URL", () => {
    expect(getVideoThumbnail("https://youtu.be/rwJpLv8IIis")).toBe(
      "https://img.youtube.com/vi/rwJpLv8IIis/mqdefault.jpg",
    );
  });

  it("returns Vimeo thumbnail URL", () => {
    expect(getVideoThumbnail("https://vimeo.com/123456789")).toBe(
      "https://vumbnail.com/123456789.jpg",
    );
  });

  it("returns null for unsupported URLs", () => {
    expect(getVideoThumbnail("https://example.com/video.mp4")).toBeNull();
  });
});

describe("getLessonThumbnail", () => {
  it("prefers custom thumbnail over YouTube", () => {
    expect(
      getLessonThumbnail({
        thumbnail: "https://example.com/custom.jpg",
        url: "https://youtu.be/rwJpLv8IIis",
      }),
    ).toBe("https://example.com/custom.jpg");
  });

  it("falls back to YouTube when custom thumbnail is empty", () => {
    expect(
      getLessonThumbnail({
        thumbnail: "",
        url: "https://youtu.be/rwJpLv8IIis",
      }),
    ).toBe("https://img.youtube.com/vi/rwJpLv8IIis/mqdefault.jpg");
  });

  it("prefers local preview over saved thumbnail", () => {
    expect(
      getLessonThumbnail({
        thumbnailPreview: "blob:preview",
        thumbnail: "https://example.com/custom.jpg",
        url: "https://youtu.be/rwJpLv8IIis",
      }),
    ).toBe("blob:preview");
  });
});

describe("resolveMediaUrl", () => {
  it("resolves relative media paths", () => {
    expect(resolveMediaUrl("/media/thumbs/a.jpg")).toBe(
      "https://app.nurcrm.kg/media/thumbs/a.jpg",
    );
  });
});

describe("validateThumbnailFile", () => {
  it("rejects non-image files", () => {
    expect(
      validateThumbnailFile({ type: "application/pdf", size: 1000 }),
    ).toBeTruthy();
  });

  it("accepts valid image files", () => {
    expect(
      validateThumbnailFile({ type: "image/png", size: 1000 }),
    ).toBeNull();
  });
});

describe("getVideoSource", () => {
  it("returns YouTube embed for youtu.be links", () => {
    expect(getVideoSource("https://youtu.be/rwJpLv8IIis")).toEqual({
      type: "iframe",
      src: "https://www.youtube.com/embed/rwJpLv8IIis",
    });
  });
});
