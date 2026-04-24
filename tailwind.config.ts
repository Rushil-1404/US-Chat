import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: "#25d366",
        sand: "#f5f0e7",
        cream: "#fbfaf7",
        ink: "#171717",
        mist: "#eef1ed",
      },
      fontFamily: {
        sans: ["var(--font-manrope)"],
      },
      boxShadow: {
        float: "0 18px 36px rgba(25, 35, 24, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
