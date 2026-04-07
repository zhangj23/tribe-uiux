'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

/* ======== Types ======== */
interface Vertex3D { x: number; y: number; z: number; }
interface Projected { x: number; y: number; z: number; }

/* ======== Constants ======== */
const METRIC_REGIONS: Record<string, { start: number; end: number }> = {
  visual_processing:  { start: 0, end: 170 },
  object_recognition: { start: 170, end: 341 },
  reading_language:   { start: 341, end: 512 },
  attention_salience: { start: 512, end: 682 },
  cognitive_load:     { start: 682, end: 853 },
  emotional_response: { start: 853, end: 1024 },
};

const BRAIN_REGION_LABELS = [
  { shortName: 'VIS', theta: Math.PI * 0.8, phi: 0 },
  { shortName: 'MOT', theta: Math.PI * 0.25, phi: 0 },
  { shortName: 'PFC', theta: Math.PI * 0.15, phi: Math.PI * 0.3 },
  { shortName: 'BRO', theta: Math.PI * 0.45, phi: -Math.PI * 0.45 },
  { shortName: 'WER', theta: Math.PI * 0.65, phi: -Math.PI * 0.35 },
  { shortName: 'FUS', theta: Math.PI * 0.7, phi: Math.PI * 0.15 },
];

/* ======== Math helpers ======== */
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(v: Vertex3D): Vertex3D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot(a: Vertex3D, b: Vertex3D) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function lerpColorArr(a: number[], b: number[], t: number): number[] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function activationColorRGB(val: number): number[] {
  if (val < 0.25) return lerpColorArr([10, 22, 60], [0, 100, 180], val / 0.25);
  if (val < 0.5) return lerpColorArr([0, 100, 180], [0, 200, 220], (val - 0.25) / 0.25);
  if (val < 0.75) return lerpColorArr([0, 200, 220], [255, 200, 50], (val - 0.5) / 0.25);
  return lerpColorArr([255, 200, 50], [255, 60, 80], (val - 0.75) / 0.25);
}

function getRegionForDataIndex(idx: number): string {
  for (const [key, range] of Object.entries(METRIC_REGIONS)) {
    if (idx >= range.start && idx < range.end) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return 'Unknown';
}

/* ======== Mesh generation ======== */
function generateBrainMesh() {
  const rng = mulberry32(12345);
  const latSteps = 32;
  const lonSteps = 48;
  const vertices: Vertex3D[] = [];
  const faces: [number, number, number][] = [];

  for (let lat = 0; lat <= latSteps; lat++) {
    const theta = (lat / latSteps) * Math.PI;
    for (let lon = 0; lon <= lonSteps; lon++) {
      const phi = (lon / lonSteps) * Math.PI * 2 - Math.PI;

      let x = Math.sin(theta) * Math.cos(phi);
      let y = Math.cos(theta);
      let z = Math.sin(theta) * Math.sin(phi);

      z *= 1.15;
      y *= 0.88;
      x *= 1.05;

      // Interhemispheric fissure
      const midlineDist = Math.abs(x);
      if (midlineDist < 0.12 && y > 0.1) {
        y -= (1 - midlineDist / 0.12) * 0.15 * Math.max(0, y);
      }

      // Frontal lobe bulge
      if (z > 0.5 && y > -0.2) {
        const bulge = Math.max(0, z - 0.5) * 0.15;
        x *= 1 + bulge * 0.3;
        z *= 1 + bulge * 0.1;
      }

      // Temporal lobe bulge
      if (Math.abs(x) > 0.5 && y < 0.0) {
        x += Math.sign(x) * (Math.abs(x) - 0.5) * 0.2 * Math.max(0, -y);
      }

      // Occipital bump
      if (z < -0.7) {
        z -= (-z - 0.7) * 0.15;
      }

      // Surface noise
      const noise = (rng() - 0.5) * 0.02;
      let r = Math.sqrt(x * x + y * y + z * z);
      x += (x / r) * noise;
      y += (y / r) * noise;
      z += (z / r) * noise;

      // Sulci/gyri
      const sulcus = Math.sin(theta * 8 + phi * 3) * 0.015 +
                     Math.sin(theta * 5 - phi * 7) * 0.012 +
                     Math.sin(theta * 12 + phi * 11) * 0.008;
      r = Math.sqrt(x * x + y * y + z * z);
      x += (x / r) * sulcus;
      y += (y / r) * sulcus;
      z += (z / r) * sulcus;

      vertices.push({ x, y, z });
    }
  }

  for (let lat = 0; lat < latSteps; lat++) {
    for (let lon = 0; lon < lonSteps; lon++) {
      const a = lat * (lonSteps + 1) + lon;
      const b = a + lonSteps + 1;
      faces.push([a, b, a + 1]);
      faces.push([b, b + 1, a + 1]);
    }
  }

  // Compute normals
  const normals: Vertex3D[] = vertices.map(() => ({ x: 0, y: 0, z: 0 }));
  for (const [a, b, c] of faces) {
    const va = vertices[a], vb = vertices[b], vc = vertices[c];
    const ux = vb.x - va.x, uy = vb.y - va.y, uz = vb.z - va.z;
    const vx = vc.x - va.x, vy = vc.y - va.y, vz = vc.z - va.z;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const idx of [a, b, c]) {
      normals[idx].x += nx;
      normals[idx].y += ny;
      normals[idx].z += nz;
    }
  }
  for (const n of normals) {
    const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1;
    n.x /= len; n.y /= len; n.z /= len;
  }

  return { vertices, faces, normals };
}

/* ======== Props ======== */
interface Props {
  activations: number[][];
  timestep: number;
  activeMetric?: string | null;
  onLegendUpdate?: (min: number, max: number) => void;
}

export default function BrainCanvas({ activations, timestep, activeMetric, onLegendUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meshRef = useRef<ReturnType<typeof generateBrainMesh> | null>(null);
  const rotRef = useRef({ rotY: -0.3, rotX: 0.15 });
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const projectedRef = useRef<Projected[]>([]);

  // Generate mesh once
  if (!meshRef.current) {
    meshRef.current = generateBrainMesh();
  }

  const renderBrain = useCallback(() => {
    const canvas = canvasRef.current;
    const mesh = meshRef.current;
    if (!canvas || !mesh) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const { vertices, faces, normals } = mesh;
    const { rotY, rotX } = rotRef.current;

    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, w, h);

    // Project vertices
    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) * 0.36;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    const projected: Projected[] = [];
    for (const v of vertices) {
      let x = v.x * cosY - v.z * sinY;
      let z = v.x * sinY + v.z * cosY;
      const y2 = v.y * cosX - z * sinX;
      const z2 = v.y * sinX + z * cosX;
      const p = 3.5 / (3.5 + z2);
      projected.push({ x: cx + x * scale * p, y: cy - y2 * scale * p, z: z2 });
    }
    projectedRef.current = projected;

    // Activation mapping
    const frame = activations?.length
      ? activations[Math.min(timestep, activations.length - 1)]
      : null;
    const numData = frame ? Math.min(frame.length, 1024) : 0;
    let vertexAct: Float32Array | null = null;

    if (frame && numData > 0) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < numData; i++) {
        if (frame[i] < min) min = frame[i];
        if (frame[i] > max) max = frame[i];
      }
      const range = max - min || 1;
      onLegendUpdate?.(min, max);

      vertexAct = new Float32Array(vertices.length);
      for (let i = 0; i < vertices.length; i++) {
        const dataIdx = Math.floor(i / vertices.length * numData);
        vertexAct[i] = (frame[dataIdx] - min) / range;
      }

      if (activeMetric && METRIC_REGIONS[activeMetric]) {
        const region = METRIC_REGIONS[activeMetric];
        for (let i = 0; i < vertices.length; i++) {
          const dataIdx = Math.floor(i / vertices.length * numData);
          if (dataIdx < region.start || dataIdx >= region.end) {
            vertexAct[i] *= 0.15;
          }
        }
      }
    }

    // Light
    const lightDir = normalize({ x: 0.4, y: 0.6, z: 0.8 });

    function projectNormal(n: Vertex3D): Vertex3D {
      let x = n.x * cosY - n.z * sinY;
      let z = n.x * sinY + n.z * cosY;
      const y2 = n.y * cosX - z * sinX;
      const z2 = n.y * sinX + z * cosX;
      return { x, y: y2, z: z2 };
    }

    // Build & sort faces
    const faceList: { a: number; b: number; c: number; avgZ: number }[] = [];
    for (const [a, b, c] of faces) {
      const pa = projected[a], pb = projected[b], pc = projected[c];
      const cross = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
      if (cross > 0) continue;
      faceList.push({ a, b, c, avgZ: (pa.z + pb.z + pc.z) / 3 });
    }
    faceList.sort((a, b) => b.avgZ - a.avgZ);

    // Render faces
    for (const face of faceList) {
      const pa = projected[face.a], pb = projected[face.b], pc = projected[face.c];

      const na = projectNormal(normals[face.a]);
      const nb = projectNormal(normals[face.b]);
      const nc = projectNormal(normals[face.c]);
      const avgN = normalize({
        x: (na.x + nb.x + nc.x) / 3,
        y: (na.y + nb.y + nc.y) / 3,
        z: (na.z + nb.z + nc.z) / 3,
      });

      const diffuse = Math.max(0, dot(avgN, lightDir));
      const lighting = Math.min(1, 0.35 + diffuse * 0.65);

      let r: number, g: number, b: number;
      if (vertexAct) {
        const avgAct = (vertexAct[face.a] + vertexAct[face.b] + vertexAct[face.c]) / 3;
        const col = activationColorRGB(avgAct);
        const intensity = Math.pow(avgAct, 0.6);
        r = Math.round(180 * (1 - intensity) + col[0] * intensity);
        g = Math.round(175 * (1 - intensity) + col[1] * intensity);
        b = Math.round(172 * (1 - intensity) + col[2] * intensity);
      } else {
        r = 180; g = 175; b = 172;
      }

      r = Math.round(r * lighting);
      g = Math.round(g * lighting);
      b = Math.round(b * lighting);

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.lineTo(pc.x, pc.y);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }

    // Region labels
    ctx.font = '9px "DM Mono", monospace';
    for (const label of BRAIN_REGION_LABELS) {
      let lx = Math.sin(label.theta) * Math.cos(label.phi) * 1.1;
      let ly = Math.cos(label.theta) * 0.88 * 1.1;
      let lz = Math.sin(label.theta) * Math.sin(label.phi) * 1.15 * 1.1;

      let x = lx * cosY - lz * sinY;
      let z = lx * sinY + lz * cosY;
      const y2 = ly * cosX - z * sinX;
      const z2 = ly * sinX + z * cosX;

      if (z2 < -0.2) continue;

      const p = 3.5 / (3.5 + z2);
      const sx = cx + x * scale * p;
      const sy = cy - y2 * scale * p;
      const dx = sx - cx, dy = sy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ex = sx + (dx / dist) * 22;
      const ey = sy + (dy / dist) * 22;
      const alpha = 0.4 + Math.max(0, z2) * 0.4;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = `rgba(139,144,160,${alpha * 0.5})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139,144,160,${alpha * 0.6})`;
      ctx.fill();

      ctx.fillStyle = `rgba(200,205,215,${alpha})`;
      ctx.textAlign = dx > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.shortName, ex + (dx > 0 ? 4 : -4), ey);
    }
  }, [activations, timestep, activeMetric, onLegendUpdate]);

  // Render on data/rotation change
  useEffect(() => {
    renderBrain();
  }, [renderBrain]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      dragRef.current = { dragging: true, lastX: e.offsetX, lastY: e.offsetY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag.dragging) {
        rotRef.current.rotY += (e.offsetX - drag.lastX) * 0.008;
        rotRef.current.rotX += (e.offsetY - drag.lastY) * 0.008;
        rotRef.current.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotRef.current.rotX));
        drag.lastX = e.offsetX;
        drag.lastY = e.offsetY;
        renderBrain();
      }

      // Hover tooltip
      if (!activations?.length || !projectedRef.current.length) {
        setTooltip(null);
        return;
      }
      const frame = activations[Math.min(timestep, activations.length - 1)];
      let bestDist = 20, bestIdx = -1;
      for (let i = 0; i < projectedRef.current.length; i += 3) {
        const p = projectedRef.current[i];
        const dx = p.x - e.offsetX, dy = p.y - e.offsetY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }

      if (bestIdx >= 0) {
        const mesh = meshRef.current!;
        const dataIdx = Math.floor(bestIdx / mesh.vertices.length * Math.min(frame.length, 1024));
        if (dataIdx < frame.length) {
          setTooltip({
            x: e.offsetX + 14,
            y: e.offsetY - 10,
            text: `${getRegionForDataIndex(dataIdx)}\nActivation: ${frame[dataIdx].toFixed(4)}`,
          });
        }
      } else {
        setTooltip(null);
      }
    };

    const onMouseUp = () => { dragRef.current.dragging = false; };
    const onMouseLeave = () => { dragRef.current.dragging = false; setTooltip(null); };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [activations, timestep, renderBrain]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} id="brainCanvas" width={400} height={360} />
      {tooltip && (
        <div
          className="brain-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text.split('\n').map((line, i) => (
            <div key={i}>{i === 0 ? <strong>{line}</strong> : line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
