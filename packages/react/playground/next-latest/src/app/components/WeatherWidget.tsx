import type { BlockContent } from "@storyblok/react";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { storyblokEditable } from "@storyblok/react";

interface WeatherData {
  temperature: number;
  windSpeed: number;
  fetchedAt: string;
  fetchId: string;
}

function hashLocation(location: string): number {
  let hash = 0;
  for (let i = 0; i < location.length; i++) {
    hash = (hash * 31 + location.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function fetchWeatherData(location: string): Promise<WeatherData> {
  const fetchId = Math.random().toString(36).slice(2, 8);
  // Simulated slow fetch — demonstrates Suspense streaming
  await new Promise((resolve) => setTimeout(resolve, 10000));
  const hash = hashLocation(location);
  return {
    temperature: (hash % 15) + 15,
    windSpeed: (hash % 20) + 5,
    fetchedAt: new Date().toISOString(),
    fetchId,
  };
}

// unstable_cache persists the result across requests (revalidates every 60s).
// React.cache() deduplicates calls within the same render pass.
const getCachedWeather = unstable_cache(fetchWeatherData, ["weather"], { revalidate: 60 });
const getWeather = cache(getCachedWeather);

export function WeatherWidgetSkeleton() {
  return (
    <div className="mb-6 animate-pulse rounded-lg border border-zinc-700 bg-zinc-900 p-6">
      <div className="mb-2 h-5 w-32 rounded bg-zinc-700" />
      <div className="mb-4 h-3 w-24 rounded bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 rounded bg-zinc-700" />
        <div className="h-10 rounded bg-zinc-700" />
      </div>
      <div className="mt-4 space-y-1">
        <div className="h-3 w-48 rounded bg-zinc-800" />
        <div className="h-3 w-32 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export default async function WeatherWidget({
  block,
}: {
  block: BlockContent & { title?: string; location?: string };
}) {
  console.log(`[WeatherWidget] rendering "${block.location}"`);
  const weatherData = await getWeather(block.location ?? "");
  console.log(`[WeatherWidget] done (fetchId=${weatherData.fetchId})`);

  return (
    <div
      {...storyblokEditable(block)}
      className="mb-6 rounded-lg border border-zinc-700 bg-zinc-900 p-6"
    >
      <h3 className="text-lg font-semibold text-zinc-100">{block.title}</h3>
      <p className="mt-1 text-sm text-zinc-500">Location: {block.location}</p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold text-blue-400">{weatherData.temperature}°C</p>
          <p className="text-xs text-zinc-500">Temperature</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-green-400">{weatherData.windSpeed} km/h</p>
          <p className="text-xs text-zinc-500">Wind Speed</p>
        </div>
      </div>

      <div className="mt-4 space-y-1 font-mono text-xs text-zinc-600">
        <p>Fetched: {weatherData.fetchedAt}</p>
        <p>Fetch ID: {weatherData.fetchId}</p>
      </div>
    </div>
  );
}
