import { describe, expect, it } from "vitest";
import { hyphenateLongWord } from "./hyphenation";

describe("hyphenateLongWord", () => {
  it("не режет короткие слова", () => {
    expect(hyphenateLongWord("Молоко")).toEqual(["Молоко"]);
    expect(hyphenateLongWord("Кабель-ВВГ-3х2.5")).toEqual(["Кабель-ВВГ-3х2.5"]);
  });

  it("возвращает пустую строку как есть", () => {
    expect(hyphenateLongWord("")).toEqual([""]);
  });

  it("режет длинное слово по разделителям", () => {
    expect(hyphenateLongWord("Кабель-ВВГнг-LS-3х2.5-ГОСТ31996")).toEqual([
      "Кабель-",
      "ВВГнг-",
      "LS-",
      "3х2.",
      "5-",
      "ГОСТ3199",
      "6",
    ]);
  });

  it("режет длинное слово без разделителей кусками", () => {
    expect(hyphenateLongWord("АБВГДЕЖЗИКЛМНОПРСТУФ")).toEqual([
      "АБВГДЕЖЗ",
      "ИКЛМНОПР",
      "СТУФ",
    ]);
  });

  it("склеенные части дают исходное слово", () => {
    const word = "Профнастил/оцинкованный_1250х2000мм(С8)";
    expect(hyphenateLongWord(word).join("")).toBe(word);
  });
});
