import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f6f7f9",
        foreground: "#172033",
        panel: "#ffffff",
        accent: "#0f766e",
      },
    },
  },
  plugins: [],
};

export default config;

