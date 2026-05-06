/**
 * Pm 内嵌页共用 Tailwind 配置。引入顺序：先 tailwind.js，再本文件，最后（可选）页面内覆盖。
 * 页面若需追加 extend，可在其后执行 Object.assign(tailwind.config.theme.extend, { ... })。
 */
(function () {
  tailwind.config = {
    darkMode: 'media',
    theme: {
      extend: {
        fontFamily: {
          sans: ['system-ui', 'Segoe UI', 'Roboto', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
          display: ['system-ui', 'Segoe UI', 'Roboto', 'PingFang SC', 'sans-serif'],
        },
        borderRadius: { '4xl': '2.5rem' },
      },
    },
  };
})();
