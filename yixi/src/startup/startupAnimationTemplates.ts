import {
  isCardlessStartupStyle,
  type StartupAnimationStyle,
} from "./startupAnimationOptions";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createLogoImg(logoUrl: string): HTMLImageElement {
  const img = document.createElement("img");
  img.alt = "PisaMusic";
  if (logoUrl) img.src = logoUrl;
  return img;
}

function createShimmerLoadingText(extraClass = ""): HTMLDivElement {
  const wrap = el("div", `sa-shimmer-text ${extraClass}`.trim());
  wrap.setAttribute("aria-label", "正在启动...");
  for (const ch of ["正", "在", "启", "动", ".", ".", "."]) {
    wrap.appendChild(el("span", undefined, ch));
  }
  return wrap;
}

function createCloseSvgButton(onClick?: () => void): HTMLButtonElement {
  const btn = el("button", "sa-close-button");
  btn.type = "button";
  btn.setAttribute("aria-label", "关闭");
  btn.title = "关闭";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "13");
  svg.setAttribute("height", "13");
  svg.setAttribute("viewBox", "0 0 14 14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 3L11 11M11 3L3 11");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  btn.appendChild(svg);

  if (onClick) {
    btn.addEventListener("click", onClick);
  }
  return btn;
}

function buildDefaultContent(logoUrl: string): HTMLElement {
  const inner = el("div", "sa-default-inner");
  const logoShell = el("div", "sa-default-logo-shell");
  logoShell.appendChild(createLogoImg(logoUrl));
  inner.appendChild(logoShell);
  inner.appendChild(el("h1", "sa-default-brand", "Pisa Music"));
  inner.appendChild(createShimmerLoadingText("sa-default-loading-text"));
  return inner;
}

function buildAuroraSweepContent(logoUrl: string): HTMLElement[] {
  const beam = el("div", "sa-as-ambient-beam");
  const content = el("div", "sa-as-content");
  const hero = el("div", "sa-as-hero");

  const logoWrap = el("div", "sa-as-logo-wrap");
  logoWrap.appendChild(el("div", "sa-as-logo-halo"));
  logoWrap.appendChild(el("div", "sa-as-logo-ring"));
  const logoBox = el("div", "sa-as-logo-box");
  logoBox.appendChild(createLogoImg(logoUrl));
  logoWrap.appendChild(logoBox);

  const brandWrap = el("div", "sa-as-brand-wrap");
  const titleStage = el("div", "sa-as-title-stage");
  const glow = el("span", "sa-as-title-glow", "Pisa Music");
  glow.setAttribute("aria-hidden", "true");
  titleStage.appendChild(glow);
  titleStage.appendChild(el("h1", "sa-as-title", "Pisa Music"));
  brandWrap.appendChild(titleStage);
  brandWrap.appendChild(el("div", "sa-as-subtitle", "Simple Pure"));

  hero.appendChild(logoWrap);
  hero.appendChild(brandWrap);
  content.appendChild(hero);
  content.appendChild(createShimmerLoadingText());
  return [beam, content];
}

function buildVinylWaveContent(logoUrl: string): HTMLElement {
  const layout = el("div", "sa-vw-layout");
  const stage = el("div", "sa-vw-stage");

  const vinylWrap = el("div", "sa-vw-vinyl-wrap");
  vinylWrap.appendChild(el("div", "sa-vw-ripple"));
  vinylWrap.appendChild(el("div", "sa-vw-ripple is-delay"));
  const disc = el("div", "sa-vw-disc");
  const discCore = el("div", "sa-vw-disc-core");
  discCore.appendChild(createLogoImg(logoUrl));
  disc.appendChild(discCore);
  vinylWrap.appendChild(disc);

  const info = el("div", "sa-vw-info");
  const brandRow = el("div", "sa-vw-brand-row");
  brandRow.appendChild(el("h1", "sa-vw-title", "Pisa Music"));
  const eq = el("div", "sa-vw-eq");
  eq.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 5; i++) eq.appendChild(el("span"));
  brandRow.appendChild(eq);
  info.appendChild(brandRow);
  info.appendChild(el("div", "sa-vw-tagline", "Simple Pure"));

  stage.appendChild(vinylWrap);
  stage.appendChild(info);
  layout.appendChild(stage);
  layout.appendChild(el("div", "sa-sweep-status", "正在启动..."));
  return layout;
}

function buildFluidAuroraContent(logoUrl: string): HTMLElement[] {
  const b1 = el("div", "sa-fa-blob sa-fa-blob-1");
  const b2 = el("div", "sa-fa-blob sa-fa-blob-2");
  const b3 = el("div", "sa-fa-blob sa-fa-blob-3");
  const layer = el("div", "sa-fa-glass-layer");

  const logoCard = el("div", "sa-fa-logo-card");
  logoCard.appendChild(createLogoImg(logoUrl));
  layer.appendChild(logoCard);

  const letters = el("div", "sa-fa-letters");
  letters.setAttribute("aria-label", "Pisa Music");
  for (const ch of ["P", "i", "s", "a", " ", "M", "u", "s", "i", "c"]) {
    letters.appendChild(el("span", ch === " " ? "space" : undefined, ch === " " ? "" : ch));
  }
  layer.appendChild(letters);

  const capsule = el("div", "sa-fa-capsule");
  capsule.appendChild(el("span", "sa-fa-spinner"));
  capsule.appendChild(el("span", undefined, "正在启动..."));
  layer.appendChild(capsule);

  return [b1, b2, b3, layer];
}

function buildStarOrbitContent(logoUrl: string): HTMLElement {
  const scene = el("div", "sa-so-scene");
  scene.appendChild(el("div", "sa-so-ambient-glow"));

  const orbitStage = el("div", "sa-so-orbit-stage");
  const outer = el("div", "sa-so-orbit sa-so-orbit-outer");
  outer.appendChild(el("span", "sa-so-orbit-dot"));
  orbitStage.appendChild(outer);
  orbitStage.appendChild(el("div", "sa-so-orbit sa-so-orbit-inner"));

  const logoCore = el("div", "sa-so-logo-core");
  logoCore.appendChild(createLogoImg(logoUrl));
  orbitStage.appendChild(logoCore);

  const textCol = el("div", "sa-so-text-col");
  const titleWrap = el("div", "sa-so-title-wrap");
  const glow = el("span", "sa-so-title-glow", "Pisa Music");
  glow.setAttribute("aria-hidden", "true");
  titleWrap.appendChild(glow);
  titleWrap.appendChild(el("h1", "sa-so-title", "Pisa Music"));
  textCol.appendChild(titleWrap);
  textCol.appendChild(createShimmerLoadingText("sa-float-status"));

  scene.appendChild(orbitStage);
  scene.appendChild(textCol);
  return scene;
}

function buildRippleFieldContent(logoUrl: string): HTMLElement {
  const scene = el("div", "sa-rf-scene");
  const rippleStage = el("div", "sa-rf-ripple-stage");

  for (const cls of ["r1", "r2", "r3"]) {
    const r = el("div", `sa-rf-ripple ${cls}`);
    r.setAttribute("aria-hidden", "true");
    rippleStage.appendChild(r);
  }
  const logo = el("div", "sa-rf-logo");
  logo.appendChild(createLogoImg(logoUrl));
  rippleStage.appendChild(logo);

  scene.appendChild(rippleStage);
  scene.appendChild(el("h1", "sa-rf-title", "Pisa Music"));
  scene.appendChild(createShimmerLoadingText("sa-float-status"));
  return scene;
}

function buildAuroraHorizonContent(logoUrl: string): HTMLElement {
  const scene = el("div", "sa-ah-scene");
  const topRow = el("div", "sa-ah-top-row");

  const logo = el("div", "sa-ah-logo");
  logo.appendChild(createLogoImg(logoUrl));

  const titleBox = el("div", "sa-ah-title-box");
  titleBox.appendChild(el("h1", "sa-ah-title", "Pisa Music"));
  titleBox.appendChild(el("div", "sa-ah-sub", "Simple Pure"));

  topRow.appendChild(logo);
  topRow.appendChild(titleBox);

  scene.appendChild(topRow);
  scene.appendChild(el("div", "sa-ah-horizon"));
  scene.appendChild(createShimmerLoadingText("sa-float-status sa-ah-bottom-status"));
  return scene;
}

export interface MountStartupStageOptions {
  style: StartupAnimationStyle;
  logoUrl: string;
  showCloseButton?: boolean;
  onCloseClick?: () => void;
}

export function mountStartupLoadingStage(
  container: HTMLElement,
  options: MountStartupStageOptions,
): void {
  const { style, logoUrl, showCloseButton = true, onCloseClick } = options;
  const cardless = isCardlessStartupStyle(style);

  container.replaceChildren();
  const shell = el(
    "div",
    `sa-loading-shell sa-style-${style}${cardless ? " is-cardless" : ""}`,
  );

  if (showCloseButton) {
    shell.appendChild(createCloseSvgButton(onCloseClick));
  }

  switch (style) {
    case "aurora-sweep":
      buildAuroraSweepContent(logoUrl).forEach((node) => shell.appendChild(node));
      break;
    case "vinyl-wave":
      shell.appendChild(buildVinylWaveContent(logoUrl));
      break;
    case "fluid-aurora":
      buildFluidAuroraContent(logoUrl).forEach((node) => shell.appendChild(node));
      break;
    case "star-orbit":
      shell.appendChild(buildStarOrbitContent(logoUrl));
      break;
    case "ripple-field":
      shell.appendChild(buildRippleFieldContent(logoUrl));
      break;
    case "aurora-horizon":
      shell.appendChild(buildAuroraHorizonContent(logoUrl));
      break;
    case "default":
    default:
      shell.appendChild(buildDefaultContent(logoUrl));
      break;
  }

  container.appendChild(shell);
}
