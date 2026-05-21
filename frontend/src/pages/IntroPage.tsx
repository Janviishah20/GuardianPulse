import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Map as MapIcon,
  MessageSquare,
  Mic,
  Navigation,
  SkipForward,
} from "lucide-react";
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "guardianpulse_intro_seen";

const steps = [
  {
    icon: Mic,
    title: "Acoustic Classification",
    subtitle: "Step 1 of 5",
    description:
      "A CCTV camera captures live voice and motion — GuardianPulse streams audio to Gemini AI every 5 seconds to instantly identify threat type, confidence level, and severity in real time.",
    color: "oklch(0.55 0.22 25)",
    glow: "shadow-[0_0_60px_oklch(0.55_0.22_25/0.35)]",
    bg: "from-[oklch(0.55_0.22_25/0.08)] to-transparent",
    badge:
      "bg-[oklch(0.55_0.22_25/0.15)] text-[oklch(0.75_0.18_25)] border-[oklch(0.55_0.22_25/0.3)]",
  },
  {
    icon: MapIcon,
    title: "Floor Plan Heatmap",
    subtitle: "Step 2 of 5",
    description:
      "Threat data is mapped onto a live SVG floor plan. Rooms turn red for direct danger, orange for adjacent risk — showing exactly where the threat is spreading.",
    color: "oklch(0.72 0.18 75)",
    glow: "shadow-[0_0_60px_oklch(0.72_0.18_75/0.35)]",
    bg: "from-[oklch(0.72_0.18_75/0.08)] to-transparent",
    badge:
      "bg-[oklch(0.72_0.18_75/0.15)] text-[oklch(0.85_0.15_75)] border-[oklch(0.72_0.18_75/0.3)]",
  },
  {
    icon: Navigation,
    title: "Escape Routing",
    subtitle: "Step 3 of 5",
    description:
      "An A* pathfinding algorithm computes the safest escape path for every occupied room, automatically routing around blocked and dangerous zones.",
    color: "oklch(0.65 0.18 145)",
    glow: "shadow-[0_0_60px_oklch(0.65_0.18_145/0.35)]",
    bg: "from-[oklch(0.65_0.18_145/0.08)] to-transparent",
    badge:
      "bg-[oklch(0.65_0.18_145/0.15)] text-[oklch(0.80_0.15_145)] border-[oklch(0.65_0.18_145/0.3)]",
  },
  {
    icon: MessageSquare,
    title: "Evacuation Instructions",
    subtitle: "Step 4 of 5",
    description:
      "Gemini generates calm, room-specific guidance — then Google TTS synthesizes it into a soothing voice broadcast to guide occupants to safety.",
    color: "oklch(0.62 0.18 230)",
    glow: "shadow-[0_0_60px_oklch(0.62_0.18_230/0.35)]",
    bg: "from-[oklch(0.62_0.18_230/0.08)] to-transparent",
    badge:
      "bg-[oklch(0.62_0.18_230/0.15)] text-[oklch(0.78_0.15_230)] border-[oklch(0.62_0.18_230/0.3)]",
  },
  {
    icon: ClipboardList,
    title: "Rescue Manifest",
    subtitle: "Step 5 of 5",
    description:
      "A live dashboard shows every room's occupancy, threat level, and last signal time — giving responders a complete situational overview at a glance.",
    color: "oklch(0.58 0.2 310)",
    glow: "shadow-[0_0_60px_oklch(0.58_0.2_310/0.35)]",
    bg: "from-[oklch(0.58_0.2_310/0.08)] to-transparent",
    badge:
      "bg-[oklch(0.58_0.2_310/0.15)] text-[oklch(0.78_0.18_310)] border-[oklch(0.58_0.2_310/0.3)]",
  },
] as const;

export function IntroPage() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const navigate = useNavigate();

  const enter = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    navigate({ to: "/" });
  };

  const goTo = (idx: number, dir: "next" | "prev") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 300);
  };

  const next = () => {
    if (current < steps.length - 1) goTo(current + 1, "next");
    else enter();
  };

  const prev = () => {
    if (current > 0) goTo(current - 1, "prev");
  };

  // keyboard navigation — stable refs avoid stale closure without re-registering on every render
  const currentRef = React.useRef(current);
  const animatingRef = React.useRef(animating);
  currentRef.current = current;
  animatingRef.current = animating;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = currentRef.current;
      const anim = animatingRef.current;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (anim) return;
        if (cur < steps.length - 1) {
          setDirection("next");
          setAnimating(true);
          setTimeout(() => {
            setCurrent(cur + 1);
            setAnimating(false);
          }, 300);
        } else {
          localStorage.setItem(STORAGE_KEY, "1");
          navigate({ to: "/" });
        }
      }
      if (e.key === "ArrowLeft") {
        if (anim || cur === 0) return;
        setDirection("prev");
        setAnimating(true);
        setTimeout(() => {
          setCurrent(cur - 1);
          setAnimating(false);
        }, 300);
      }
      if (e.key === "Escape") {
        localStorage.setItem(STORAGE_KEY, "1");
        navigate({ to: "/" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const step = steps[current];
  const Icon = step.icon;
  const isLast = current === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden"
      data-ocid="intro.page"
    >
      {/* Ambient background gradient */}
      <div
        className={`absolute inset-0 bg-gradient-radial ${step.bg} pointer-events-none transition-all duration-700`}
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${step.color.replace(")", "/0.07)")} 0%, transparent 70%)`,
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.94 0.01 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.94 0.01 260) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-mono tracking-widest uppercase text-muted-foreground/60"
            style={{ letterSpacing: "0.2em" }}
          >
            GuardianPulse
          </span>
        </div>
        <button
          type="button"
          onClick={enter}
          data-ocid="intro.skip_button"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group"
          aria-label="Skip intro tour"
        >
          <SkipForward className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
          Skip tour
        </button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Step content card */}
        <div
          className={`w-full max-w-2xl flex flex-col items-center text-center transition-all duration-300 ${
            animating
              ? direction === "next"
                ? "opacity-0 translate-y-4"
                : "opacity-0 -translate-y-4"
              : "opacity-100 translate-y-0"
          }`}
          data-ocid="intro.step_card"
        >
          {/* Step badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono tracking-widest uppercase mb-8 ${step.badge}`}
            data-ocid="intro.step_badge"
          >
            {step.subtitle}
          </div>

          {/* Icon ring */}
          <div className="relative mb-10">
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-110"
              style={{ background: step.color }}
            />
            {/* Pulsing ring */}
            <div
              className="absolute inset-0 rounded-full border-2 opacity-20 scale-125 alert-pulse"
              style={{ borderColor: step.color }}
            />
            {/* Main icon container */}
            <div
              className={`relative w-32 h-32 rounded-full flex items-center justify-center ${step.glow} border border-border/30`}
              style={{ background: `${step.color.replace(")", "/0.12)")}` }}
            >
              <Icon
                className="w-14 h-14"
                style={{ color: step.color }}
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4 leading-tight">
            {step.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="relative z-10 flex items-center gap-6 mt-14">
          {/* Prev */}
          <button
            type="button"
            onClick={prev}
            disabled={current === 0}
            data-ocid="intro.prev_button"
            className="w-11 h-11 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-smooth disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Previous step"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Step dots */}
          <div
            className="flex items-center gap-2"
            role="tablist"
            aria-label="Tour steps"
            data-ocid="intro.step_dots"
          >
            {steps.map((s, i) => (
              <button
                type="button"
                key={s.title}
                role="tab"
                aria-selected={i === current}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                onClick={() => goTo(i, i > current ? "next" : "prev")}
                data-ocid={`intro.dot.${i + 1}`}
                className="relative rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                style={{
                  width: i === current ? 28 : 8,
                  height: 8,
                  background:
                    i === current ? step.color : "oklch(0.30 0.01 260)",
                }}
              />
            ))}
          </div>

          {/* Next / Enter */}
          <button
            type="button"
            onClick={next}
            data-ocid={isLast ? "intro.enter_button" : "intro.next_button"}
            className="w-11 h-11 rounded-full flex items-center justify-center font-semibold transition-smooth border border-transparent text-foreground"
            style={{ background: step.color }}
            aria-label={isLast ? "Enter app" : "Next step"}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Enter App CTA (last step only) */}
        {isLast && (
          <button
            type="button"
            onClick={enter}
            data-ocid="intro.launch_button"
            className="mt-8 px-8 py-3 rounded-sm font-display font-bold text-sm tracking-wider uppercase transition-smooth border"
            style={{
              background: `${step.color.replace(")", "/0.12)")}`,
              borderColor: `${step.color.replace(")", "/0.4)")}`,
              color: step.color,
            }}
          >
            Launch GuardianPulse →
          </button>
        )}
      </main>

      {/* Bottom keyboard hint */}
      <footer className="relative z-10 pb-5 flex justify-center">
        <span className="text-xs text-muted-foreground/40 font-mono tracking-widest">
          ← → Arrow keys to navigate · Esc to skip
        </span>
      </footer>
    </div>
  );
}
