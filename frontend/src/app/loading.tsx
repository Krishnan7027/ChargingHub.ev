import EVLoader from '@/components/ui/EVLoader';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass rounded-2xl px-10 py-8">
        <EVLoader size="lg" text="Loading..." />
      </div>
    </div>
  );
}
