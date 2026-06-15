import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const mockUseUser = vi.fn();
const mockAlert = vi.fn();

vi.mock("./store/slices/userSlice", () => ({
  useUser: () => mockUseUser(),
}));

vi.mock("./hooks/useDialog", () => ({
  useAlert: () => mockAlert,
}));

const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const pastDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const renderProtected = () =>
  render(
    <MemoryRouter>
      <ProtectedRoute>
        <div data-testid="protected-content">CRM Content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while company is loading", () => {
    mockUseUser.mockReturnValue({
      company: null,
      companyLoading: true,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(screen.getByText("Загрузка...")).toBeInTheDocument();
  });

  it("redirects when company end_date is missing", () => {
    mockUseUser.mockReturnValue({
      company: {},
      companyLoading: false,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(mockAlert).toHaveBeenCalledWith(
      "Срок действия компании не установлен",
      true,
    );
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects when company subscription expired", () => {
    mockUseUser.mockReturnValue({
      company: { end_date: pastDate() },
      companyLoading: false,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(mockAlert).toHaveBeenCalledWith(
      "Срок действия компании истек",
      true,
    );
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders children when company subscription is active", () => {
    mockUseUser.mockReturnValue({
      company: { end_date: futureDate() },
      companyLoading: false,
      profile: { role: "owner" },
      tariff: "Pro",
      sector: "market",
    });

    renderProtected();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
