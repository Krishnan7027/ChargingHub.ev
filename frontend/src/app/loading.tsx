export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 glass rounded-2xl px-10 py-8">
        <div className="relative">
          <div className="w-12 h-12 border-4 rounded-full" style={{ borderColor: 'var(--border-default)' }} />
          <div className="absolute inset-0 w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-theme-muted font-medium">Loading...</p>
      </div>
    </div>
  );
}
