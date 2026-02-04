import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import toast from "react-hot-toast";

// simple cubic Bézier smoothing
function buildSmoothPath(points) {
  if (!points.length) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const p2 = points[i + 1];
    const cpX = (p.x + p2.x) / 2;
    d += ` C ${cpX},${p.y} ${cpX},${p2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function Timeline({
  weatherData,
  timelineView,
  selectedDayIndex,
  setTimelineView,
  setSelectedDayIndex,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!weatherData) return null;

  const width = 1000;
  const height = 200;
  const margin = 40;
  const usableW = width - margin * 2;
  const usableH = height - margin * 2;

  let dayHourly = [];
  let points = [];

  if (timelineView === "daily") {
    points = Array.from({ length: 7 }).map((_, i) => {
      const dayData =
        weatherData.daily[i] || weatherData.daily[weatherData.daily.length - 1];
      const date = new Date();
      date.setDate(date.getDate() + i);
      return {
        x: margin + (i / 6) * usableW,
        y:
          margin +
          usableH *
            (1 -
              ((dayData.temp.max + dayData.temp.min) / 2 -
                Math.min(
                  ...weatherData.daily.map(
                    (d) => (d.temp.max + d.temp.min) / 2,
                  ),
                )) /
                (Math.max(
                  ...weatherData.daily.map(
                    (d) => (d.temp.max + d.temp.min) / 2,
                  ),
                ) -
                  Math.min(
                    ...weatherData.daily.map(
                      (d) => (d.temp.max + d.temp.min) / 2,
                    ),
                  ) || 1)),
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        max: dayData.temp.max,
        min: dayData.temp.min,
        index: i,
      };
    });
  } else if (timelineView === "hourly") {
    dayHourly = weatherData.hourly[selectedDayIndex] || [];
    if (dayHourly.length) {
      const temps = dayHourly.map((h) => h.temp);
      const minT = Math.min(...temps);
      const maxT = Math.max(...temps);
      dayHourly = dayHourly.map((h, i, arr) => ({
        ...h,
        x: margin + (i / (arr.length - 1)) * usableW,
        y: margin + usableH * (1 - (h.temp - minT) / (maxT - minT || 1)),
        hour: new Date(h.dt * 1000),
      }));
      points = dayHourly;
    }
  }

  const pathD = buildSmoothPath(points);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px]">
      <AnimatePresence>
        <motion.path
          key={timelineView} // animate on view change
          d={pathD}
          fill="none"
          stroke="white"
          strokeWidth={timelineView === "daily" ? 2.5 : 1.5}
          strokeOpacity={timelineView === "daily" ? 1 : 0.7}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>

      {/* Points */}
      {points.map((pt, i) => {
        const isClickable = timelineView === "daily" && pt.index < 3;
        const isHovered = hoveredIndex === i;

        return (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => {
              if (!isClickable) {
                if (timelineView === "daily") {
                  toast("Forecast is only available for the next 3 days");
                }
                return;
              }
              setSelectedDayIndex(pt.index);
              setTimelineView("hourly");
            }}
            style={{
              cursor: isClickable ? "pointer" : "not-allowed",
            }}
          >
            {/* POINT */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={timelineView === "daily" ? 6 : 4}
              fill={
                isHovered && isClickable
                  ? "#93c5fd" // blue-300
                  : "white"
              }
              opacity={!isClickable && timelineView === "daily" ? 0.4 : 1}
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={1.5}
            />

            {/* DAILY VIEW */}
            {timelineView === "daily" && (
              <>
                <text
                  x={pt.x}
                  y={20}
                  fontSize="12"
                  textAnchor="middle"
                  fill={isHovered && isClickable ? "#93c5fd" : "white"}
                  opacity={isClickable ? 0.9 : 0.35}
                >
                  {pt.label}
                </text>

                <text
                  x={pt.x}
                  y={height - 10}
                  fontSize="12"
                  textAnchor="middle"
                  fill={isHovered && isClickable ? "#93c5fd" : "white"}
                  opacity={isClickable ? 0.9 : 0.35}
                >
                  {Math.round(pt.max)}°C
                </text>
              </>
            )}

            {/* HOURLY VIEW */}
            {timelineView === "hourly" && (
              <>
                <text
                  x={pt.x}
                  y={pt.y - 12}
                  fontSize="10"
                  textAnchor="middle"
                  fill="white"
                  opacity={isHovered ? 1 : 0.7}
                >
                  {Math.round(pt.temp)}°C
                </text>

                <text
                  x={pt.x}
                  y={height - 10}
                  fontSize="10"
                  textAnchor="middle"
                  fill="white"
                  opacity={isHovered ? 1 : 0.7}
                >
                  {pt.hour.toLocaleTimeString([], {
                    hour: "numeric",
                    hour12: true,
                  })}
                </text>
              </>
            )}

            {/* Native tooltip */}
            {timelineView === "daily" && (
              <title>
                {isClickable
                  ? "Click to view hourly forecast"
                  : "Hourly forecast available for next 3 days only"}
              </title>
            )}
          </g>
        );
      })}
    </svg>
  );
}
