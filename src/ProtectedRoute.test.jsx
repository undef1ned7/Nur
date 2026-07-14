import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
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
    <MemoryRouter initialEntries={["/crm"]}>
      <ProtectedRoute>
        <div data-testid="protected-content">CRM Content</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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

  it("redirects when company end_date is missing", async () => {
    mockUseUser.mockReturnValue({
      company: {},
      companyLoading: false,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        "Срок действия компании не установлен",
        true,
      );
    });
  });

  it("redirects when company subscription expired", async () => {
    mockUseUser.mockReturnValue({
      company: { end_date: pastDate() },
      companyLoading: false,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        "Срок действия компании истек",
        true,
      );
    });
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

  it("renders children while company is not yet loaded", () => {
    mockUseUser.mockReturnValue({
      company: null,
      companyLoading: false,
      profile: null,
      tariff: "",
      sector: "",
    });

    renderProtected();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});
