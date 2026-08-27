import { cache } from "react";
import { unstable_cache } from "next/cache";
import { StoryblokComponentProps, storyblokEditable } from "@storyblok/react";

type WeatherWidgetProps = StoryblokComponentProps<{ title: string; location: string }>;

interface WeatherData {
  temperature: number;
  windSpeed: number;
  fetchedAt: string;
  fetchId: string;
}

async function fetchWeatherData(location: string): Promise<WeatherData> {
  const fetchId = Math.random().toString(36).slice(2, 8);
  await new Promise((resolve) => setTimeout(resolve, 10000));
  return {
    temperature: Math.floor(Math.random() * 15) + 15,
    windSpeed: Math.floor(Math.random() * 20) + 5,
    fetchedAt: new Date().toISOString(),
    fetchId,
  };
}

const getCachedWeather = unstable_cache(fetchWeatherData, ["weather"], {
  revalidate: 60,
});

const getWeather = cache(getCachedWeather);

export async function WeatherWidget({ block }: WeatherWidgetProps) {
  const weatherData = await getWeather(block.location ?? "");
  return (
    <div
      className="rounded-lg border border-zinc-700 bg-zinc-900 p-6 mb-6"
      {...storyblokEditable(block)}
    >
      <h3 className="text-lg font-semibold text-zinc-100">{block.title}</h3>
      <p className="text-sm text-zinc-500 mt-1">Location: {block.location}</p>

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

      <div className="mt-4 text-xs text-zinc-600 font-mono space-y-1">
        <p>Fetched: {weatherData.fetchedAt}</p>
        <p>Fetch ID: {weatherData.fetchId}</p>
      </div>
    </div>
  );
}
