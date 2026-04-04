/**
 * 2D brain heatmap visualization using Canvas.
 * Renders a top-down brain outline with colored dots for cortical vertices.
 */
const BrainView = (() => {
  let canvas, ctx;
  let activationData = null; // [timestep][vertex]
  let vertexPositions = null; // pre-computed 2D positions
  let currentTimestep = 0;

  function init() {
    canvas = document.getElementById('brainCanvas');
    ctx = canvas.getContext('2d');

    // Generate vertex positions in a brain-shaped layout
    vertexPositions = generateBrainLayout(canvas.width, canvas.height);
  }

  function generateBrainLayout(w, h) {
    // Create a brain-shaped distribution of ~1024 points
    // (matches the downsampled brain_activations from backend — every 20th vertex)
    const positions = [];
    const cx = w / 2;
    const cy = h / 2 - 10;
    const numPoints = 1024;
    const rng = mulberry32(12345);

    for (let i = 0; i < numPoints; i++) {
      // Generate points within an elliptical brain shape
      let x, y, accepted = false;
      while (!accepted) {
        x = (rng() - 0.5) * 2;
        y = (rng() - 0.5) * 2;

        // Brain shape: two hemispheres with a gap in the middle
        const isLeft = x < -0.03;
        const isRight = x > 0.03;
        if (!isLeft && !isRight) continue;

        // Elliptical boundary
        const ex = x * 1.0;
        const ey = y * 1.2;
        if (ex * ex + ey * ey > 0.85) continue;

        // Add some brain-like bulges
        // Frontal lobe (top)
        const frontalBonus = y < -0.2 ? 0.1 : 0;
        // Occipital lobe (bottom)
        const occipitalBonus = y > 0.3 ? 0.05 : 0;
        const r = Math.sqrt(ex * ex + ey * ey);
        if (r < 0.85 + frontalBonus + occipitalBonus) {
          accepted = true;
        }
      }

      positions.push({
        x: cx + x * (w * 0.42),
        y: cy + y * (h * 0.42),
        hemisphere: x < 0 ? 'left' : 'right',
      });
    }

    return positions;
  }

  // Simple seeded PRNG for reproducible layout
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function setData(brainActivations) {
    activationData = brainActivations;
    currentTimestep = 0;
    render();
  }

  function setTimestep(t) {
    currentTimestep = t;
    render();
  }

  function render() {
    if (!ctx || !vertexPositions) return;
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = '#08090c';
    ctx.fillRect(0, 0, w, h);

    // Draw brain outline
    drawBrainOutline(w, h);

    // Draw midline
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.08);
    ctx.lineTo(w / 2, h * 0.85);
    ctx.strokeStyle = 'rgba(42, 47, 62, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw vertices
    if (!activationData || activationData.length === 0) {
      drawIdleState();
      return;
    }

    const frame = activationData[Math.min(currentTimestep, activationData.length - 1)];
    const numToRender = Math.min(frame.length, vertexPositions.length);

    // Find min/max for normalization
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < numToRender; i++) {
      if (frame[i] < min) min = frame[i];
      if (frame[i] > max) max = frame[i];
    }
    const range = max - min || 1;

    for (let i = 0; i < numToRender; i++) {
      const pos = vertexPositions[i];
      const val = (frame[i] - min) / range; // 0-1
      const color = activationColor(val);
      const size = 2 + val * 3;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow for high-activation vertices
      if (val > 0.7) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size + 4, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
        ctx.fill();
      }
    }

    // Labels
    ctx.font = '10px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(139, 144, 160, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('LEFT', w * 0.25, h - 12);
    ctx.fillText('RIGHT', w * 0.75, h - 12);
    ctx.fillText('ANTERIOR', w / 2, 18);
  }

  function drawBrainOutline(w, h) {
    const cx = w / 2;
    const cy = h / 2 - 10;

    ctx.beginPath();
    ctx.ellipse(cx - w * 0.01, cy, w * 0.42, h * 0.40, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(42, 47, 62, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawIdleState() {
    // Draw faint vertices when no data is loaded
    for (const pos of vertexPositions) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(42, 47, 62, 0.4)';
      ctx.fill();
    }
  }

  function activationColor(val) {
    // Cool-to-warm colormap: deep blue → cyan → green → amber → red
    if (val < 0.2) {
      return lerpColor([10, 22, 40], [0, 68, 102], val / 0.2);
    } else if (val < 0.4) {
      return lerpColor([0, 68, 102], [0, 170, 204], (val - 0.2) / 0.2);
    } else if (val < 0.6) {
      return lerpColor([0, 170, 204], [57, 255, 133], (val - 0.4) / 0.2);
    } else if (val < 0.8) {
      return lerpColor([57, 255, 133], [255, 179, 71], (val - 0.6) / 0.2);
    } else {
      return lerpColor([255, 179, 71], [255, 77, 106], (val - 0.8) / 0.2);
    }
  }

  function lerpColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  }

  // Processing animation — pulsing brain
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

      // Outer pulse ring
      const pulseR = 60 + Math.sin(t) * 10;
      pCtx.beginPath();
      pCtx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      pCtx.strokeStyle = `rgba(57, 255, 133, ${0.15 + Math.sin(t) * 0.1})`;
      pCtx.lineWidth = 1.5;
      pCtx.stroke();

      // Inner rings
      for (let i = 0; i < 3; i++) {
        const r = 25 + i * 15 + Math.sin(t + i * 0.5) * 3;
        pCtx.beginPath();
        pCtx.arc(cx, cy, r, 0, Math.PI * 2);
        pCtx.strokeStyle = `rgba(0, 212, 255, ${0.12 - i * 0.03})`;
        pCtx.lineWidth = 1;
        pCtx.stroke();
      }

      // Scanning dots
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

      // Center dot
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
    render,
    startProcessingAnimation,
    stopProcessingAnimation,
  };
})();
