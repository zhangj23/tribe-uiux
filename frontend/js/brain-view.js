/**
 * 3D brain surface visualization using Canvas 2D.
 * Renders a solid brain mesh with activation heatmap, region labels,
 * hover tooltips, and metric filtering.
 */
const BrainView = (() => {
  let canvas, ctx;
  let activationData = null;
  let currentTimestep = 0;

  // 3D mesh data
  let vertices3D = [];   // {x,y,z} in model space
  let faces = [];         // [i,j,k] triangle indices
  let vertexNormals = []; // per-vertex normals for lighting
  let projected = [];     // cached 2D projections

  // Camera / rotation
  let rotY = -0.3;       // current Y rotation (drag to orbit)
  let rotX = 0.15;       // slight tilt
  let dragging = false;
  let lastMouse = { x: 0, y: 0 };

  // Hover
  let hoveredVertex = -1;
  let tooltipEl = null;
  let rafHover = false;

  // Metric filter: null = all, or metric key string
  let activeMetric = null;

  // Min/max for current frame (exposed for legend)
  let frameMin = 0;
  let frameMax = 1;

  // Region labels in normalized 3D coords
  const BRAIN_REGION_LABELS = [
    { name: 'Visual Cortex', shortName: 'VIS', theta: Math.PI * 0.8, phi: 0 },
    { name: 'Motor Cortex', shortName: 'MOT', theta: Math.PI * 0.25, phi: 0 },
    { name: 'Prefrontal', shortName: 'PFC', theta: Math.PI * 0.15, phi: Math.PI * 0.3 },
    { name: 'Broca\'s Area', shortName: 'BRO', theta: Math.PI * 0.45, phi: -Math.PI * 0.45 },
    { name: 'Wernicke\'s', shortName: 'WER', theta: Math.PI * 0.65, phi: -Math.PI * 0.35 },
    { name: 'Fusiform', shortName: 'FUS', theta: Math.PI * 0.7, phi: Math.PI * 0.15 },
  ];

  // Metric-to-vertex-range mapping (matches backend mock chunking)
  const METRIC_REGIONS = {
    visual_processing:  { start: 0, end: 170 },
    object_recognition: { start: 170, end: 341 },
    reading_language:   { start: 341, end: 512 },
    attention_salience: { start: 512, end: 682 },
    cognitive_load:     { start: 682, end: 853 },
    emotional_response: { start: 853, end: 1024 },
  };

  function init() {
    canvas = document.getElementById('brainCanvas');
    ctx = canvas.getContext('2d');
    tooltipEl = document.getElementById('brainTooltip');

<<<<<<< Updated upstream
    // Generate vertex positions in a brain-shaped layout
    vertexPositions = generateBrainLayout(canvas.width, canvas.height);
=======
    generateBrainMesh();
    setupInteraction();
    initialized = true;
>>>>>>> Stashed changes
  }

  /* ======== MESH GENERATION ======== */

  function generateBrainMesh() {
    const rng = mulberry32(12345);
    // UV-sphere base, then deform into brain shape
    const latSteps = 32;
    const lonSteps = 48;
    vertices3D = [];
    faces = [];

    // Generate vertices on a unit sphere
    for (let lat = 0; lat <= latSteps; lat++) {
      const theta = (lat / latSteps) * Math.PI;
      for (let lon = 0; lon <= lonSteps; lon++) {
        const phi = (lon / lonSteps) * Math.PI * 2 - Math.PI;

        let x = Math.sin(theta) * Math.cos(phi);
        let y = Math.cos(theta);
        let z = Math.sin(theta) * Math.sin(phi);

        // Brain deformations
        // 1. Elongate front-to-back (z-axis)
        z *= 1.15;
        // 2. Flatten top/bottom slightly
        y *= 0.88;
        // 3. Widen laterally
        x *= 1.05;

        // 4. Interhemispheric fissure (indent along midline top)
        const midlineDist = Math.abs(x);
        if (midlineDist < 0.12 && y > 0.1) {
          const fissureDepth = (1 - midlineDist / 0.12) * 0.15 * Math.max(0, y);
          y -= fissureDepth;
        }

        // 5. Frontal lobe bulge
        if (z > 0.5 && y > -0.2) {
          const bulge = Math.max(0, (z - 0.5)) * 0.15;
          x *= (1 + bulge * 0.3);
          z *= (1 + bulge * 0.1);
        }

        // 6. Temporal lobe bulge (sides, lower)
        if (Math.abs(x) > 0.5 && y < 0.0) {
          const tbulge = (Math.abs(x) - 0.5) * 0.2 * Math.max(0, -y);
          x += Math.sign(x) * tbulge;
        }

        // 7. Occipital bump (back)
        if (z < -0.7) {
          const obulge = (-z - 0.7) * 0.15;
          z -= obulge;
        }

        // 8. Subtle surface noise for organic feel
        const noise = (rng() - 0.5) * 0.02;
        const r = Math.sqrt(x * x + y * y + z * z);
        x += (x / r) * noise;
        y += (y / r) * noise;
        z += (z / r) * noise;

        // 9. Add sulci/gyri — wavy surface perturbations
        const sulcus = Math.sin(theta * 8 + phi * 3) * 0.015 +
                       Math.sin(theta * 5 - phi * 7) * 0.012 +
                       Math.sin(theta * 12 + phi * 11) * 0.008;
        const rr = Math.sqrt(x * x + y * y + z * z);
        x += (x / rr) * sulcus;
        y += (y / rr) * sulcus;
        z += (z / rr) * sulcus;

        vertices3D.push({ x, y, z, idx: vertices3D.length });
      }
    }

    // Generate faces (triangles)
    for (let lat = 0; lat < latSteps; lat++) {
      for (let lon = 0; lon < lonSteps; lon++) {
        const a = lat * (lonSteps + 1) + lon;
        const b = a + lonSteps + 1;

        faces.push([a, b, a + 1]);
        faces.push([b, b + 1, a + 1]);
      }
    }

    computeNormals();
  }

  function computeNormals() {
    vertexNormals = vertices3D.map(() => ({ x: 0, y: 0, z: 0 }));

    for (const [a, b, c] of faces) {
      const va = vertices3D[a], vb = vertices3D[b], vc = vertices3D[c];
      // Edge vectors
      const ux = vb.x - va.x, uy = vb.y - va.y, uz = vb.z - va.z;
      const vx = vc.x - va.x, vy = vc.y - va.y, vz = vc.z - va.z;
      // Cross product
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;

      vertexNormals[a].x += nx; vertexNormals[a].y += ny; vertexNormals[a].z += nz;
      vertexNormals[b].x += nx; vertexNormals[b].y += ny; vertexNormals[b].z += nz;
      vertexNormals[c].x += nx; vertexNormals[c].y += ny; vertexNormals[c].z += nz;
    }

    // Normalize
    for (const n of vertexNormals) {
      const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1;
      n.x /= len; n.y /= len; n.z /= len;
    }
  }

  /* ======== INTERACTION ======== */

  function setupInteraction() {
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      lastMouse = { x: e.offsetX, y: e.offsetY };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (dragging) {
        const dx = e.offsetX - lastMouse.x;
        const dy = e.offsetY - lastMouse.y;
        rotY += dx * 0.008;
        rotX += dy * 0.008;
        rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, rotX));
        lastMouse = { x: e.offsetX, y: e.offsetY };
        render();
      }

      // Hover tooltip (throttled via rAF)
      if (!rafHover) {
        rafHover = true;
        requestAnimationFrame(() => {
          handleHover(e.offsetX, e.offsetY);
          rafHover = false;
        });
      }
    });

    canvas.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('mouseleave', () => {
      dragging = false;
      hideTooltip();
    });
  }

  function handleHover(mx, my) {
    if (!activationData || !projected.length) {
      hideTooltip();
      return;
    }

    // Find nearest visible vertex (sample every Nth for performance)
    let bestDist = 20; // max pixel distance
    let bestIdx = -1;
    const step = 3;
    for (let i = 0; i < projected.length; i += step) {
      const p = projected[i];
      if (!p) continue;
      const dx = p.x - mx, dy = p.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestIdx !== hoveredVertex) {
      hoveredVertex = bestIdx;
      showTooltip(mx, my, bestIdx);
    } else if (bestIdx < 0) {
      hoveredVertex = -1;
      hideTooltip();
    }
  }

  function showTooltip(mx, my, vertexIdx) {
    if (!tooltipEl || !activationData) return;
    const frame = activationData[Math.min(currentTimestep, activationData.length - 1)];
    // Map mesh vertex to activation data vertex (downsample)
    const dataIdx = Math.floor(vertexIdx / vertices3D.length * Math.min(frame.length, 1024));
    if (dataIdx >= frame.length) { hideTooltip(); return; }

    const val = frame[dataIdx];
    const region = getRegionForDataIndex(dataIdx);

    tooltipEl.innerHTML =
      `<strong>${region}</strong><br>` +
      `Activation: ${val.toFixed(4)}`;
    tooltipEl.style.display = 'block';

    // Position near cursor but inside canvas bounds
    const rect = canvas.getBoundingClientRect();
    tooltipEl.style.left = (rect.left + mx + 14) + 'px';
    tooltipEl.style.top = (rect.top + my - 10 + window.scrollY) + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
    hoveredVertex = -1;
  }

  function getRegionForDataIndex(idx) {
    for (const [key, range] of Object.entries(METRIC_REGIONS)) {
      if (idx >= range.start && idx < range.end) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    }
    return 'Unknown';
  }

  /* ======== 3D PROJECTION ======== */

  function projectVertices() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.36;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    projected = [];
    for (const v of vertices3D) {
      // Rotate around Y axis
      let x = v.x * cosY - v.z * sinY;
      let z = v.x * sinY + v.z * cosY;
      let y = v.y;

      // Rotate around X axis
      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;

      // Simple perspective
      const perspective = 3.5 / (3.5 + z2);
      projected.push({
        x: cx + x * scale * perspective,
        y: cy - y2 * scale * perspective,
        z: z2,
        perspective,
      });
    }
  }

  function projectNormal(n) {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    let x = n.x * cosY - n.z * sinY;
    let z = n.x * sinY + n.z * cosY;
    let y = n.y;

    const y2 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;
    return { x, y: y2, z: z2 };
  }

  /* ======== RENDERING ======== */

  function setData(brainActivations) {
    activationData = brainActivations;
    currentTimestep = 0;
    render();
  }

  function setTimestep(t) {
    currentTimestep = t;
    render();
  }

  function setMetricFilter(metric) {
    activeMetric = metric;
    render();
  }

  function render() {
    if (!ctx || !vertices3D.length) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, w, h);

    projectVertices();

    if (!activationData || activationData.length === 0) {
      renderSolidBrain(null);
      renderLabels();
      return;
    }

    const frame = activationData[Math.min(currentTimestep, activationData.length - 1)];
    renderSolidBrain(frame);
    renderLabels();
  }

  function renderSolidBrain(frame) {
    // Map activation data to mesh vertices
    const numData = frame ? Math.min(frame.length, 1024) : 0;
    let vertexActivations = null;

    if (frame && numData > 0) {
      // Find min/max
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < numData; i++) {
        if (frame[i] < min) min = frame[i];
        if (frame[i] > max) max = frame[i];
      }
      frameMin = min;
      frameMax = max;
      const range = max - min || 1;

      // Map data vertices to mesh vertices
      vertexActivations = new Float32Array(vertices3D.length);
      for (let i = 0; i < vertices3D.length; i++) {
        const dataIdx = Math.floor(i / vertices3D.length * numData);
        vertexActivations[i] = (frame[dataIdx] - min) / range;
      }

      // Apply metric filter dimming
      if (activeMetric && METRIC_REGIONS[activeMetric]) {
        const region = METRIC_REGIONS[activeMetric];
        for (let i = 0; i < vertices3D.length; i++) {
          const dataIdx = Math.floor(i / vertices3D.length * numData);
          if (dataIdx < region.start || dataIdx >= region.end) {
            vertexActivations[i] *= 0.15; // dim non-selected regions
          }
        }
      }
    }

    // Update legend
    updateLegendValues();

    // Light direction (from upper-right-front)
    const lightDir = normalize({ x: 0.4, y: 0.6, z: 0.8 });

    // Build face list with depth for sorting
    const faceList = [];
    for (const [a, b, c] of faces) {
      const pa = projected[a], pb = projected[b], pc = projected[c];

      // Average depth for sorting
      const avgZ = (pa.z + pb.z + pc.z) / 3;

      // Back-face culling: compute screen-space winding
      const cross = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
      if (cross > 0) continue; // back-facing

      faceList.push({ a, b, c, avgZ });
    }

    // Sort back-to-front (painter's algorithm)
    faceList.sort((a, b) => b.avgZ - a.avgZ);

    // Render faces
    for (const face of faceList) {
      const pa = projected[face.a];
      const pb = projected[face.b];
      const pc = projected[face.c];

      // Average normal for lighting
      const na = projectNormal(vertexNormals[face.a]);
      const nb = projectNormal(vertexNormals[face.b]);
      const nc = projectNormal(vertexNormals[face.c]);
      const avgNormal = normalize({
        x: (na.x + nb.x + nc.x) / 3,
        y: (na.y + nb.y + nc.y) / 3,
        z: (na.z + nb.z + nc.z) / 3,
      });

      // Lambert diffuse + ambient
      const diffuse = Math.max(0, dot(avgNormal, lightDir));
      const ambient = 0.35;
      const lighting = Math.min(1, ambient + diffuse * 0.65);

      // Determine face color
      let r, g, b;
      if (vertexActivations) {
        // Average activation of face vertices
        const avgAct = (vertexActivations[face.a] + vertexActivations[face.b] + vertexActivations[face.c]) / 3;
        const col = activationColorRGB(avgAct);
        r = col[0]; g = col[1]; b = col[2];

        // Blend with base brain color — more activation = more color
        const intensity = Math.pow(avgAct, 0.6); // boost visibility
        const baseR = 180, baseG = 175, baseB = 172;
        r = Math.round(baseR * (1 - intensity) + r * intensity);
        g = Math.round(baseG * (1 - intensity) + g * intensity);
        b = Math.round(baseB * (1 - intensity) + b * intensity);
      } else {
        // No data — neutral gray brain
        r = 180; g = 175; b = 172;
      }

      // Apply lighting
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
  }

  function renderLabels() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.36;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    ctx.font = '9px "DM Mono", monospace';

    for (const label of BRAIN_REGION_LABELS) {
      // Convert spherical to cartesian (on brain surface)
      let lx = Math.sin(label.theta) * Math.cos(label.phi) * 1.1;
      let ly = Math.cos(label.theta) * 0.88 * 1.1;
      let lz = Math.sin(label.theta) * Math.sin(label.phi) * 1.15 * 1.1;

      // Rotate
      let x = lx * cosY - lz * sinY;
      let z = lx * sinY + lz * cosY;
      let y = ly;
      const y2 = y * cosX - z * sinX;
      const z2 = y * sinX + z * cosX;

      // Only show labels on visible side
      if (z2 < -0.2) continue;

      const perspective = 3.5 / (3.5 + z2);
      const sx = cx + x * scale * perspective;
      const sy = cy - y2 * scale * perspective;

      // Leader line — extend outward from brain center
      const dx = sx - cx;
      const dy = sy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const extendLen = 22;
      const ex = sx + (dx / dist) * extendLen;
      const ey = sy + (dy / dist) * extendLen;

      const alpha = 0.4 + Math.max(0, z2) * 0.4;

      // Leader line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = `rgba(139, 144, 160, ${alpha * 0.5})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Dot at anchor
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 144, 160, ${alpha * 0.6})`;
      ctx.fill();

      // Label text
      ctx.fillStyle = `rgba(200, 205, 215, ${alpha})`;
      ctx.textAlign = dx > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.shortName, ex + (dx > 0 ? 4 : -4), ey);
    }
  }

  function updateLegendValues() {
    const minEl = document.getElementById('legendMinVal');
    const maxEl = document.getElementById('legendMaxVal');
    if (minEl) minEl.textContent = frameMin.toFixed(3);
    if (maxEl) maxEl.textContent = frameMax.toFixed(3);
  }

  /* ======== COLOR MAPS ======== */

  function activationColorRGB(val) {
    // Cool-to-warm: deep blue → cyan → yellow → red
    if (val < 0.25) {
      return lerpColorArr([10, 22, 60], [0, 100, 180], val / 0.25);
    } else if (val < 0.5) {
      return lerpColorArr([0, 100, 180], [0, 200, 220], (val - 0.25) / 0.25);
    } else if (val < 0.75) {
      return lerpColorArr([0, 200, 220], [255, 200, 50], (val - 0.5) / 0.25);
    } else {
      return lerpColorArr([255, 200, 50], [255, 60, 80], (val - 0.75) / 0.25);
    }
  }

  function lerpColorArr(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  /* ======== MATH HELPERS ======== */

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /* ======== PROCESSING ANIMATION ======== */
  let animFrame = null;

  function startProcessingAnimation() {
    const pCanvas = document.getElementById('processingCanvas');
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');
    const w = pCanvas.width;
    const h = pCanvas.height;
    let t = 0;

    function animate() {
      t += 0.02;
      pCtx.fillStyle = '#08090c';
      pCtx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      const pulseR = 60 + Math.sin(t) * 10;
      pCtx.beginPath();
      pCtx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      pCtx.strokeStyle = `rgba(57, 255, 133, ${0.15 + Math.sin(t) * 0.1})`;
      pCtx.lineWidth = 1.5;
      pCtx.stroke();

      for (let i = 0; i < 3; i++) {
        const r = 25 + i * 15 + Math.sin(t + i * 0.5) * 3;
        pCtx.beginPath();
        pCtx.arc(cx, cy, r, 0, Math.PI * 2);
        pCtx.strokeStyle = `rgba(0, 212, 255, ${0.12 - i * 0.03})`;
        pCtx.lineWidth = 1;
        pCtx.stroke();
      }

      const numDots = 40;
      for (let i = 0; i < numDots; i++) {
        const angle = (i / numDots) * Math.PI * 2 + t * 0.5;
        const r = 20 + Math.sin(angle * 3 + t) * 25;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const brightness = 0.3 + Math.sin(t * 2 + i) * 0.2;

        pCtx.beginPath();
        pCtx.arc(x, y, 2, 0, Math.PI * 2);
        pCtx.fillStyle = `rgba(57, 255, 133, ${brightness})`;
        pCtx.fill();
      }

      pCtx.beginPath();
      pCtx.arc(cx, cy, 4, 0, Math.PI * 2);
      pCtx.fillStyle = '#39ff85';
      pCtx.fill();

      animFrame = requestAnimationFrame(animate);
    }

    animate();
  }

  function stopProcessingAnimation() {
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }

  return {
    init,
    setData,
    setTimestep,
    setMetricFilter,
    render,
    startProcessingAnimation,
    stopProcessingAnimation,
  };
})();
