import { createContext, useContext } from "react";
import { themeVars, type ThemeVars } from "./color";

/** Paleta em uso (calculada no App a partir do time em foco e do modo claro/escuro). */
export const ThemeVarsContext = createContext<ThemeVars>(themeVars({ primary: "#1D428A", secondary: "#FFC72C" }, false));

export const useThemeVars = () => useContext(ThemeVarsContext);
