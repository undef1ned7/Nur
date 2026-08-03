import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SearchSelect from "./SearchSelect";

const options = [
  { value: "", label: "— Без поставщика —" },
  { value: "1", label: "ОсОО Ромашка", searchText: "ОсОО Ромашка 0555112233" },
  { value: "2", label: "ИП Иванов" },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SearchSelect", () => {
  it("показывает «Смотреть ещё» и вызывает догрузку", () => {
    const onLoadMore = vi.fn();
    render(
      <SearchSelect
        value=""
        onChange={() => {}}
        options={options}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(screen.getByText("Смотреть ещё"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("не показывает «Смотреть ещё», когда страниц больше нет", () => {
    render(
      <SearchSelect value="" onChange={() => {}} options={options} hasMore={false} />,
    );
    fireEvent.focus(screen.getByRole("textbox"));
    expect(screen.queryByText("Смотреть ещё")).toBeNull();
  });

  it("отдаёт введённый текст наружу (серверный поиск) и находит по searchText", () => {
    const onQueryChange = vi.fn();
    render(
      <SearchSelect
        value=""
        onChange={() => {}}
        options={options}
        onQueryChange={onQueryChange}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0555" } });

    expect(onQueryChange).toHaveBeenLastCalledWith("0555");
    // локальный фильтр не отсекает совпадение по телефону
    expect(screen.getByText("ОсОО Ромашка")).toBeTruthy();
    expect(screen.queryByText("ИП Иванов")).toBeNull();
  });

  it("пункт сброса очищает значение и не ломает рендер списка", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onChange = vi.fn();
    render(<SearchSelect value="1" onChange={onChange} options={options} />);

    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.click(screen.getByText("— Без поставщика —"));

    expect(onChange).toHaveBeenCalledWith("");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
