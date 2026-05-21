import type { ThreatResult } from "../types";

interface ThreatBadgeProps {
  threat: ThreatResult | null;
  size?: "sm" | "md" | "lg";
  showConfidence?: boolean;
}

const THREAT_CONFIG: Record<
  ThreatResult["threatType"],
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  fire: {
    label: "FIRE DETECTED",
    bg: "bg-destructive/20",
    text: "text-destructive",
    border: "border-destructive",
    dot: "bg-destructive",
  },
  gas: {
    label: "GAS LEAK",
    bg: "bg-secondary/20",
    text: "text-secondary",
    border: "border-secondary",
    dot: "bg-secondary",
  },
  structural: {
    label: "STRUCTURAL ALERT",
    bg: "bg-secondary/20",
    text: "text-secondary",
    border: "border-secondary",
    dot: "bg-secondary",
  },
  none: {
    label: "ALL CLEAR",
    bg: "bg-chart-3/20",
    text: "text-chart-3",
    border: "border-chart-3",
    dot: "bg-chart-3",
  },
};

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-sm px-3 py-1 gap-2",
  lg: "text-base px-4 py-1.5 gap-2",
};

const DOT_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
};

export function ThreatBadge({
  threat,
  size = "md",
  showConfidence = false,
}: ThreatBadgeProps) {
  const type = threat?.threatType ?? "none";
  const cfg = THREAT_CONFIG[type];
  const isActive = type !== "none";

  return (
    <span
      data-ocid="threat.badge"
      className={[
        "inline-flex items-center font-display font-bold tracking-widest uppercase border rounded-sm",
        cfg.bg,
        cfg.text,
        cfg.border,
        SIZE[size],
        isActive ? "alert-pulse" : "",
      ].join(" ")}
    >
      <span
        className={`rounded-full flex-shrink-0 ${DOT_SIZE[size]} ${cfg.dot} ${isActive ? "alert-pulse" : ""}`}
      />
      <span>{cfg.label}</span>
      {showConfidence && threat && threat.confidence > 0 && (
        <span className="opacity-70 font-mono ml-1">{threat.confidence}%</span>
      )}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: ThreatResult["severity"];
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const map: Record<ThreatResult["severity"], string> = {
    low: "bg-chart-3/20 text-chart-3 border-chart-3",
    medium: "bg-secondary/20 text-secondary border-secondary",
    high: "bg-destructive/20 text-destructive border-destructive",
  };
  return (
    <span
      data-ocid="threat.severity_badge"
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold tracking-widest uppercase border rounded-sm font-mono ${map[severity]}`}
    >
      {severity.toUpperCase()}
    </span>
  );
}
