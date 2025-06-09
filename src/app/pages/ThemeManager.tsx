import React, { ReactNode, useEffect } from 'react';
import { configClass, varsClass } from 'folds';
import {
  DarkTheme,
  LightTheme,
  ThemeContextProvider,
  ThemeKind,
  useActiveTheme,
  useSystemThemeKind,
} from '../hooks/useTheme';

export function UnAuthRouteThemeManager() {
  // TEMPORARY: Force light mode only - always use light theme kind
  // const systemThemeKind = useSystemThemeKind();

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);
    // TEMPORARY: Force light mode only - always add light theme classes
    // if (systemThemeKind === ThemeKind.Dark) {
    //   document.body.classList.add(...DarkTheme.classNames);
    // }
    // if (systemThemeKind === ThemeKind.Light) {
    //   document.body.classList.add(...LightTheme.classNames);
    // }
    document.body.classList.add(...LightTheme.classNames);
  }, []); // TEMPORARY: removed systemThemeKind dependency

  return null;
}

export function AuthRouteThemeManager({ children }: { children: ReactNode }) {
  const activeTheme = useActiveTheme();

  useEffect(() => {
    document.body.className = '';
    document.body.classList.add(configClass, varsClass);

    document.body.classList.add(...activeTheme.classNames);
  }, [activeTheme]);

  return <ThemeContextProvider value={activeTheme}>{children}</ThemeContextProvider>;
}
