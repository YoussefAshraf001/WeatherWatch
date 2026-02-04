import { motion } from "framer-motion";

export default function DayNightIndicator({ isDay, isIdle, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={isIdle}
      className={`flex items-center gap-3 ${
        isIdle ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      <span className="text-xs uppercase tracking-wider text-gray-400">
        Daylight
      </span>

      <div className="relative w-14 h-7 rounded-full bg-black/40">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`absolute top-0.5 w-6 h-6 rounded-full ${
            isDay ? "bg-yellow-400" : "bg-indigo-400"
          }`}
          style={{
            left: isDay ? "0.25rem" : "calc(100% - 1.75rem)",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
          <span className={isDay ? "opacity-100" : "opacity-40"}>☀️</span>
          <span className={!isDay ? "opacity-100" : "opacity-40"}>🌙</span>
        </div>
      </div>
    </button>
  );
}
