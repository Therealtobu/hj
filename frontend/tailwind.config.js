/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base:  "#08080f",
        glass: {
          1: "rgba(255,255,255,0.04)",
          2: "rgba(255,255,255,0.07)",
          3: "rgba(255,255,255,0.10)",
          border: "rgba(255,255,255,0.08)",
          "border-hover": "rgba(255,255,255,0.16)",
        },
        ink: {
          1: "#f5f5f7",
          2: "#a1a1aa",
          3: "#52525b",
          4: "#3f3f46",
        },
        accent: {
          blue:   "#2563eb",
          "blue-glow": "rgba(37,99,235,0.35)",
          green:  "#22c55e",
          "green-glow": "rgba(34,197,94,0.3)",
          red:    "#ef4444",
          "red-glow":   "rgba(239,68,68,0.3)",
          amber:  "#f59e0b",
        },
      },
      fontFamily: {
        sans:    ["'Plus Jakarta Sans'", "sans-serif"],
        mono:    ["'Geist Mono'", "monospace"],
        display: ["'Bricolage Grotesque'", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      backdropBlur: {
        xs: "4px",
        "2xl": "40px",
        "3xl": "60px",
      },
      boxShadow: {
        glass:    "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        "glass-sm": "0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glow-blue":  "0 0 24px rgba(37,99,235,0.4), 0 0 48px rgba(37,99,235,0.15)",
        "glow-green": "0 0 16px rgba(34,197,94,0.35)",
        "glow-red":   "0 0 16px rgba(239,68,68,0.35)",
        "inner-top":  "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      animation: {
        "fade-up":   "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":   "fadeIn 0.35s ease both",
        "scale-in":  "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "slide-right": "slideRight 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        "orb-1": "orbFloat1 12s ease-in-out infinite",
        "orb-2": "orbFloat2 16s ease-in-out infinite",
      },
      keyframes: {
        fadeUp:    { from:{opacity:"0",transform:"translateY(16px)"}, to:{opacity:"1",transform:"none"} },
        fadeIn:    { from:{opacity:"0"}, to:{opacity:"1"} },
        scaleIn:   { from:{opacity:"0",transform:"scale(0.95)"}, to:{opacity:"1",transform:"none"} },
        slideRight:{ from:{opacity:"0",transform:"translateX(-12px)"}, to:{opacity:"1",transform:"none"} },
        pulseSoft: { "0%,100%":{opacity:"0.6"}, "50%":{opacity:"1"} },
        orbFloat1: { "0%,100%":{transform:"translate(0,0) scale(1)"}, "33%":{transform:"translate(40px,-30px) scale(1.1)"}, "66%":{transform:"translate(-20px,20px) scale(0.95)"} },
        orbFloat2: { "0%,100%":{transform:"translate(0,0) scale(1)"}, "33%":{transform:"translate(-50px,30px) scale(1.05)"}, "66%":{transform:"translate(30px,-20px) scale(0.98)"} },
      },
    },
  },
  plugins: [],
};
