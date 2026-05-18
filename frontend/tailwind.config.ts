import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#070b12",
        foreground: "#e6edf7",
        panel: "#101827",
        accent: "#20d6c7",
      },
    },
  },
  plugins: [],
};

export default config;
