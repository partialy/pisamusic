import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

const REQUIRED_TOKENS = [
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-accent",
  "--text-on-accent",
  "--surface-app",
  "--surface-shell",
  "--surface-panel",
  "--surface-card",
  "--surface-elevated",
  "--surface-player",
  "--surface-input",
  "--surface-control-hover",
  "--surface-control-active",
  "--surface-row-hover",
  "--surface-row-selected",
  "--surface-row-playing",
  "--surface-row-disabled-hover",
  "--border-subtle",
  "--border-strong",
  "--border-row-selected",
  "--border-row-playing",
  "--border-player",
  "--shadow-elevated",
  "--shadow-player",
  "--filter-panel",
  "--filter-player",
  "--slider-rail",
  "--app-image-overlay",
];

function getAllVueFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getAllVueFiles(fullPath));
    } else if (entry.endsWith(".vue")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("theme CSS contracts", () => {
  const colorCssPath = resolve(__dirname, "../styles/theme.color.css");
  const imageCssPath = resolve(__dirname, "../styles/theme.image.css");

  const colorCss = readFileSync(colorCssPath, "utf-8");
  const imageCss = readFileSync(imageCssPath, "utf-8");

  it("defines all required semantic tokens in theme.color.css", () => {
    for (const token of REQUIRED_TOKENS) {
      expect(colorCss).toContain(token);
    }
  });

  it("defines all required semantic tokens in theme.image.css", () => {
    for (const token of REQUIRED_TOKENS) {
      expect(imageCss).toContain(token);
    }
  });

  it("ensures theme.image.css surfaces do not use color-mix or tint with var(--color-primary)", () => {
    // 检查 image 模式不含 color-mix
    expect(imageCss).not.toContain("color-mix(");

    // 检查表面色不包含主色引用
    const surfaceLines = imageCss
      .split("\n")
      .filter((line) => line.trim().startsWith("--surface-"));

    for (const line of surfaceLines) {
      expect(line).not.toContain("var(--color-primary)");
    }
  });

  it("targets data-bg-mode='image' in theme.image.css", () => {
    expect(imageCss).toContain('data-bg-mode="image"');
  });

  it("targets both color-light and color-dark in theme.color.css", () => {
    expect(colorCss).toContain('data-bg-mode="color"');
    expect(colorCss).toContain('data-theme="light"');
    expect(colorCss).toContain('data-theme="dark"');
  });

  it("ensures no Vue components use legacy .is-image-mode class", () => {
    const componentsDir = resolve(__dirname, "../components");
    const viewsDir = resolve(__dirname, "../views");
    const vueFiles = [...getAllVueFiles(componentsDir), ...getAllVueFiles(viewsDir)];

    expect(vueFiles.length).toBeGreaterThan(10);

    for (const filePath of vueFiles) {
      const content = readFileSync(filePath, "utf-8");
      expect(content).not.toContain("is-image-mode");
    }
  });

  it("ensures no Vue components use [data-bg-mode] selectors in style blocks", () => {
    const componentsDir = resolve(__dirname, "../components");
    const viewsDir = resolve(__dirname, "../views");
    const vueFiles = [...getAllVueFiles(componentsDir), ...getAllVueFiles(viewsDir)];

    for (const filePath of vueFiles) {
      const content = readFileSync(filePath, "utf-8");
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
      if (styleMatch) {
        for (const styleBlock of styleMatch) {
          expect(styleBlock).not.toContain("data-bg-mode");
        }
      }
    }
  });
});

