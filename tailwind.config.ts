import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import animate from "tailwindcss-animate";

/**
 * Every colour is a CSS variable triplet (see app/globals.css) so the same
 * utility class resolves to the dark value under html.dark and the light
 * value under html.light, with opacity modifiers intact (M73). The ink
 * scale inverts in light: ink-950 is always the page, ink-50 always the
 * strongest text.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1320px",
      },
    },
    extend: {
      colors: {
        ink: {
          950: v("ink-950"),
          900: v("ink-900"),
          850: v("ink-850"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
          400: v("ink-400"),
          300: v("ink-300"),
          200: v("ink-200"),
          100: v("ink-100"),
          50: v("ink-50"),
        },
        electric: {
          DEFAULT: v("electric-500"),
          200: v("electric-200"),
          300: v("electric-300"),
          400: v("electric-400"),
          500: v("electric-500"),
          600: v("electric-600"),
          700: v("electric-700"),
        },
        neon: {
          DEFAULT: v("neon-500"),
          200: v("neon-200"),
          300: v("neon-300"),
          400: v("neon-400"),
          500: v("neon-500"),
          600: v("neon-600"),
        },
        signal: {
          DEFAULT: v("signal-400"),
          400: v("signal-400"),
          500: v("signal-500"),
        },
        // The brand kit (M118): the public page sets --brand-* from the project's palette; the defaults equal electric-500 and signal-400.
        brand: {
          primary: v("brand-primary"),
          accent: v("brand-accent"),
        },
        // Field errors and inline error text (33 uses) read on both canvases.
        rose: {
          400: v("rose-400"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in-up": "fade-in-up 0.6s ease-out forwards",
        shimmer: "shimmer 8s linear infinite",
        blob: "blob 18s ease-in-out infinite",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        blob: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(30px,-20px) scale(1.05)" },
          "66%": { transform: "translate(-20px,15px) scale(0.97)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.65" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [
    animate,
    // `light:` for the few places the inverted scale is not enough.
    plugin(({ addVariant }) => addVariant("light", "html.light &")),
  ],
};

export default config;
