'use client';

import { useEffect, useRef } from 'react';

export default function ProcessingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animId: number;

    const animate = () => {
      t += 0.02;
      ctx.fillStyle = '#08090c';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Outer pulse ring
      const pulseR = 60 + Math.sin(t) * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(57, 255, 133, ${0.15 + Math.sin(t) * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner rings
      for (let i = 0; i < 3; i++) {
        const r = 25 + i * 15 + Math.sin(t + i * 0.5) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.12 - i * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Scanning dots
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

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff85';
      ctx.fill();

      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} width={200} height={200} />;
}
