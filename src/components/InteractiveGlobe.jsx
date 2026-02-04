import { useEffect, useRef, useState } from "react";
import Globe from "react-globe.gl";
import earthDay from "../assets/earthTextures/daymap.jpg";
import earthNight from "../assets/earthTextures/nightmap.jpg";
import cloudTexture from "../assets/earthTextures/clouds.png";
import starsTexture from "../assets/stars.jpg";

export default function InteractiveGlobe({
  globeRef,
  marker,
  onGlobeClick,
  isDay,
  conditionText,
  dayToggleIntent,
  clearDayToggleIntent,
}) {
  const containerRef = useRef(null);
  const lastPOV = useRef(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const isIdle = isDay === undefined;

  /* ===================== Lighting animation ===================== */
  const [lightBlend, setLightBlend] = useState(isIdle ? 0.5 : isDay ? 1 : 0);
  const [textureIsDay, setTextureIsDay] = useState(isIdle ? true : isDay);

  /* ===================== Responsive sizing ===================== */
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({
        width: Math.floor(width),
        height: Math.floor(height),
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* ===================== Track current POV ===================== */
  useEffect(() => {
    if (!globeRef.current) return;
    lastPOV.current = globeRef.current.pointOfView();
  });

  /* ===================== Atmosphere color ===================== */
  const atmosphereColor = (() => {
    if (!conditionText) return "#88ccee";
    const text = conditionText.toLowerCase();

    if (text.includes("clear")) return "#88ccee";
    if (text.includes("cloud")) return "#b0b0b0";
    if (text.includes("rain")) return "#6fa8dc";
    if (text.includes("snow")) return "#e6f2ff";
    if (text.includes("storm") || text.includes("thunder")) return "#7a7a9d";
    if (text.includes("mist") || text.includes("fog")) return "#9db4c0";

    return "#88ccee";
  })();

  /* ===================== Day / Night transition ===================== */
  useEffect(() => {
    if (isIdle) {
      setLightBlend(0.5);
      setTextureIsDay(true);
      return;
    }

    const target = isDay ? 1 : 0;
    let raf;

    const animateLight = () => {
      setLightBlend((prev) => {
        const next = prev + (target - prev) * 0.08;
        if (Math.abs(next - target) < 0.01) return target;
        raf = requestAnimationFrame(animateLight);
        return next;
      });
    };

    animateLight();

    const textureTimeout = setTimeout(() => {
      setTextureIsDay(isDay);
    }, 250);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(textureTimeout);
    };
  }, [isDay, isIdle]);

  /* ===================== Zoom choreography (toggle only) ===================== */
  useEffect(() => {
    if (!dayToggleIntent) return;
    if (isIdle) return;
    if (!globeRef.current) return;
    if (!lastPOV.current) return;

    const { lat, lng, altitude } = lastPOV.current;

    // Phase 1: zoom OUT
    globeRef.current.pointOfView({ lat, lng, altitude: altitude + 0.4 }, 500);

    // Phase 2: zoom IN after texture swap
    const zoomBack = setTimeout(() => {
      globeRef.current?.pointOfView({ lat, lng, altitude }, 900);
      clearDayToggleIntent();
    }, 700);

    return () => clearTimeout(zoomBack);
  }, [dayToggleIntent]);

  /* ===================== Marker ===================== */
  const pointsData = marker
    ? [{ lat: marker.lat, lng: marker.lng, size: 1, color: "cyan" }]
    : [];

  /* ===================== Camera helper ===================== */
  const flyTo = (lat, lng, altitude = 1.2) => {
    globeRef.current?.pointOfView({ lat, lng, altitude }, 1400);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[300px] rounded-3xl overflow-hidden bg-black"
    >
      {/* Stars background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url(${starsTexture})`,
          backgroundRepeat: "repeat",
          backgroundSize: "600px 600px",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          globeImageUrl={
            isIdle ? earthDay : textureIsDay ? earthDay : earthNight
          }
          globeCloudsTextureUrl={cloudTexture}
          showAtmosphere
          atmosphereAltitude={0.15}
          ambientLightIntensity={isIdle ? 0.4 : 0.25 + lightBlend * 0.55}
          atmosphereColor={
            isIdle
              ? "#666666"
              : `rgba(
                  ${isDay ? "136,204,238" : "90,110,160"},
                  ${0.3 + lightBlend * 0.4}
                )`
          }
          pointLightIntensity={1.2}
          pointsData={pointsData}
          pointLat={(d) => d.lat}
          pointLng={(d) => d.lng}
          pointColor={(d) => d.color}
          pointRadius={(d) => d.size}
          pointAltitude={() => 0.05}
          onGlobeClick={(event) => {
            if (!event) return;
            const { lat, lng } = event;
            flyTo(lat, lng);
            onGlobeClick?.({ lat, lng });
          }}
        />
      )}
    </div>
  );
}
