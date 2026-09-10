import { describe, it, expect, beforeEach } from "vitest";
import {
  NOTIFICATIONS_ENABLED_STORAGE_KEY,
  areNotificationsEnabled,
  setNotificationsEnabled,
} from "../src/config/notificationPreferences";

describe("notificationPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enabled by default when unset", () => {
    expect(areNotificationsEnabled()).toBe(true);
  });

  it("persists disabled state", () => {
    setNotificationsEnabled(false);
    expect(localStorage.getItem(NOTIFICATIONS_ENABLED_STORAGE_KEY)).toBe(
      "false",
    );
    expect(areNotificationsEnabled()).toBe(false);
  });

  it("persists enabled state", () => {
    setNotificationsEnabled(false);
    setNotificationsEnabled(true);
    expect(areNotificationsEnabled()).toBe(true);
  });
});
