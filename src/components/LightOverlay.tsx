interface LightOverlayProps {
  progress?: number; // 0-1
}

/**
 * Eclipse light from the bottom center (worker's feet).
 * Grows from a faint streetlight glow (200px) to a half-page wash (1200px+).
 */
const LightOverlay = ({ progress = 0 }: LightOverlayProps) => {
  const p = Math.min(1, Math.max(0, progress));

  // Opacity: 0.05 → 0.25 → 0.45
  const opacity = p < 0.5 ? 0.05 + (p / 0.5) * 0.2 : 0.25 + ((p - 0.5) / 0.5) * 0.2;

  // Radius (px): 200 → 500 → 1200
  const radius = p < 0.5 ? 200 + (p / 0.5) * 300 : 500 + ((p - 0.5) / 0.5) * 700;
  const verticalRadius = radius * 1.4;

  return (
    <>
      {/* Main eclipse glow — radial gradient from 50% 100% (bottom center, near feet) */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(${radius}px ${verticalRadius}px at 50% 100%,
            rgba(255, 255, 255, ${opacity}) 0%,
            rgba(255, 255, 255, ${opacity * 0.4}) 35%,
            rgba(180, 200, 230, ${opacity * 0.2}) 60%,
            rgba(0, 0, 0, 0) 100%)`,
        }}
      />
      {/* Ground reflection — flatter ellipse at very bottom */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "20%",
          background: `radial-gradient(${radius * 0.8}px ${radius * 0.2}px at 50% 100%,
            rgba(255, 255, 255, ${opacity * 0.6}) 0%,
            rgba(255, 255, 255, 0) 100%)`,
        }}
      />
    </>
  );
};

export default LightOverlay;
