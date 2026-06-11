"use client";

// Dependency-free canvas signature pad → data URL in a hidden input.
import { useEffect, useRef, useState } from "react";

export function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [signed, setSigned] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1A1D21";
  }, []);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!signed) setSigned(true);
    inputRef.current!.value = canvasRef.current!.toDataURL("image/png");
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    inputRef.current!.value = "";
    setSigned(false);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-32 rounded-lg border-2 border-dashed border-steel-300 bg-white touch-none cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-steel-400">{signed ? "Signed" : "Sign above with mouse or finger"}</span>
        <button type="button" onClick={clear} className="text-xs font-semibold text-steel-500 hover:text-steel-700 underline">
          Clear
        </button>
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}
