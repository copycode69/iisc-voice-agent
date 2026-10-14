const WEATHER: Record<number, string> = {
  0: 'clear',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'light freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'light freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'light snow showers',
  86: 'snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'thunderstorm with heavy hail',
};

function describe(code: number): string {
  return WEATHER[code] ?? 'unknown weather';
}

function whole(value: number): number {
  return Math.round(value);
}

export async function getWeather(city: string, day: string): Promise<unknown> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
    );
    if (!geoRes.ok) return { error: `Weather lookup failed (${geoRes.status}).` };
    const geo = (await geoRes.json()) as {
      results?: Array<{ name: string; latitude: number; longitude: number; timezone?: string }>;
    };
    const place = geo.results?.[0];
    if (!place) return { error: `No location found for ${city}` };

    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata`,
    );
    if (!forecastRes.ok) return { error: `Weather lookup failed (${forecastRes.status}).` };
    const forecast = (await forecastRes.json()) as {
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
      };
    };
    const daily = forecast.daily;
    const index = daily?.time.indexOf(day) ?? -1;
    if (!daily || index < 0) return { error: `No forecast for ${day}`, city: place.name };
    return {
      city: place.name,
      day,
      summary: describe(daily.weather_code[index]),
      temp_max_c: whole(daily.temperature_2m_max[index]),
      temp_min_c: whole(daily.temperature_2m_min[index]),
      rain_probability_pct: whole(daily.precipitation_probability_max[index]),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Weather lookup failed.' };
  }
}
