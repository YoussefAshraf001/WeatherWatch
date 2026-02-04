import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import InteractiveGlobe from "./components/InteractiveGlobe";
import CitySearch from "./components/CitySearch";
import Timeline from "./components/Timeline";
import toast, { Toaster } from "react-hot-toast";
import { RANDOM_CITIES } from "./data/randomCities";
import DayNightIndicator from "./components/DayNightIndicator";

export default function App() {
  const globeRef = useRef(null);

  const [selectedLocationName, setSelectedLocationName] = useState("");
  const [locationStatus, setLocationStatus] = useState("idle");
  const [marker, setMarker] = useState(null); // { lat, lng }
  const [weatherData, setWeatherData] = useState(null);
  const [randomLocations, setRandomLocations] = useState([]);

  const [timelineView, setTimelineView] = useState("daily");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const [videoSrc, setVideoSrc] = useState("./default.mp4");
  const [dayPreview, setDayPreview] = useState(null);
  // null = follow real daylight
  // true = force day
  // false = force night

  // video map for simple mood changes
  const weatherVideos = {
    Overcast: "./overcast.mp4",
    Clear: "./clear.mp4",
    Sunny: "./sunny.mp4",
    Clouds: "./cloudy.mp4",
    Rain: "./rain.mp4",
    Snow: "./snow.mp4",
    Thunderstorm: "./thunder.mp4",
    Mist: "./mist.mp4",
    Default: "./default.mp4",
  };

  const effectiveIsDay =
    dayPreview !== null ? dayPreview : weatherData?.current?.is_day;

  async function fetchWeatherForCoords(lat, lon) {
    try {
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${
        import.meta.env.VITE_WEATHER_API_KEY
      }&q=${lat},${lon}&days=7&aqi=no&alerts=no`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("WeatherAPI fetch failed: " + res.status);

      const data = await res.json();

      if (!data || !data.location) {
        setSelectedLocationName("No data available here");
        setWeatherData(null);
        return;
      }

      // Set the location name
      setSelectedLocationName(
        `${data.location.name}, ${data.location.country}`,
      );

      toast(
        <span>
          We now flew to{" "}
          <strong>
            {data.location.name}, {data.location.country}
          </strong>
        </span>,
        { id: "location-change", icon: "✈️" },
      );

      const transformedData = {
        current: {
          temp: data.current.temp_c,
          feelslike_c: data.current.feelslike_c,
          wind_kph: data.current.wind_kph,
          wind_dir: data.current.wind_dir,
          pressure_mb: data.current.pressure_mb,
          humidity: data.current.humidity,
          condition: data.current.condition,
          is_day: data.current.is_day,
          dt: Math.floor(new Date(data.current.last_updated).getTime() / 1000),
        },

        daily: data.forecast.forecastday.map((day) => ({
          temp: { max: day.day.maxtemp_c, min: day.day.mintemp_c },
          date: day.date,
        })),

        hourly: Array.from({ length: 7 }).map((_, i) => {
          const day = data.forecast.forecastday[i];
          if (!day) return []; // missing hourly
          return day.hour.map((h) => ({
            temp: h.temp_c,
            dt: Math.floor(new Date(h.time).getTime() / 1000),
          }));
        }),

        timezone_offset: 0,
      };

      setWeatherData(transformedData);
      setDayPreview(null);
    } catch (err) {
      setSelectedLocationName("No data available here");
      setWeatherData(null);
    }
  }

  // im updating the video when weather changes.
  useEffect(() => {
    if (!weatherData?.current?.condition?.text) {
      setVideoSrc(weatherVideos.Default);
      return;
    }

    const text = weatherData.current.condition.text;
    const t = text.toLowerCase();

    const key = t.includes("clear")
      ? "Clear"
      : t.includes("sunny")
        ? "Sunny"
        : t.includes("overcast")
          ? "Overcast"
          : t.includes("cloud")
            ? "Clouds"
            : t.includes("rain") || t.includes("drizzle")
              ? "Rain"
              : t.includes("snow") || t.includes("sleet")
                ? "Snow"
                : t.includes("mist") || t.includes("fog")
                  ? "Mist"
                  : t.includes("thunder")
                    ? "Thunderstorm"
                    : "Default";

    setVideoSrc(weatherVideos[key] || weatherVideos.Default);
  }, [weatherData]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // marker first (cheap, safe)
        setMarker({ lat, lng: lon });

        // fetch weather FIRST
        await fetchWeatherForCoords(lat, lon);

        // THEN fly once everything is ready
        requestAnimationFrame(() => {
          globeRef.current?.pointOfView({ lat, lng: lon, altitude: 1.2 }, 1400);
        });

        setLocationStatus("loaded");
      },
      () => {
        setLocationStatus("denied");
      },
    );
  };

  async function fetchQuickTemp(lat, lon) {
    const url = `https://api.weatherapi.com/v1/current.json?key=${
      import.meta.env.VITE_WEATHER_API_KEY
    }&q=${lat},${lon}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    return {
      temp: Math.round(data.current.temp_c),
      condition: data.current.condition.text,
    };
  }

  function getRandomCities(list, count = 6) {
    return [...list].sort(() => 0.5 - Math.random()).slice(0, count);
  }

  async function refreshRandomLocations() {
    const cities = getRandomCities(RANDOM_CITIES, 6);

    const enriched = await Promise.all(
      cities.map(async (city) => {
        try {
          const weather = await fetchQuickTemp(city.lat, city.lon);
          if (!weather) return null;

          return {
            ...city,
            ...weather,
          };
        } catch {
          return null;
        }
      }),
    );

    setRandomLocations(enriched.filter(Boolean));
  }

  useEffect(() => {
    async function loadRandomLocations() {
      const cities = getRandomCities(RANDOM_CITIES);

      const enriched = await Promise.all(
        cities.map(async (city) => {
          const weather = await fetchQuickTemp(city.lat, city.lon);
          return weather ? { ...city, ...weather } : null;
        }),
      );

      setRandomLocations(enriched.filter(Boolean));
    }

    loadRandomLocations();
  }, []);

  async function handleRandomClick(city) {
    const { lat, lon } = city;

    flyTo(lat, lon);
    setMarker({ lat, lng: lon });
    setLocationStatus("loading");

    await fetchWeatherForCoords(lat, lon);
    setLocationStatus("loaded");
  }

  // ----------------------
  // handle globe clicks (user clicks on globe)
  // ----------------------
  const handleGlobeClick = async ({ lat, lng }) => {
    flyTo(lat, lng);
    setMarker({ lat, lng });
    await fetchWeatherForCoords(lat, lng);
  };

  const flyTo = (lat, lng, altitude = 1.2) => {
    requestAnimationFrame(() => {
      globeRef.current?.pointOfView({ lat, lng, altitude }, 1200);
    });
  };

  // top-level render
  return (
    <motion.div
      className="relative min-h-screen w-full overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* background video */}
      <AnimatePresence mode="wait">
        <motion.video
          key={videoSrc}
          className="absolute inset-0 h-full w-full object-cover -z-10"
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>
      {/* main layout */}
      <div className="w-full min-h-screen flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-10">
        {/* left sidebar (unchanged) */}
        <div
          className="
    w-full
    lg:w-[280px]
    xl:w-[320px]
    shrink-0
    bg-black/60 backdrop-blur-md
    rounded-xl
    p-4
    flex flex-col
  "
        >
          {/* ================= HEADER ================= */}
          <div className="pb-4 pt-5">
            <h2 className="text-white text-2xl font-semibold text-center tracking-wide">
              WeatherWatch
            </h2>
            <div className="w-16 h-0.5 bg-white/40 mx-auto mt-2 rounded-full" />
          </div>

          {/* ================= STATUS / TIME ================= */}
          <div className="space-y-3">
            <h2 className="text-sm uppercase tracking-wider text-gray-300">
              Status
            </h2>

            <div className="relative bg-white/5 rounded-2xl p-4 backdrop-blur-md overflow-hidden">
              {/* subtle glow */}
              <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent pointer-events-none" />

              <div className="relative flex items-center justify-between">
                {/* Time & date */}
                <div>
                  <p className="text-2xl font-light text-white leading-none">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                {/* Live indicator */}
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  <span className="text-xs uppercase tracking-wider text-gray-300">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= CURRENT CONDITIONS ================= */}
          <div className="mt-6 bg-white/5 rounded-2xl p-4 backdrop-blur-md">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">
              Right now
            </p>

            {/* Temperature + condition */}
            <div className="flex items-center justify-between mb-4">
              {/* Left: temps */}
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-light text-white">
                    {weatherData ? Math.round(weatherData.current.temp) : "--"}°
                  </span>
                  <span className="text-sm text-gray-400">
                    feels like{" "}
                    {weatherData
                      ? Math.round(weatherData.current.feelslike_c)
                      : "--"}
                    °
                  </span>
                </div>

                {/* Last updated */}
                <p className="text-xs text-gray-400 mt-1">
                  Updated{" "}
                  {weatherData
                    ? new Date(
                        weatherData.current.dt * 1000,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--"}
                </p>
              </div>

              {/* Right: condition icon */}
              {weatherData?.current?.condition && (
                <div className="flex flex-col items-center text-center">
                  <img
                    src={`https:${weatherData.current.condition.icon}`}
                    alt={weatherData.current.condition.text}
                    className="w-12 h-12"
                  />
                  <span className="text-xs text-gray-300 mt-1 capitalize">
                    {weatherData.current.condition.text}
                  </span>
                </div>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Wind</span>
                <span className="text-gray-200">
                  {weatherData
                    ? `${Math.round(weatherData.current.wind_kph)} km/h ${weatherData.current.wind_dir}`
                    : "--"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Pressure</span>
                <span className="text-gray-200">
                  {weatherData ? weatherData.current.pressure_mb : "--"} mb
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Humidity</span>
                <span className="text-gray-200">
                  {weatherData ? weatherData.current.humidity : "--"}%
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Daylight</span>
                <span className="text-gray-200">
                  {weatherData
                    ? weatherData.current.is_day
                      ? "Day"
                      : "Night"
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* ================= FLEX SPACER ================= */}
          <div className="flex-1" />

          {/* ================= GLOBE SECTION (BOTTOM) ================= */}
          <div>
            <div className="flex justify-between items-center mb-2 pt-8 lg:pt-0 px-1">
              <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">
                Active Coordinates
              </h2>

              {marker ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  <span className="uppercase tracking-wider">Tracking</span>
                </div>
              ) : (
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  Idle
                </span>
              )}
            </div>
            <div className="py-2 flex justify-center pb-5">
              <DayNightIndicator
                isDay={effectiveIsDay}
                isIdle={!weatherData}
                onToggle={() => {
                  setDayPreview((prev) =>
                    prev === null ? !weatherData.current.is_day : !prev,
                  );
                }}
              />
            </div>
            <div className="rounded-2xl bg-black/60 overflow-hidden">
              <InteractiveGlobe
                globeRef={globeRef}
                marker={marker}
                onGlobeClick={handleGlobeClick}
                isDay={effectiveIsDay}
                conditionText={weatherData?.current?.condition?.text}
              />
            </div>

            {selectedLocationName && (
              <p className="mt-2 text-center text-xs text-gray-300 px-4 py-2">
                {selectedLocationName}
              </p>
            )}
          </div>
        </div>

        {/* center section */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-transparent">
          {/* frosted background panel */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-md z-0" />

          <div
            className="
  relative z-10
  w-full
  px-4 sm:px-6 lg:px-8
  py-6
  text-white
  flex flex-col
  gap-6
"
          >
            {/* top row: location/date or location button + search */}
            <div className="flex justify-between items-center w-full">
              <div className="text-gray-200 tracking-wide">
                {!selectedLocationName ? (
                  <button
                    onClick={handleUseLocation}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                  >
                    Use My Location
                  </button>
                ) : (
                  <>
                    <p className="text-lg font-light">{selectedLocationName}</p>
                  </>
                )}
              </div>

              <div className="relative">
                <CitySearch
                  onSelectLocation={async ({ lat, lng }) => {
                    flyTo(lat, lng);
                    setMarker({ lat, lng });
                    setLocationStatus("loading");
                    await fetchWeatherForCoords(lat, lng);
                    setLocationStatus("loaded");
                  }}
                />
              </div>
            </div>

            {/* middle content: big temp + right info */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* left big readout */}
              <div className="flex-1">
                <div className="flex items-start gap-6">
                  <span className="text-[110px] font-light leading-none">
                    {weatherData
                      ? Math.round(weatherData.current.temp) + "°"
                      : "--°"}
                  </span>

                  <div className="mt-4 flex flex-col gap-3">
                    {/* Max */}
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md gap-2">
                      <span className="text-xs uppercase tracking-wider text-gray-400">
                        Max Temp.
                      </span>
                      <span className="text-lg font-light text-white">
                        {weatherData
                          ? Math.round(weatherData.daily?.[0]?.temp?.max)
                          : "--"}
                        °
                      </span>
                    </div>

                    {/* Min */}
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/5 backdrop-blur-md">
                      <span className="text-xs uppercase tracking-wider text-gray-400">
                        Min Temp.
                      </span>
                      <span className="text-lg font-light text-white">
                        {weatherData
                          ? Math.round(weatherData.daily?.[0]?.temp?.min)
                          : "--"}
                        °
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-2xl font-light tracking-wider mt-2 opacity-90">
                  {(() => {
                    switch (locationStatus) {
                      case "denied":
                        return "Allow access to view data please";
                      case "loading":
                        return (
                          <span className="loading loading-bars loading-lg"></span>
                        );
                      case "loaded":
                        return weatherData?.current?.condition?.text || "";

                      default:
                        return "Allow access to view data please";
                    }
                  })()}
                </p>

                {/* spacer - timeline belongs at bottom (see svg below) */}
                <div className="mt-auto" />
              </div>

              {/* right info panel */}
              <div
                className="
    w-full
    lg:w-[260px]
    flex flex-col
    gap-6
  "
              >
                {/* ---------- Intro ---------- */}
                <div className="text-sm text-gray-300 leading-relaxed">
                  Explore real-time weather conditions across the globe.
                </div>

                {/* ---------- Section Header ---------- */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-wider text-gray-400">
                    Explore the World
                  </h3>
                  <button
                    onClick={refreshRandomLocations}
                    className="text-xs text-gray-400 hover:text-gray-200 transition cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {/* ---------- Location List ---------- */}
                <div className="space-y-2">
                  {randomLocations.map((city, i) => (
                    <button
                      key={i}
                      onClick={() => handleRandomClick(city)}
                      className="
          group
          w-full
          rounded-xl
          px-4
          py-3
          flex
          items-center
          justify-between
          bg-white/5
          hover:bg-white/10
          backdrop-blur-md
          transition cursor-pointer
        "
                    >
                      {/* City info */}
                      <div className="text-left">
                        <p className="text-sm text-gray-200 leading-tight">
                          {city.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {city.condition}
                        </p>
                      </div>

                      {/* Temperature */}
                      <p className="text-xl font-light text-white group-hover:translate-x-0.5 transition-transform">
                        {city.temp}°
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* timeline graph fixed at bottom of center card */}
            <AnimatePresence mode="wait">
              <div className="mt-6 w-full overflow-x-auto relative">
                <p className="mb-2 text-xs text-gray-400">
                  Tip: click a day to view hourly temperatures
                </p>

                <div className="bg-white/3 rounded-xl p-4 relative">
                  {timelineView === "hourly" && (
                    <button
                      onClick={() => setTimelineView("daily")}
                      className="absolute top-2 left-2 px-3 py-1 bg-white/20 text-white rounded-md hover:bg-white/30 backdrop-blur-md z-10 transition"
                    >
                      ← Back to Days
                    </button>
                  )}

                  {weatherData && (
                    <motion.div
                      key={timelineView + selectedDayIndex}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <Timeline
                        weatherData={weatherData}
                        timelineView={timelineView}
                        selectedDayIndex={selectedDayIndex}
                        setTimelineView={setTimelineView}
                        setSelectedDayIndex={setSelectedDayIndex}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* main layout end */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: "#333", color: "#fff" },
        }}
      />
    </motion.div>
  );
}
