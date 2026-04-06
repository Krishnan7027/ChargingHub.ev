import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="text-center">
        <div className="text-8xl font-bold text-primary-600/20 mb-2">404</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go home
          </Link>
          <Link href="/map" className="btn-secondary">
            Find stations
          </Link>
        </div>
      </div>
    </div>
  );
}
