/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "Noto Sans SC", "system-ui", "sans-serif"],
        body: ["Manrope", "Noto Sans SC", "system-ui", "sans-serif"],
      },
      colors: {
        pisa: {
          blue: "#27B8F4",
          ink: "#101828",
          wine: "#7B1D29",
          amber: "#F2A33A",
          mist: "#ECF8FE",
        },
      },
      boxShadow: {
        glow: "0 24px 90px rgba(39, 184, 244, 0.26)",
        panel: "0 24px 70px rgba(16, 24, 40, 0.12)",
      },
    },
  },
  plugins: [],
};
