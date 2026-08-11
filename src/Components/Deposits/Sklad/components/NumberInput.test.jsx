import { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";
import NumberInput from "./NumberInput";

const Harness = ({ initial = 1, ...props }) => {
  const [value, setValue] = useState(initial);
  return (
    <NumberInput
      aria-label="поле"
      value={value}
      onCommit={setValue}
      {...props}
    />
  );
};

describe("NumberInput", () => {
  afterEach(cleanup);

  it("даёт стереть значение и набрать новое", async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} min={1} max={100} fallback={1} />);
    const input = screen.getByLabelText("поле");

    await user.clear(input);
    expect(input).toHaveValue(null); // поле реально пустое, а не «1»

    await user.type(input, "25");
    expect(input).toHaveValue(25);
  });

  it("позволяет напечатать 0 и продолжить ввод", async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} min={1} max={100} fallback={1} />);
    const input = screen.getByLabelText("поле");

    await user.clear(input);
    await user.type(input, "0");
    expect(input).toHaveValue(0); // «0» не подменяется на минимум во время ввода

    await user.type(input, "5");
    expect(input).toHaveValue(5);
  });

  it("нормализует значение при потере фокуса", async () => {
    const user = userEvent.setup();
    render(<Harness initial={44} min={20} max={200} fallback={44} />);
    const input = screen.getByLabelText("поле");

    await user.clear(input);
    await user.type(input, "5");
    await user.tab();
    expect(input).toHaveValue(20); // ниже min → подтянулось к min
  });

  it("возвращает fallback, если поле оставили пустым", async () => {
    const user = userEvent.setup();
    render(<Harness initial={30} min={10} max={110} fallback={20} />);
    const input = screen.getByLabelText("поле");

    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue(20);
  });
});
