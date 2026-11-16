import { configurePalette, FALLBACK_PALETTE, type FlowOptions, type Palette } from './flowPalette';

export class CoverFlowRenderer {
  private ctx: CanvasRenderingContext2D;
  private source = FALLBACK_PALETTE;
  private from = FALLBACK_PALETTE;
  private target = FALLBACK_PALETTE;
  private displayed = FALLBACK_PALETTE;
  private transitionElapsed = 1250;
  private phase = 0;
  private frame = 0;
  private last = 0;
  private lastDraw = 0;
  private running = false;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private canvas:HTMLCanvasElement;
  private options:FlowOptions;
  constructor(canvas: HTMLCanvasElement, options: FlowOptions) {
    this.canvas=canvas;this.options=options;
    const context=canvas.getContext('2d');
    if(!context) throw new Error('Canvas 2D 不可用');
    this.ctx=context;
    this.target = this.from = this.displayed = configurePalette(this.source,options);
  }
  resize(width: number,height: number,dpr: number) {
    this.width=Math.max(1,width); this.height=Math.max(1,height); this.dpr=dpr;
    this.canvas.width=Math.max(1,Math.round(width*dpr*this.options.scale));
    this.canvas.height=Math.max(1,Math.round(height*dpr*this.options.scale));
    this.draw();
  }
  setOptions(options: FlowOptions) {
    const scaleChanged = this.options.scale!==options.scale;
    this.options=options; this.setPalette(this.source);
    if(scaleChanged) this.resize(this.width,this.height,this.dpr);
  }
  setPalette(palette: Palette) {
    this.source=palette; this.from=this.displayed; this.target=configurePalette(palette,this.options);
    this.transitionElapsed=this.running ? 0 : 1250; this.draw();
  }
  setRunning(running: boolean) {
    if(this.running===running) return;
    this.running=running; cancelAnimationFrame(this.frame); this.frame=0; this.last=0; this.lastDraw=0;
    if(running) this.frame=requestAnimationFrame(this.tick);
    else this.draw();
  }
  private tick = (now: number) => {
    if(!this.running) return;
    const delta=this.last ? Math.min(now-this.last,150) : 0; this.last=now;
    this.phase+=delta/1000*this.options.speed;
    this.transitionElapsed=Math.min(1250,this.transitionElapsed+delta);
    if(now-this.lastDraw>=1000/this.options.fps) {this.draw();this.lastDraw=now;}
    this.frame=requestAnimationFrame(this.tick);
  };
  private draw() {
    const ctx=this.ctx, w=this.canvas.width,h=this.canvas.height;
    const t=Math.min(1,this.transitionElapsed/1250), eased=t*t*(3-2*t);
    this.displayed=this.target.map((color,i)=>color.map((v,j)=>this.from[i][j]*(1-eased)+v*eased) as [number,number,number]);
    const css=(color:number[],alpha=1)=>`rgba(${color.map(v=>Math.round(v)).join(',')},${alpha})`;
    ctx.clearRect(0,0,w,h); ctx.fillStyle=css(this.displayed[0]);ctx.fillRect(0,0,w,h);
    for(let i=0;i<4;i++) {
      const phase=this.phase*Math.PI*2/(16+i*3.7)+i*1.618;
      const amplitude=this.options.amplitude/50;
      const x=((i%2===0?.22:.78)+amplitude*(.23*Math.sin(phase)+.09*Math.sin(phase*.61)))*w;
      const y=((i<2?.25:.77)+amplitude*(.23*Math.cos(phase*.83)+.08*Math.sin(phase*1.31)))*h;
      const radius=Math.max(w,h)*(.72+.11*Math.sin(phase*.71));
      ctx.save();ctx.translate(x,y);ctx.scale(1,1.12);
      const alpha=(55+this.options.intensity*.95)/255;
      const gradient=ctx.createRadialGradient(0,0,0,0,0,radius);
      gradient.addColorStop(0,css(this.displayed[i+1],alpha));
      gradient.addColorStop(.35,css(this.displayed[i+1],alpha*.63));gradient.addColorStop(1,css(this.displayed[i+1],0));
      ctx.fillStyle=gradient;ctx.fillRect(-w*4,-h*4,w*8,h*8);ctx.restore();
    }
    const luminance=Math.max(...this.displayed.slice(1).map(c=>.2126*c[0]/255+.7152*c[1]/255+.0722*c[2]/255));
    ctx.fillStyle=`rgba(0,0,0,${Math.min(60,18+luminance*65)/255})`;ctx.fillRect(0,0,w,h);
  }
  dispose() {this.running=false;cancelAnimationFrame(this.frame);}
}
