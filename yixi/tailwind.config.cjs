/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx,js,jsx}",
  ],
  prefix: "tw-",
  safelist: [
    "tw-flex",
    "tw-grid",
    "tw-items-center",
    "tw-gap-2",
    "tw-text-primary",
    "tw-bg-default",
  ],
  corePlugins: {
    // 关闭 Tailwind preflight，避免重置现有 Naive UI 与历史全局样式。
    preflight: true,
  },
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "text-default": "var(--color-text-default)",
        "text-secondary": "var(--color-text-secondary)",
        "bg-default": "var(--color-bg-default)",
        "bg-secondary": "var(--color-bg-secondary)",
        "border-default": "var(--color-border-default)",
      },
      borderRadius: {
        app: "12px",
      },
    },
  },
  plugins: [],
};
