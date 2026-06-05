import { scrollToLandingSection } from "./scrollToLandingSection";

export const DEMO_SECTION_ID = "demo";

export function scrollToDemoSection(navigate, pathname) {
  scrollToLandingSection(navigate, pathname, DEMO_SECTION_ID);
}
