/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        panel: "#161b27",
        border: "#1e2d40",
        accent: "#16a34a",
        accentSoft: "#4ade80",
        text: "#f1f5f9",
        muted: "#94a3b8",
        danger: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
