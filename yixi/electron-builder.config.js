export default {
  appId: "cn.partialy.pmdesk",
  productName: "PisaMusic",
  icon: "public/pisamusic_icon_1024.png",
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
