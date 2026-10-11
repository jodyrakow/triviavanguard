// src/styles/theme.js

export const colors = {
  dark: "#2B394A",
  accent: "#DC6A24",
  teal: "#1B998B",
  white: "#FFFFFF",
  gray: "#D8D8D8",
  success: "#1CA46D",
  error: "#DC3545",
};

export const effects = {
  pageBg: "#EEF1F4",
  accentSoft: "rgba(220,106,36,0.10)",
  darkSoft: "rgba(43,57,74,0.10)",
  overlay: "rgba(43,57,74,0.68)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.15)",
  focusRing: `0 0 0 3px rgba(220,106,36,.35)`,
};

export const tokens = {
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  font: {
    body: "Questrial, sans-serif",
    display: "Antonio, sans-serif",
    flavor: "Lora, serif",
  },
  border: {
    thin: "1px solid",
    medium: "2px solid",
    thick: "4px solid",
  },
};

export const scoring = {
  correctBg: colors.accent,
  correctText: colors.white,

  bonusAvailableBg: "rgba(43,57,74,0.10)",
  bonusSelectedBg: colors.dark,
  bonusSelectedText: colors.white,
};