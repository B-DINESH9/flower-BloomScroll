import React, { useEffect, useRef } from 'react';

interface Petal {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  fallSpeed: number;
  swayAmplitude: number;
  swaySpeed: number;
  swayOffset: number;
  opacity: number;
  color: string;
  // Petal shape variation
  widthRatio: number;
  curve: number;
}

const PETAL_COLORS = [
  'rgba(255, 182, 193, ',  // light pink
  'rgba(255, 160, 180, ',  // medium pink
  'rgba(255, 200, 210, ',  // soft pink
  'rgba(255, 140, 160, ',  // deeper pink
  'rgba(255, 220, 230, ',  // pale pink
  'rgba(255, 170, 190, ',  // rose
  'rgba(240, 150, 170, ',  // dusty rose
  'rgba(255, 210, 220, ',  // blush
];

const FallingPetals: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let petals: Petal[] = [];
    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createPetal = (startFromTop = false): Petal => {
      const w = canvas.width;
      const h = canvas.height;
      return {
        x: Math.random() * w,
        y: startFromTop ? -Math.random() * 60 - 20 : Math.random() * h,
        size: Math.random() * 12 + 6,           // 6-18px
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.04,  // random direction rotation
        fallSpeed: Math.random() * 0.6 + 0.3,         // 0.3 - 0.9 px/frame
        swayAmplitude: Math.random() * 60 + 20,        // 20-80px zigzag width
        swaySpeed: Math.random() * 0.008 + 0.003,      // sway frequency
        swayOffset: Math.random() * Math.PI * 2,        // phase offset
        opacity: Math.random() * 0.4 + 0.15,            // 0.15 - 0.55
        color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
        widthRatio: Math.random() * 0.3 + 0.4,          // width-to-height ratio
        curve: Math.random() * 0.3 + 0.1,               // petal curve amount
      };
    };

    const initPetals = () => {
      resize();
      const count = Math.floor((canvas.width * canvas.height) / 25000); // ~30-80 petals
      petals = [];
      for (let i = 0; i < count; i++) {
        petals.push(createPetal(false));
      }
    };

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;

      const h = p.size;
      const w = h * p.widthRatio;
      const c = p.curve * h;

      // Draw a realistic petal shape using bezier curves
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);

      // Right side curve
      ctx.bezierCurveTo(
        w + c, -h / 4,
        w + c, h / 4,
        0, h / 2
      );

      // Left side curve
      ctx.bezierCurveTo(
        -w - c, h / 4,
        -w - c, -h / 4,
        0, -h / 2
      );

      ctx.closePath();

      // Gradient fill for depth
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.6);
      gradient.addColorStop(0, p.color + (p.opacity + 0.1) + ')');
      gradient.addColorStop(1, p.color + (p.opacity * 0.5) + ')');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Subtle vein/center line
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 + 2);
      ctx.lineTo(0, h / 2 - 2);
      ctx.strokeStyle = p.color + (p.opacity * 0.3) + ')';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time++;

      petals.forEach((p) => {
        // Fall down
        p.y += p.fallSpeed;

        // Zigzag / sway motion using sine wave
        p.x += Math.sin(time * p.swaySpeed + p.swayOffset) * 0.8;

        // Rotate the petal as it falls
        p.rotation += p.rotationSpeed;

        // Slight change in rotation speed for realism (like air resistance)
        if (time % 120 === 0) {
          p.rotationSpeed += (Math.random() - 0.5) * 0.01;
          p.rotationSpeed = Math.max(-0.06, Math.min(0.06, p.rotationSpeed));
        }

        // Wrap around edges
        if (p.y > canvas.height + 30) {
          // Reset to top
          p.y = -30;
          p.x = Math.random() * canvas.width;
          p.opacity = Math.random() * 0.4 + 0.15;
        }
        if (p.x < -40) p.x = canvas.width + 40;
        if (p.x > canvas.width + 40) p.x = -40;

        drawPetal(p);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    initPetals();
    animate();

    window.addEventListener('resize', () => {
      resize();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 4 }}
    />
  );
};

export default FallingPetals;
