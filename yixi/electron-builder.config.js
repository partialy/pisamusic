export default {
  appId: "cn.partialy.pmdesk",
  productName: "PisaMusic",
  icon: "public/pisamusic_icon_1024.png",
  directories: {
    output: "app",
    app: "."
  },
  files: ["out/**/*","package.json","public/**/*"],
  protocols: [
    {
      name: "PisaMusic 一起听邀请",
      schemes: ["pisamusic"],
    },
  ],
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
  mac: {
    category: "public.app-category.music",
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
