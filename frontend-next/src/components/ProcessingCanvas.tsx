'use client';

import { useEffect, useRef } from 'react';

type Stage = 'created' | 'converting' | 'predicting' | 'mapping' | 'interpreting' | 'completed' | 'failed' | '';

interface Props {
  stage?: Stage | string;
}

/**
 * Stage-aware processing animation. Each pipeline phase gets a different
 * visual metaphor so the user can tell where in the run we are at a glance:
 *
 *   converting   → film-strip frames sliding past a window
 *   predicting   → particles streaming inward toward a central node
 *   mapping      → expanding rings + radial spokes (brain regions lighting)
 *   interpreting → typewriter cursor pulsing inside text columns
 *   default      → the original ambient ring + scanning dots
 */
export default function ProcessingCanvas({ stage = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<string>(stage);
  stageRef.current = stage;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = 200 * dpr;
    canvas.height = 200 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = 200;
    const h = 200;
    const cx = w / 2;
    const cy = h / 2;
    let t = 0;
    let animId: number;

    // Persistent particle field for the predicting stage.
    const particles = Array.from({ length: 26 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 80 + Math.random() * 30,
      speed: 0.4 + Math.random() * 0.6,
      offset: Math.random() * Math.PI * 2,
    }));

    const drawAmbient = () => {
      // Outer pulse ring
      const pulseR = 60 + Math.sin(t) * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(57, 255, 133, ${0.15 + Math.sin(t) * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const r = 25 + i * 15 + Math.sin(t + i * 0.5) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.12 - i * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2 + t * 0.5;
        const r = 20 + Math.sin(angle * 3 + t) * 25;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const brightness = 0.3 + Math.sin(t * 2 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(57, 255, 133, ${brightness})`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff85';
      ctx.fill();
    };

    const drawConverting = () => {
      // Film-strip frames sliding past a window in the middle
      const frameW = 28;
      const frameH = 38;
      const gap = 8;
      const total = frameW + gap;
      const offset = (t * 35) % total;
      ctx.save();
      ctx.translate(cx - 2 * total + offset, cy - frameH / 2);
      for (let i = 0; i < 5; i++) {
        const x = i * total;
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 0, frameW, frameH);
        // Sprocket holes
        ctx.fillStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.fillRect(x + 4, 4, 3, 3);
        ctx.fillRect(x + frameW - 7, 4, 3, 3);
        ctx.fillRect(x + 4, frameH - 7, 3, 3);
        ctx.fillRect(x + frameW - 7, frameH - 7, 3, 3);
        // Frame "content" — pulsing rectangle
        const fillAlpha = 0.15 + Math.sin(t + i) * 0.1;
        ctx.fillStyle = `rgba(57, 255, 133, ${fillAlpha})`;
        ctx.fillRect(x + 8, 11, frameW - 16, frameH - 22);
      }
      ctx.restore();

      // Window frame to make the strip look like it's sliding through
      ctx.strokeStyle = 'rgba(57, 255, 133, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 50, cy - 28, 100, 56);
    };

    const drawPredicting = () => {
      // Particles streaming inward to a central node
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(57, 255, 133, ${0.6 + Math.sin(t * 3) * 0.3})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(57, 255, 133, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      for (const p of particles) {
        const r = 16 + ((p.radius - 16 + t * p.speed * 30) % 80);
        const fade = 1 - (r - 16) / 80;
        const x = cx + Math.cos(p.angle + p.offset) * r;
        const y = cy + Math.sin(p.angle + p.offset) * r;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${fade * 0.85})`;
        ctx.fill();
        // Trailing line back toward the center
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          cx + Math.cos(p.angle + p.offset) * (r + 12),
          cy + Math.sin(p.angle + p.offset) * (r + 12)
        );
        ctx.strokeStyle = `rgba(0, 212, 255, ${fade * 0.25})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const drawMapping = () => {
      // Expanding rings + radial spokes (brain regions lighting up)
      for (let i = 0; i < 3; i++) {
        const wave = ((t * 0.6 + i * 0.4) % 1.5);
        const r = 10 + wave * 70;
        const alpha = Math.max(0, 1 - wave / 1.5) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(57, 255, 133, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Spokes
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const len = 25 + Math.sin(t * 2 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(t * 2 + i) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        // End-of-spoke node
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(57, 255, 133, ${0.5 + Math.sin(t * 2 + i) * 0.4})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff85';
      ctx.fill();
    };

    const drawInterpreting = () => {
      // Three text columns with a typewriter caret pulsing
      const colW = 36;
      const colH = 80;
      const gap = 14;
      const startX = cx - (colW * 3 + gap * 2) / 2;
      const startY = cy - colH / 2;
      for (let c = 0; c < 3; c++) {
        const x = startX + c * (colW + gap);
        ctx.strokeStyle = 'rgba(57, 255, 133, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, startY, colW, colH);
        // Stagger which column has the active caret
        const lines = 8;
        const activeLine = Math.floor((t * 1.4 + c * 2) % lines);
        for (let l = 0; l < lines; l++) {
          const ly = startY + 8 + l * 9;
          if (l < activeLine) {
            // "Written" line
            ctx.fillStyle = 'rgba(0, 212, 255, 0.55)';
            ctx.fillRect(x + 5, ly, colW - 10, 2);
          } else if (l === activeLine) {
            // Animated caret
            const caretAlpha = 0.5 + Math.sin(t * 6) * 0.5;
            ctx.fillStyle = `rgba(57, 255, 133, ${caretAlpha})`;
            const widthInProgress = ((t * 24) % (colW - 12));
            ctx.fillRect(x + 5, ly, widthInProgress, 2);
          }
        }
      }
    };

    const animate = () => {
      t += 0.025;
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, w, h);

      switch (stageRef.current) {
        case 'converting':   drawConverting();   break;
        case 'predicting':   drawPredicting();   break;
        case 'mapping':      drawMapping();      break;
        case 'interpreting': drawInterpreting(); break;
        default:             drawAmbient();
      }

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 200, height: 200 }} />;
}
