import { useCallback, useEffect, useRef, useState } from "react";

interface FloatingBlob {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
}

interface GeometricShape {
  x: number;
  y: number;
  size: number;
  color: string;
  type: "circle" | "triangle" | "square" | "star";
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const BLOB_COUNT = 8; // Large gradient blobs
const SHAPE_COUNT = 15; // Smaller geometric shapes

export const PixelatedBackground = ({
  isDarkMode,
}: {
  isDarkMode: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blobs, setBlobs] = useState<FloatingBlob[]>([]);
  const [shapes, setShapes] = useState<GeometricShape[]>([]);
  const timeRef = useRef(0);

  const generateBlobs = useCallback(() => {
    // Modern gradient blob colors - vibrant brand palette
    const blobColors = isDarkMode
      ? [
          "rgba(99, 102, 241, 0.15)", // Indigo-500
          "rgba(129, 140, 248, 0.12)", // Indigo-400
          "rgba(167, 139, 250, 0.15)", // Violet-400
          "rgba(251, 191, 36, 0.1)", // Amber-400
          "rgba(245, 158, 11, 0.12)", // Amber-500
        ]
      : [
          "rgba(199, 210, 254, 0.3)", // Indigo-200
          "rgba(165, 180, 252, 0.25)", // Indigo-300
          "rgba(196, 181, 253, 0.3)", // Violet-300
          "rgba(253, 230, 138, 0.35)", // Amber-200
          "rgba(252, 211, 77, 0.3)", // Amber-300
        ];

    return Array.from({ length: BLOB_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 250 + 200, // Large blobs: 200-450px
      color: blobColors[Math.floor(Math.random() * blobColors.length)],
      speedX: (Math.random() - 0.5) * 0.015,
      speedY: (Math.random() - 0.5) * 0.015,
      opacity: Math.random() * 0.4 + 0.3,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    }));
  }, [isDarkMode]);

  const generateShapes = useCallback(() => {
    const shapeTypes: Array<"circle" | "triangle" | "square" | "star"> = [
      "circle",
      "triangle",
      "square",
      "star",
    ];

    const shapeColors = isDarkMode
      ? [
          "rgba(99, 102, 241, 0.2)", // Indigo
          "rgba(251, 191, 36, 0.2)", // Amber
          "rgba(167, 139, 250, 0.18)", // Violet
          "rgba(134, 239, 172, 0.15)", // Green
        ]
      : [
          "rgba(99, 102, 241, 0.25)", // Indigo
          "rgba(251, 191, 36, 0.3)", // Amber
          "rgba(167, 139, 250, 0.25)", // Violet
          "rgba(134, 239, 172, 0.2)", // Green
        ];

    return Array.from({ length: SHAPE_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 40 + 20, // 20-60px
      color: shapeColors[Math.floor(Math.random() * shapeColors.length)],
      type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
      speedX: (Math.random() - 0.5) * 0.03,
      speedY: (Math.random() - 0.5) * 0.03,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      opacity: Math.random() * 0.3 + 0.2,
    }));
  }, [isDarkMode]);

  useEffect(() => {
    setBlobs(generateBlobs());
    setShapes(generateShapes());
  }, [isDarkMode, generateBlobs, generateShapes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let animationFrameId: number;

    const drawBlob = (blob: FloatingBlob, canvas: HTMLCanvasElement) => {
      const x = (blob.x / 100) * canvas.width;
      const y = (blob.y / 100) * canvas.height;

      // Create radial gradient for blob
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, blob.size);
      gradient.addColorStop(0, blob.color);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((blob.rotation * Math.PI) / 180);
      ctx.scale(1, 0.8); // Slightly squished for organic feel

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, blob.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawShape = (shape: GeometricShape, canvas: HTMLCanvasElement) => {
      const x = (shape.x / 100) * canvas.width;
      const y = (shape.y / 100) * canvas.height;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.fillStyle = shape.color;
      ctx.globalAlpha = shape.opacity;

      switch (shape.type) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, shape.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "square":
          ctx.fillRect(
            -shape.size / 2,
            -shape.size / 2,
            shape.size,
            shape.size,
          );
          break;

        case "triangle":
          ctx.beginPath();
          ctx.moveTo(0, -shape.size / 2);
          ctx.lineTo(shape.size / 2, shape.size / 2);
          ctx.lineTo(-shape.size / 2, shape.size / 2);
          ctx.closePath();
          ctx.fill();
          break;

        case "star":
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const radius = i % 2 === 0 ? shape.size / 2 : shape.size / 4;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          break;
      }

      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      timeRef.current += 0.016; // ~60fps

      // Update and draw blobs with floating animation
      blobs.forEach((blob) => {
        // Organic floating motion using sine waves
        blob.x += blob.speedX + Math.sin(timeRef.current + blob.y) * 0.01;
        blob.y += blob.speedY + Math.cos(timeRef.current + blob.x) * 0.01;
        blob.rotation += blob.rotationSpeed;

        // Wrap around screen
        if (blob.x < -10) blob.x = 110;
        if (blob.x > 110) blob.x = -10;
        if (blob.y < -10) blob.y = 110;
        if (blob.y > 110) blob.y = -10;

        drawBlob(blob, canvas);
      });

      // Update and draw geometric shapes
      shapes.forEach((shape) => {
        shape.x += shape.speedX;
        shape.y += shape.speedY;
        shape.rotation += shape.rotationSpeed;

        // Wrap around screen
        if (shape.x < -5) shape.x = 105;
        if (shape.x > 105) shape.x = -5;
        if (shape.y < -5) shape.y = 105;
        if (shape.y > 105) shape.y = -5;

        drawShape(shape, canvas);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [blobs, shapes]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ opacity: 0.8 }}
    />
  );
};
