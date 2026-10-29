/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#F7FBF7",
          section: "#E5F5EA",
          cardPale: "#EDF7EF",
          forest: "#075B46",
          emerald: "#087F5B",
          text: "#173C32",
          muted: "#6B7C74",
          border: "#D7E5DB",
          white: "#FFFFFF",
        },
        eco: {
          50: "#F7FBF7",
          100: "#E5F5EA",
          200: "#EDF7EF",
          300: "#bbf7d0",
          400: "#4ade80",
          500: "#087F5B",
          600: "#075B46",
          700: "#15803d",
          800: "#166534",
          900: "#173C32",
          950: "#052e16",
        },
        dark: {
          bg: "#F7FBF7",
          card: "#FFFFFF",
          border: "#D7E5DB",
          hover: "#EDF7EF",
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', '"Playfair Display"', "Georgia", "serif"],
        sans: ['"DM Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        card: "0 2px 8px -1px rgba(7, 91, 70, 0.04), 0 1px 3px -1px rgba(7, 91, 70, 0.02)",
        "card-hover": "0 8px 24px -2px rgba(7, 91, 70, 0.08), 0 3px 6px -2px rgba(7, 91, 70, 0.03)",
        modal: "0 20px 40px -10px rgba(7, 91, 70, 0.15)",
      },
    },
  },
  plugins: [],
};
