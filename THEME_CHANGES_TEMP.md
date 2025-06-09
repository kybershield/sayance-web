# TEMPORARY THEME CHANGES - Light Mode Only

This file documents all the changes made to force light mode only. To revert back to full theme support, undo the changes listed below:

## Changes Made:

### 1. src/app/hooks/useTheme.ts

- Modified `useThemes()` to only return `[LightTheme, SilverTheme]` instead of `[LightTheme, SilverTheme, DarkTheme, ButterTheme]`
- Modified `useThemeNames()` to only include light theme names
- Modified `useSystemThemeKind()` to always return `ThemeKind.Light`
- Modified `useActiveTheme()` to always return light themes

### 2. src/app/pages/ThemeManager.tsx

- Modified `UnAuthRouteThemeManager()` to always use `LightTheme.classNames`

### 3. config.json

- Removed dark themes from themes array. **ORIGINAL THEMES WERE:**

```json
{
  "name": "Dark",
  "id": "dark"
},
{
  "name": "Butter",
  "id": "butter"
}
```

## To Revert:

1. Uncomment all lines marked with "TEMPORARY: Force light mode only"
2. Add back the dark themes to config.json as shown above
3. Delete this file (THEME_CHANGES_TEMP.md)
