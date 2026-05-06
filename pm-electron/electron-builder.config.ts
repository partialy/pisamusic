import type { Configuration } from "electron-builder";

const config: Configuration = {
  appId: "cn.partialy.pisamusic.desktop",
  productName: "PisaMusic",
  directories: {
    output: "release",
  },
  files: ["out/**", "package.json"],
  asarUnpack: ["**/*.node"],
  win: {
    target: ["nsis"],
    artifactName: "${productName}-${version}-${arch}.${ext}",
  },
  mac: {
    target: ["dmg"],
  },
  linux: {
    target: ["AppImage"],
    category: "Audio",
  },
};

export default config;
