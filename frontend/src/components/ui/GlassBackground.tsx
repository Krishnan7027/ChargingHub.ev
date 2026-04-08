'use client';

export default function GlassBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base background */}
      <div className="absolute inset-0 bg-theme-primary" />

      {/* Gradient blob 1 — green (primary) */}
      <div
        className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full opacity-60"
        style={{
          background: 'var(--mesh-color-1)',
          filter: 'blur(100px)',
          animation: 'blob-drift-1 18s ease-in-out infinite',
        }}
      />

      {/* Gradient blob 2 — blue (accent) */}
      <div
        className="absolute -bottom-[30%] -right-[10%] w-[70%] h-[70%] rounded-full opacity-60"
        style={{
          background: 'var(--mesh-color-2)',
          filter: 'blur(100px)',
          animation: 'blob-drift-2 22s ease-in-out infinite',
        }}
      />

      {/* Gradient blob 3 — purple */}
      <div
        className="absolute top-[20%] right-[20%] w-[50%] h-[50%] rounded-full opacity-50"
        style={{
          background: 'var(--mesh-color-3)',
          filter: 'blur(120px)',
          animation: 'blob-drift-3 25s ease-in-out infinite',
        }}
      />

      {/* Inline keyframes for blob drift */}
      <style jsx>{`
        @keyframes blob-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, 8%) scale(1.05); }
          66% { transform: translate(-3%, -5%) scale(0.95); }
        }
        @keyframes blob-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-6%, -4%) scale(1.08); }
          66% { transform: translate(4%, 6%) scale(0.92); }
        }
        @keyframes blob-drift-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(8%, -6%) scale(0.95); }
          66% { transform: translate(-5%, 3%) scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes blob-drift-1 { 0%, 100% { transform: none; } }
          @keyframes blob-drift-2 { 0%, 100% { transform: none; } }
          @keyframes blob-drift-3 { 0%, 100% { transform: none; } }
        }
      `}</style>
    </div>
  );
}
