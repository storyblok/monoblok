export function WeatherWidgetSkeleton() {
  return (
    <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900 p-6">
      <div className="animate-pulse">
        {/* Title */}
        <div className="h-6 w-40 rounded bg-zinc-800" />

        {/* Location */}
        <div className="mt-2 h-4 w-28 rounded bg-zinc-800" />

        {/* Weather Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="h-10 w-20 rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-16 rounded bg-zinc-800" />
          </div>

          <div>
            <div className="h-10 w-20 rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-20 rounded bg-zinc-800" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 space-y-2">
          <div className="h-3 w-48 rounded bg-zinc-800" />
          <div className="h-3 w-36 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
