export const LANDING_PATH = "/";

export function scrollToLandingSection(
  navigate,
  pathname,
  sectionId,
  { replace = pathname === LANDING_PATH } = {},
) {
  if (pathname !== LANDING_PATH) {
    navigate({ pathname: LANDING_PATH, hash: sectionId });
    return;
  }

  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  navigate({ pathname: LANDING_PATH, hash: sectionId }, { replace });
}
