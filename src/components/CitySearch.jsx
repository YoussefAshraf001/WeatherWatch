import React, { useState, useEffect, useRef } from "react";

export default function CitySearch({
  setMarker,
  fetchWeatherForCoords,
  onSelectLocation,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);

  // ================= SEARCH =================
  useEffect(() => {
    if (!query) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://api.weatherapi.com/v1/search.json?key=${
            import.meta.env.VITE_WEATHER_API_KEY
          }&q=${query}`,
        );
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setActiveIndex(-1);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // ================= SELECT =================
  const handleSelect = (item) => {
    setQuery(item.name);

    setResults([]);
    setActiveIndex(-1);
    setOpen(false); // 🔑 THIS closes it

    onSelectLocation({
      lat: item.lat,
      lng: item.lon,
    });
  };

  // ================= KEYBOARD =================
  const handleKeyDown = (e) => {
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    }

    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }

    if (e.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
      setOpen(false);
    }
  };

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setResults([]);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-66">
      <div className="relative w-full">
        {/* INPUT */}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search location…"
          className="
    w-full
    px-4 py-2
    pr-10
    bg-white/10
    text-white
    text-sm
    rounded-xl
    outline-none
    border border-white/20
    backdrop-blur-md
    placeholder:text-gray-400
    focus:border-white/40
    transition
  "
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="
      absolute
      right-3
      top-1/2
      -translate-y-1/2
      text-gray-400
      hover:text-white
      transition cursor-pointer
    "
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      {open && (loading || results.length > 0) && (
        <div
          className="
            absolute
            top-full mt-2
            w-full
            rounded-2xl
            bg-black/70
            backdrop-blur-xl
            border border-white/10
            shadow-lg
            overflow-hidden
            z-20
          "
        >
          {/* Loading */}
          {open && (
            <>
              {/* 1️⃣ LOADING */}
              {loading ? (
                <div className="px-4 py-4 flex justify-center items-center gap-2 text-gray-300">
                  <span className="loading loading-dots loading-lg"></span>
                </div>
              ) : results.length > 0 ? (
                /* 2️⃣ RESULTS */
                <ul className="max-h-56 overflow-y-auto">
                  {results.map((item, index) => {
                    const active = index === activeIndex;

                    return (
                      <li
                        key={`${item.name}-${item.lat}-${item.lon}`}
                        onClick={() => handleSelect(item)}
                        className={`
                px-4 py-2
                cursor-pointer
                transition
                ${active ? "bg-white/20" : "hover:bg-white/10"}
              `}
                      >
                        <p className="text-sm text-white leading-tight">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.region
                            ? `${item.region}, ${item.country}`
                            : item.country}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : query ? (
                /* 3️⃣ EMPTY STATE */
                <div className="px-4 py-3 text-xs text-gray-400">
                  No locations found
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
