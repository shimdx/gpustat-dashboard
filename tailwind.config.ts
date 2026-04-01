import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        steel: "#475569",
        cloud: "#e2e8f0",
        mist: "#f8fafc",
        mint: "#6ee7b7",
        amber: "#fbbf24",
        coral: "#fb7185",
        sky: "#38bdf8",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
