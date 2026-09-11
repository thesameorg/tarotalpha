/**
 * Canvas particle bursts for the reveal: gold or red sparks with gravity, drag and fade, drawn additively so
 * overlapping sparks glow. One rAF loop runs only while a particle is alive; nothing is allocated per frame.
 */
export type SparkColor = "gold" | "red";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  size: number;
  rgb: string;
}

const GRAVITY = 720;
const DRAG = 0.985;
// One canvas pixel per CSS pixel even on a retina screen: a glowing dot loses nothing, the frame costs a quarter.
const MAX_DPR = 1;
const PALETTES: Record<SparkColor, readonly string[]> = {
  gold: ["255,220,140", "214,178,90", "255,246,214"],
  red: ["255,120,120", "224,92,98", "255,205,180"],
};

export class Sparkles {
  private readonly ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private frame: number | null = null;
  private last = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
  }

  /** Match the canvas to its CSS box; call after the overlay is shown and on resize. */
  fit(): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const { clientWidth, clientHeight } = this.canvas;
    this.canvas.width = Math.round(clientWidth * dpr);
    this.canvas.height = Math.round(clientHeight * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  burst(x: number, y: number, count: number, color: SparkColor, speed = 1): void {
    const palette = PALETTES[color];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (90 + Math.random() * 560) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 110 * speed,
        age: 0,
        ttl: 0.55 + Math.random() * 0.7,
        size: 1.2 + Math.random() * 2.4,
        rgb: palette[Math.floor(Math.random() * palette.length)] ?? palette[0] ?? "255,255,255",
      });
    }
    if (this.frame === null) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  clear(): void {
    this.particles = [];
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.ctx?.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
  }

  private readonly tick = (now: number): void => {
    const ctx = this.ctx;
    if (ctx === null) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.globalCompositeOperation = "lighter";
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.ttl) continue;
      p.vy += GRAVITY * dt;
      p.vx *= DRAG;
      p.vy *= DRAG;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const life = 1 - p.age / p.ttl;
      const radius = p.size * (0.4 + life * 0.6);
      ctx.fillStyle = `rgba(${p.rgb},${String(life * 0.28)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${p.rgb},${String(life)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      alive.push(p);
    }
    ctx.globalCompositeOperation = "source-over";
    this.particles = alive;
    this.frame = alive.length > 0 ? requestAnimationFrame(this.tick) : null;
  };
}
