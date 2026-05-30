import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { scrollToDemoSection } from "../utils/scrollToDemo";

export function useScrollToDemo() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(() => {
    scrollToDemoSection(navigate, pathname);
  }, [navigate, pathname]);
}
