import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      "light",
      "forest",
      {
        dark: {
          primary: "#5A67D8",
          secondary: "#ECC94B",
          accent: "#38B2AC",
          neutral: "#2D3748",
          "base-100": "#1E293B",
          "base-200": "#273849",
          "base-300": "#2E3A4F",
          info: "#3ABFF8",
          success: "#48BB78",
          warning: "#F6E05E",
          error: "#FC8181",
          "--tw-prose-body": "#E2E8F0",
          "--tw-prose-headings": "#F7FAFC"
        }
      }
    ]
  }
}