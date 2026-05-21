export const DEMO_SECTION_ID = "demo";

export function scrollToDemoSection(navigate, pathname) {
  if (pathname === "/") {
    const el = document.getElementById(DEMO_SECTION_ID);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/#${DEMO_SECTION_ID}`);
    }
    return;
  }

  navigate({ pathname: "/", hash: DEMO_SECTION_ID });
}
