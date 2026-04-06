export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-gray-200 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}
