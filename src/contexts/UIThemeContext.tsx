import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type ThemeType = "light" | "dark" | "system";

interface UIThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  isDarkMode: boolean;
}

const UIThemeContext = createContext<UIThemeContextType | undefined>(undefined);

interface UIThemeProviderProps {
  children: ReactNode;
}

export const UIThemeProvider: React.FC<UIThemeProviderProps> = ({
  children,
}) => {
  // Get initial theme from localStorage or default to 'system'
  const initialTheme = (): ThemeType => {
    const savedTheme = localStorage.getItem("app-theme");
    if (
      savedTheme &&
      (savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "system")
    ) {
      return savedTheme as ThemeType;
    }
    return "system";
  };

  const [theme, setThemeState] = useState<ThemeType>(initialTheme);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Calculate if we should use dark mode based on theme and system preference
  const calculateIsDarkMode = (currentTheme: ThemeType) => {
    if (currentTheme === "system") {
      // Check system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return currentTheme === "dark";
  };

  // Update theme in state and localStorage
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("app-theme", newTheme);
  };

  // Initialize dark mode state
  useEffect(() => {
    setIsDarkMode(calculateIsDarkMode(theme));
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        setIsDarkMode(mediaQuery.matches);
      }
    };

    // Set up listener for changes
    mediaQuery.addEventListener("change", handleChange);

    // Clean up
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  // Apply theme class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <UIThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDarkMode,
      }}
    >
      {children}
    </UIThemeContext.Provider>
  );
};

// Custom hook to use the UIThemeContext
export const useUITheme = () => {
  const context = useContext(UIThemeContext);
  if (context === undefined) {
    throw new Error("useUITheme must be used within a UIThemeProvider");
  }
  return context;
};

export default UIThemeContext;
