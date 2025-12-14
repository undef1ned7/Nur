import * as React from "react";
import { ThemeProvider, createTheme, CssBaseline, useMediaQuery, GlobalStyles } from "@mui/material";

const THEME_KEY = "mui-theme-mode";

export const ThemeModeContext = React.createContext({
  mode: "light",
  toggleMode: () => {},
  setMode: () => {},
});

export function ThemeModeProvider({ children }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const [mode, setMode] = React.useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return prefersDark ? "dark" : "light";
  });

  React.useEffect(() => {
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const toggleMode = React.useCallback(() => {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }, []);

  const theme = createTheme({
    palette: {
      mode,
      background: {
        default: mode === "dark" ? "#1d1d1d" : "#ffffff",
        paper: mode === "dark" ? "#1d1d1d" : "#ffffff",
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (t) => ({
          html: {
            backgroundColor: `${t.palette.background.default} !important`,
          },
          body: {
            backgroundColor: `${t.palette.background.default} !important`,
          },
          "#root": {
            minHeight: "100vh",
            backgroundColor: "transparent !important",
          },
        }),
      },
    },
  });

  const value = React.useMemo(() => ({ mode, toggleMode, setMode }), [mode, toggleMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
