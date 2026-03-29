import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Inspired by campo at golden hour
        campo: {
          50: "#faf6ee",
          100: "#f0e8d0",
          200: "#e2d0a0",
          300: "#d4b870",
          400: "#c4a040",
          500: "#b08a30",
          600: "#946e24",
          700: "#785620",
          800: "#5c4020",
          900: "#3a2a18",
          950: "#1e1610",
        },
        tierra: {
          50: "#f5f0ea",
          100: "#e8ddd0",
          200: "#d0bba0",
          300: "#b89878",
          400: "#a07850",
          500: "#886040",
          600: "#704c34",
          700: "#583a28",
          800: "#3a2820",
          900: "#1e1a14",
          950: "#12120e",
        },
        pasto: {
          50: "#f0f5e8",
          100: "#dceacc",
          200: "#b8d498",
          300: "#94be64",
          400: "#70a830",
          500: "#5a8a28",
          600: "#487020",
          700: "#385818",
          800: "#284010",
          900: "#1a2a0c",
          950: "#101a08",
        },
      },
    },
  },
  plugins: [],
};
export default config;
