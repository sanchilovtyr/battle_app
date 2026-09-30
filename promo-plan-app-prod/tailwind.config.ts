import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#111525",
          950: "#0B0E1A",
          900: "#111525",
          800: "#1A2036",
        },
        paper: "#FFFFFF",
        soft: "#F6F6F8",
        line: "#E7E8EE",
        muted: "#70758A",
        brand: {
          DEFAULT: "#CBFF43",
          soft: "#E7F7D7",
        },
        violet: {
          DEFAULT: "#7658F6",
          soft: "#F0EDFF",
        },
      },
      fontFamily: {
        display: ["var(--font-unbounded)", "sans-serif"],
        body: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
