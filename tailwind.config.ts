import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1D21",
        steel: { 50:"#F6F7F8",100:"#ECEEF0",200:"#D9DDE2",300:"#B8BEC7",400:"#8B94A1",500:"#646E7D",600:"#4A5363",700:"#373E4B",800:"#262C36",900:"#181C23" },
        torque: { 400:"#FFB02E", 500:"#F59E0B", 600:"#D97706" },
      },
      fontFamily: {
        sans: ["-apple-system","BlinkMacSystemFont","Segoe UI","Roboto","Helvetica Neue","Arial","sans-serif"],
        mono: ["ui-monospace","SFMono-Regular","Menlo","Consolas","monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
