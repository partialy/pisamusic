export default {
  appId: "cn.partialy.pmdesk",
  productName: "Pisa\sMusic",
  icon: "public/logo-64.png",
  directories: {
    output: "app",
    app: "."
  },
  files: ["out/**/*","package.json","public/**/*"],
  extraResources: [
    {
      from: "data",
      to: "../data",
      filter: ["**/*"],
    },
  ],
};
