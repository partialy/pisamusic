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
  win: {
    target: ["nsis"],
    artifactName: "${productName} Setup ${version}.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
  publish: [
    {
      provider: "generic",
      url: "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    },
  ],
};
