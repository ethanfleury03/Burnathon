/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        serif: [
          "Fraunces",
          "Source Serif 4",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        paper: {
          50: "#FBF9F3",
          100: "#F7F4EC",
          200: "#F1ECDF",
          300: "#E8E2D1",
        },
        ink: {
          50: "#F4F3F0",
          100: "#E2E0DA",
          200: "#C9C6BC",
          300: "#A8A59B",
          400: "#7C7A71",
          500: "#56554F",
          600: "#3A3935",
          700: "#272621",
          800: "#1A1915",
          900: "#0E0D0A",
        },
        accent: {
          50: "#FBF1ED",
          100: "#F4DDD4",
          200: "#E5B4A4",
          300: "#D58975",
          400: "#B95E46",
          500: "#9C3F2F",
          600: "#7F3224",
          700: "#62261B",
        },
        ochre: {
          50: "#FBF3DD",
          100: "#F5E3B2",
          200: "#E9C76C",
          300: "#C69C3C",
          400: "#9E7A28",
          500: "#6F5518",
        },
        moss: {
          50: "#EEF3EA",
          100: "#D5E2CC",
          200: "#A9C098",
          300: "#7A9A65",
          400: "#527640",
          500: "#365728",
        },
        slate2: {
          50: "#EEF2F4",
          100: "#D3DCE2",
          200: "#A4B5C0",
          300: "#6E8797",
          400: "#47606F",
          500: "#2D4452",
        },
      },
      borderColor: {
        DEFAULT: "#E7E1D1",
        rule: "#DDD6C4",
        strong: "#C9C1AA",
      },
      boxShadow: {
        card: "0 1px 0 rgba(26,25,21,0.03), 0 1px 3px rgba(26,25,21,0.06)",
        cardHover: "0 1px 0 rgba(26,25,21,0.04), 0 10px 24px -8px rgba(26,25,21,0.12)",
        focus: "0 0 0 3px rgba(156,63,47,0.15)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      borderRadius: {
        xs: "4px",
        DEFAULT: "6px",
      },
      letterSpacing: {
        tightish: "-0.01em",
        displaytight: "-0.02em",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.75" },
          "50%": { opacity: "0.35" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
        pulseSoft: "pulseSoft 1.8s ease-in-out infinite",
        fadeIn: "fadeIn 200ms ease-out both",
      },
    },
  },
  plugins: [],
};
