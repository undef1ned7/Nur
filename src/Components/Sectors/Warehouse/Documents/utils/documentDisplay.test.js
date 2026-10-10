import { describe, it, expect } from "vitest";
import {
  formatDocumentDateTime,
  formatDocumentNumber,
  formatTransferRoute,
  getDocumentSubtitle,
} from "./documentDisplay";
import { formatWholesaleModeLabel } from "../../utils/wholesalePricing";

describe("documentDisplay", () => {
  it("B41: дата без секунд и двоеточия после года", () => {
    expect(formatDocumentDateTime(new Date(2026, 8, 18, 17, 10, 23))).toBe(
      "18.09.2026 17:10",
    );
    expect(formatDocumentDateTime(null)).toBe("—");
  });

  it("B20: реальный номер или стабильный «Черновик <id>»", () => {
    expect(formatDocumentNumber({ number: "НАКЛ-00012", id: "x" })).toBe(
      "НАКЛ-00012",
    );
    const draft = { number: "", id: "3f2a9c1e-1111-2222-3333-444455556666" };
    expect(formatDocumentNumber(draft)).toBe("Черновик 3F2A9C1E");
    expect(formatDocumentNumber({ ...draft })).toBe(formatDocumentNumber(draft));
  });

  it("B22: откуда → куда с фолбэками", () => {
    expect(
      formatTransferRoute({ warehouse_from_name: "Основной", warehouse_to_name: "Филиал" }),
    ).toBe("Основной → Филиал");
    expect(
      formatTransferRoute({ warehouse_from: { id: 1, name: "А" }, warehouse_to: "w2" }, [
        { id: "w2", name: "Б" },
      ]),
    ).toBe("А → Б");
  });

  it("B29: подзаголовок по типу документа", () => {
    expect(getDocumentSubtitle("PURCHASE")).toBe("Создание документа закупа");
    expect(getDocumentSubtitle("TRANSFER", true)).toBe(
      "Редактирование документа перемещения",
    );
  });

  it("B09: подпись режима совпадает с полем формы товара", () => {
    expect(formatWholesaleModeLabel(false)).toBe("Оптовая цена");
    expect(formatWholesaleModeLabel(true)).toBe("Цена агента");
  });
});
