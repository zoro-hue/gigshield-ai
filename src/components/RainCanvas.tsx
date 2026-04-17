import { useEffect, useRef } from "react";

interface RainCanvasProps {
  intensity?: number; // 0-1
}

const RainCanvas = ({ intensity = 1 }: RainCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  const reducedMotion = useRef(false);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const isMobile = window.innerWidth < 768;
    const baseDrops = isMobile ? 150 : 400;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Drop {
      x: number; y: number; len: number; speed: number; opacity: number;
    }

    const drops: Drop[] = Array.from({ length: baseDrops }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: 18 + Math.random() * 36,
      speed: 4 + Math.random() * 8,
      opacity: 0.1 + Math.random() * 0.2,
    }));

    // Splashes at ground
    interface Splash { x: number; y: number; r: number; life: number; }
    const splashes: Splash[] = [];

    // Lightning
    let flash = 0;
    let nextFlash = Date.now() + 3000 + Math.random() * 4000;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const inten = intensityRef.current;
      const now = Date.now();

      // Lightning
      if (now > nextFlash && inten > 0.3) {
        flash = 0.6 + Math.random() * 0.4;
        nextFlash = now + 2000 + Math.random() * 5000;
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(220, 230, 255, ${flash * inten * 0.18})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flash *= 0.85;
        if (flash < 0.01) flash = 0;
      }

      const activeDrops = Math.floor(baseDrops * inten);

      ctx.lineWidth = 0.7 + flash * 1.5;
      for (let i = 0; i < activeDrops; i++) {
        const d = drops[i];
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1.5, d.y + d.len);
        ctx.strokeStyle = `rgba(255, 255, 255, ${d.opacity * inten * (1 + flash * 0.5)})`;
        ctx.stroke();

        d.y += d.speed;
        d.x -= 0.5;

        if (d.y > canvas.height) {
          // Splash
          if (Math.random() < 0.4) {
            splashes.push({ x: d.x, y: canvas.height - 2, r: 1, life: 1 });
          }
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      }

      // Render splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * 3, s.r, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 220, 255, ${s.life * 0.25 * inten})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        s.r += 0.4;
        s.life -= 0.04;
        if (s.life <= 0) splashes.splice(i, 1);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ display: "block" }}
    />
  );
};

export default RainCanvas;
