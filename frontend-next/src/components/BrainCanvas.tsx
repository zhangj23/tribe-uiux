'use client';

import { useRef, useEffect, useState } from 'react';

interface BrainPoint { x: number; y: number; hemisphere: string; }

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateBrainLayout(w: number, h: number): BrainPoint[] {
  const positions: BrainPoint[] = [];
  const cx = w / 2;
  const cy = h / 2 - 10;
  const rng = mulberry32(12345);

  for (let i = 0; i < 1024; i++) {
    let x = 0, y = 0, accepted = false;
    while (!accepted) {
      x = (rng() - 0.5) * 2;
      y = (rng() - 0.5) * 2;
      if (x > -0.03 && x < 0.03) continue;
      const ex = x * 1.0;
      const ey = y * 1.2;
      if (ex * ex + ey * ey > 0.85) continue;
      const frontalBonus = y < -0.2 ? 0.1 : 0;
      const occipitalBonus = y > 0.3 ? 0.05 : 0;
      const r = Math.sqrt(ex * ex + ey * ey);
      if (r < 0.85 + frontalBonus + occipitalBonus) accepted = true;
    }
    positions.push({
      x: cx + x * (w * 0.42),
      y: cy + y * (h * 0.42),
      hemisphere: x < 0 ? 'left' : 'right',
    });
  }
  return positions;
}

function lerpColor(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function activationColor(val: number): string {
  if (val < 0.2) return lerpColor([10, 22, 40], [0, 68, 102], val / 0.2);
  if (val < 0.4) return lerpColor([0, 68, 102], [0, 170, 204], (val - 0.2) / 0.2);
  if (val < 0.6) return lerpColor([0, 170, 204], [57, 255, 133], (val - 0.4) / 0.2);
  if (val < 0.8) return lerpColor([57, 255, 133], [255, 179, 71], (val - 0.6) / 0.2);
  return lerpColor([255, 179, 71], [255, 77, 106], (val - 0.8) / 0.2);
}

interface Props {
  activations: number[][];
  timestep: number;
}

export default function BrainCanvas({ activations, timestep }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<BrainPoint[] | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 280, h: 260 });

  // Observe parent width and keep the canvas at a consistent aspect ratio.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(220, Math.min(el.clientWidth, 520));
      const h = Math.round(w * (260 / 280));
      setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Regenerate layout whenever the canvas dimensions change.
  useEffect(() => {
    positionsRef.current = generateBrainLayout(size.w, size.h);
  }, [size.w, size.h]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const positions = positionsRef.current;
    if (!canvas || !ctx || !positions) return;

    // Scale the bitmap for crisp rendering on HiDPI displays.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = size.w;
    const h = size.h;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, w, h);

    // Brain outline
    ctx.beginPath();
    ctx.ellipse(w / 2 - w * 0.01, h / 2 - 10, w * 0.42, h * 0.40, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 47, 62, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Midline
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.08);
    ctx.lineTo(w / 2, h * 0.85);
    ctx.strokeStyle = 'rgba(42, 47, 62, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!activations || activations.length === 0) {
      // Idle state
      for (const pos of positions) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(42, 47, 62, 0.4)';
        ctx.fill();
      }
      return;
    }

    const frame = activations[Math.min(timestep, activations.length - 1)];
    const numToRender = Math.min(frame.length, positions.length);

    let min = Infinity, max = -Infinity;
    for (let i = 0; i < numToRender; i++) {
      if (frame[i] < min) min = frame[i];
      if (frame[i] > max) max = frame[i];
    }
    const range = max - min || 1;

    for (let i = 0; i < numToRender; i++) {
      const pos = positions[i];
      const val = (frame[i] - min) / range;
      const color = activationColor(val);
      const size = 2 + val * 3;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (val > 0.7) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 4, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
        ctx.fill();
      }
    }

    ctx.font = '10px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(139, 144, 160, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('LEFT', w * 0.25, h - 12);
    ctx.fillText('RIGHT', w * 0.75, h - 12);
    ctx.fillText('ANTERIOR', w / 2, 18);
  }, [activations, timestep, size.w, size.h]);

  return (
    <div ref={wrapRef} className="brain-canvas-wrapper">
      <canvas
        ref={canvasRef}
        id="brainCanvas"
        style={{ width: size.w, height: size.h, display: 'block', margin: '0 auto' }}
      />
    </div>
  );
}
