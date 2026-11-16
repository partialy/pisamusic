import type { PlayerBackgroundConfig } from './backgroundConfig';
import { extractDominantColorFromUrl } from '@/utils/imageColor';
export type FlowOptions = PlayerBackgroundConfig['flow'];
type Color = [number, number, number];
export type Palette = Color[];
export const FALLBACK_PALETTE: Palette = [[8,20,38],[49,120,198],[106,92,203],[22,150,167],[192,82,131]];
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
function hsl(color: Color): Color {
  const [r,g,b] = color.map(v => v / 255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min, l = (max+min)/2;
  const h = !d ? 0 : max === r ? ((g-b)/d+6)%6 : max === g ? (b-r)/d+2 : (r-g)/d+4;
  return [h*60, d ? d/(1-Math.abs(2*l-1)) : 0, l];
}
function rgb([h,s,l]: Color): Color {
  h = ((h % 360)+360)%360/60;
  const c = (1-Math.abs(2*l-1))*s, x = c*(1-Math.abs(h%2-1)), m = l-c/2;
  const v = h<1 ? [c,x,0] : h<2 ? [x,c,0] : h<3 ? [0,c,x] : h<4 ? [0,x,c] : h<5 ? [x,0,c] : [c,0,x];
  return v.map(n => Math.round((n+m)*255)) as Color;
}
export function paletteFromColors(colors: Color[]): Palette {
  if (!colors.length) return FALLBACK_PALETTE.map(c => [...c]);
  const [h,s,l] = hsl(colors[0]);
  const selected = colors.slice(0,4);
  for (const shift of [18,-22,35]) {
    if (selected.length >= 4) break;
    selected.push(rgb([h+shift, s<.08 ? .13 : clamp(s,.2,.82), clamp(l,.3,.68)]));
  }
  return [rgb([h,s,clamp(l,.07,.16)]), ...selected.map(c => {
    const [ch,cs,cl] = hsl(c);
    return rgb([s<.08 ? 215 : ch, s<.08 ? .13 : clamp(cs,.2,.82), clamp(cl,.28,.62)]);
  })];
}
export function configurePalette(source: Palette, options: FlowOptions): Palette {
  const mode = options.colorMode === 'soft' ? .65 : options.colorMode === 'vivid' ? 1.25 : 1;
  return source.map((color,index) => {
    const [h,s,l] = hsl(color);
    return rgb([h,clamp(s*(.35+options.saturation*.013)*mode,0,.88),clamp(l+(options.brightness-50)*(index ? .002 : .001), index ? .18 : .04,index ? .65 : .17)]);
  });
}
export function loadCoverImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => finish(new Error('封面加载超时')), 10000);
    function finish(error?: Error) {
      clearTimeout(timer); image.onload = null; image.onerror = null; signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(image);
    }
    function abort() { finish(new Error('封面请求取消')); image.src = ''; }
    if(signal?.aborted){abort();return;} signal?.addEventListener('abort',abort,{once:true});
    image.onload = () => finish(); image.onerror = () => finish(new Error('封面加载失败'));
    image.src = url;
  });
}
export async function extractFlowPalette(url: string, signal?: AbortSignal): Promise<Palette> {
  try {
    const image = await loadCoverImage(url, signal);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 48;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    if (!ctx) return FALLBACK_PALETTE;
    ctx.drawImage(image,0,0,48,48);
    const pixels = ctx.getImageData(0,0,48,48).data;
    const buckets = new Map<number,{sum:Color;count:number}>();
    for (let i=0;i<pixels.length;i+=4) {
      if (pixels[i+3]<128) continue;
      const key = (pixels[i]>>4)*256+(pixels[i+1]>>4)*16+(pixels[i+2]>>4);
      const bucket = buckets.get(key) ?? {sum:[0,0,0] as Color,count:0};
      bucket.count++; for(let j=0;j<3;j++) bucket.sum[j]+=pixels[i+j]; buckets.set(key,bucket);
    }
    const colors: Color[]=[];
    for (const bucket of [...buckets.values()].sort((a,b)=>b.count-a.count)) {
      const c = bucket.sum.map(v=>v/bucket.count) as Color;
      if(colors.every(old=>Math.hypot(...old.map((v,i)=>v-c[i]))>35)) colors.push(c);
      if(colors.length===4) break;
    }
    return paletteFromColors(colors);
  } catch {
    if(signal?.aborted) return FALLBACK_PALETTE;
    const hex = await extractDominantColorFromUrl(url).catch(()=> '');
    return /^#[0-9a-f]{6}$/i.test(hex) ? paletteFromColors([[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]]) : FALLBACK_PALETTE;
  }
}
