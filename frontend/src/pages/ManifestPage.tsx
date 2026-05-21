import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FLOOR_PLAN } from "../lib/floorplan-data";
import { useEmergencyStore } from "../store/emergency";
import type { RoomData, RoomStatus } from "../types";
import { THREAT_LABELS } from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey = "floor" | "room" | "status" | "threatLevel";
type FloorFilter = "all" | "1" | "2" | "3";
type StatusFilter = "all" | "critical" | "warning" | "safe";

interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  level: "info" | "warn" | "error" | "success";
}

interface ManifestRow {
  room: RoomData;
  status: RoomStatus;
  route: { path: string[]; instruction: string } | null;
  isOccupied: boolean;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ORDER: Record<RoomStatus, number> = {
  "primary-threat": 0,
  "secondary-threat": 1,
  evacuating: 2,
  safe: 3,
};

const STATUS_LABEL: Record<RoomStatus, string> = {
  "primary-threat": "CRITICAL",
  "secondary-threat": "WARNING",
  evacuating: "EVACUATING",
  safe: "SAFE",
};

function statusToFilterKey(s: RoomStatus): StatusFilter {
  if (s === "primary-threat") return "critical";
  if (s === "secondary-threat") return "warning";
  return "safe";
}

function formatPath(path: string[]): string {
  if (path.length === 0) return "—";
  if (path.length <= 3) return path.join(" → ");
  return `${path[0]} → … → ${path[path.length - 1]}`;
}

function formatTimeSince(ts: bigint): string {
  // timestamp stored as BigInt(Date.now()) — milliseconds since epoch
  const ms = Date.now() - Number(ts);
  if (ms < 2000) return "LIVE";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─── Log seeding ──────────────────────────────────────────────────────────────

function buildInitialLog(
  threatActive: boolean,
  routeCount: number,
  ttsCount: number,
): LogEntry[] {
  const now = Date.now();
  const entries: LogEntry[] = [
    {
      id: 1,
      timestamp: new Date(now - 120_000),
      message: "System initialized — GuardianPulse Emergency Platform v2.4",
      level: "info",
    },
    {
      id: 2,
      timestamp: new Date(now - 115_000),
      message: "Floor plan loaded — 3 floors, 24 rooms, 7 active cameras",
      level: "info",
    },
    {
      id: 3,
      timestamp: new Date(now - 110_000),
      message:
        "Gemini acoustic classifier ready (model: gemini-1.5-flash-latest)",
      level: "info",
    },
  ];
  if (threatActive) {
    entries.push({
      id: 4,
      timestamp: new Date(now - 90_000),
      message: "THREAT DETECTED: FIRE — confidence 94% — camera 3B (Room 305)",
      level: "error",
    });
    entries.push({
      id: 5,
      timestamp: new Date(now - 88_000),
      message: "Heat map updated — Room 305 PRIMARY, adjacent rooms SECONDARY",
      level: "warn",
    });
  }
  if (routeCount > 0) {
    entries.push({
      id: 6,
      timestamp: new Date(now - 75_000),
      message: `A* routing engine — escape routes computed for ${routeCount} occupied rooms`,
      level: "info",
    });
  }
  if (ttsCount > 0) {
    entries.push({
      id: 7,
      timestamp: new Date(now - 60_000),
      message: `Gemini NLG — personalised evacuation instructions generated (${ttsCount} rooms)`,
      level: "info",
    });
    entries.push({
      id: 8,
      timestamp: new Date(now - 55_000),
      message:
        "Google Cloud TTS — SSML guidance audio synthesised (rate:0.8 pitch:-4)",
      level: "success",
    });
  }
  entries.push({
    id: 9,
    timestamp: new Date(now - 10_000),
    message: "Rescue manifest ready — all systems operational",
    level: "success",
  });
  return entries;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: number | string;
  accent?: "red" | "amber" | "green" | "blue";
  sub?: string;
}) {
  const borderMap = {
    red: "border-l-destructive",
    amber: "border-l-secondary",
    green: "border-l-chart-3",
    blue: "border-l-chart-2",
  };
  const valMap = {
    red: "text-destructive",
    amber: "text-secondary",
    green: "text-chart-3",
    blue: "text-chart-2",
  };

  return (
    <div
      className={`bg-card border border-border border-l-4 ${accent ? borderMap[accent] : "border-l-border"} rounded-sm p-4 flex flex-col gap-1`}
    >
      <span
        className={`text-3xl font-display font-bold tabular-nums ${accent ? valMap[accent] : "text-foreground"}`}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
        {label}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function StatusDot({ status }: { status: RoomStatus }) {
  const cls =
    status === "primary-threat"
      ? "bg-destructive alert-pulse"
      : status === "secondary-threat"
        ? "bg-secondary"
        : status === "evacuating"
          ? "bg-chart-3"
          : "bg-muted-foreground/40";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 ${cls}`}
    />
  );
}

function RowBg(status: RoomStatus): string {
  if (status === "primary-threat")
    return "bg-destructive/10 border-destructive/30";
  if (status === "secondary-threat")
    return "bg-secondary/10 border-secondary/30";
  if (status === "evacuating") return "bg-chart-3/10 border-chart-3/30";
  return "bg-card border-border/50";
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ManifestPage() {
  const { currentThreat, roomStatuses, evacuationRoutes, occupiedRooms } =
    useEmergencyStore();

  const [sortKey, setSortKey] = useState<SortKey>("floor");
  const [floorFilter, setFloorFilter] = useState<FloorFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const logRef = useRef<HTMLDivElement>(null);

  const threatActive = !!currentThreat && currentThreat.threatType !== "none";

  // Seed log with lazy initializer — runs once, uses store snapshot at render time
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => {
    const routes = evacuationRoutes.length;
    const tts = evacuationRoutes.filter((r) => r.instruction).length;
    return buildInitialLog(threatActive, routes, tts);
  });

  // Auto-scroll log (run after every render — no dependency needed)
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  });

  // Add a live log entry when threat changes after mount
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }
    if (threatActive && currentThreat) {
      const entry: LogEntry = {
        id: Date.now(),
        timestamp: new Date(),
        message: `THREAT UPDATED: ${THREAT_LABELS[currentThreat.threatType]} — severity ${currentThreat.severity.toUpperCase()} — confidence ${Math.round(currentThreat.confidence)}%`,
        level: "error",
      };
      setLogEntries((prev) => [...prev, entry]);
    }
  }, [currentThreat, threatActive]);

  // Build rows
  const allRows = useMemo<ManifestRow[]>(() => {
    return FLOOR_PLAN.filter((r) => !r.isCorridor).map((room) => {
      const status: RoomStatus = roomStatuses[room.id] ?? "safe";
      const route = evacuationRoutes.find((r) => r.roomId === room.id) ?? null;
      return {
        room,
        status,
        route: route
          ? { path: route.path, instruction: route.instruction }
          : null,
        isOccupied: occupiedRooms.includes(room.id),
      };
    });
  }, [roomStatuses, evacuationRoutes, occupiedRooms]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (floorFilter !== "all" && r.room.floor !== Number(floorFilter))
        return false;
      if (
        statusFilter !== "all" &&
        statusToFilterKey(r.status) !== statusFilter
      )
        return false;
      return true;
    });
  }, [allRows, floorFilter, statusFilter]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortKey === "floor")
        return (
          a.room.floor - b.room.floor || a.room.id.localeCompare(b.room.id)
        );
      if (sortKey === "room") return a.room.id.localeCompare(b.room.id);
      if (sortKey === "status")
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (sortKey === "threatLevel")
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return 0;
    });
  }, [filteredRows, sortKey]);

  // Summary stats
  const totalRooms = allRows.length;
  const dangerRooms = allRows.filter(
    (r) => r.status === "primary-threat" || r.status === "secondary-threat",
  ).length;
  const pathCount = evacuationRoutes.length;
  const accountedFor = allRows.filter(
    (r) => r.isOccupied && r.route?.instruction,
  ).length;

  // Filter counts
  const floorCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allRows.length,
      "1": 0,
      "2": 0,
      "3": 0,
    };
    for (const r of allRows) {
      counts[String(r.room.floor)] = (counts[String(r.room.floor)] ?? 0) + 1;
    }
    return counts;
  }, [allRows]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allRows.length,
      critical: 0,
      warning: 0,
      safe: 0,
    };
    for (const r of allRows) {
      const key = statusToFilterKey(r.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [allRows]);

  // Export
  const handleExport = useCallback(() => {
    const manifest = {
      generated: new Date().toISOString(),
      threat: currentThreat,
      summary: { totalRooms, dangerRooms, pathCount, accountedFor },
      rooms: sortedRows.map((r) => ({
        floor: r.room.floor,
        roomId: r.room.id,
        name: r.room.name,
        cameraId: r.room.cameraId || null,
        status: STATUS_LABEL[r.status],
        occupied: r.isOccupied,
        evacuationPath: r.route?.path ?? [],
        instruction: r.route?.instruction ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rescue-manifest-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setLogEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        timestamp: new Date(),
        message: `Manifest exported — ${sortedRows.length} rooms, ${dangerRooms} in danger`,
        level: "success",
      },
    ]);
  }, [
    currentThreat,
    sortedRows,
    totalRooms,
    dangerRooms,
    pathCount,
    accountedFor,
  ]);

  const timeSince = currentThreat
    ? formatTimeSince(currentThreat.timestamp)
    : null;

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSortKey(k)}
      className={`text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-sm transition-smooth ${
        sortKey === k
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
      data-ocid={`manifest.sort.${k}`}
    >
      {label}
    </button>
  );

  const FilterBtn = ({
    filter,
    value,
    label,
    count,
    ocid,
  }: {
    filter: "floor" | "status";
    value: string;
    label: string;
    count: number;
    ocid: string;
  }) => {
    const active =
      filter === "floor" ? floorFilter === value : statusFilter === value;
    return (
      <button
        type="button"
        onClick={() => {
          if (filter === "floor") setFloorFilter(value as FloorFilter);
          else setStatusFilter(value as StatusFilter);
        }}
        className={`flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-smooth ${
          active
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        }`}
        data-ocid={ocid}
      >
        {label}
        <span
          className={`text-[10px] px-1 rounded-full ${active ? "bg-primary-foreground/20" : "bg-muted"}`}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div
      className="flex-1 flex flex-col bg-background min-h-0"
      data-ocid="manifest.page"
    >
      {/* ── Threat Banner ───────────────────────────────────────────────── */}
      {threatActive && currentThreat ? (
        <div
          className="bg-destructive text-destructive-foreground alert-pulse px-6 py-3 flex items-center justify-between gap-4"
          data-ocid="manifest.threat_banner"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">⚠</span>
            <span className="font-display font-bold tracking-widest uppercase text-sm">
              EMERGENCY ACTIVE — {THREAT_LABELS[currentThreat.threatType]} —
              Severity: {currentThreat.severity.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono opacity-90">
            <span>CONFIDENCE: {Math.round(currentThreat.confidence)}%</span>
            {timeSince && <span>DETECTED: {timeSince}</span>}
          </div>
        </div>
      ) : (
        <div
          className="bg-chart-3/20 border-b border-chart-3/40 text-chart-3 px-6 py-2.5 flex items-center gap-2"
          data-ocid="manifest.all_clear_banner"
        >
          <span className="text-sm font-mono font-bold tracking-widest uppercase">
            ✓ ALL CLEAR — No active threats detected
          </span>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 p-6 overflow-auto">
        {/* ── Header row ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-display font-bold tracking-wider uppercase text-foreground">
              Rescue Manifest
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              SAFEROUTE OPERATIONS CENTER · LIVE STATUS ·{" "}
              {new Date().toLocaleTimeString([], { hour12: false })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="font-mono text-xs uppercase tracking-wider gap-2"
            data-ocid="manifest.export_button"
          >
            ↓ Export Manifest
          </Button>
        </div>

        {/* ── Summary cards ────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          data-ocid="manifest.summary_cards"
        >
          <SummaryCard label="Total Rooms" value={totalRooms} accent="blue" />
          <SummaryCard
            label="Rooms in Danger"
            value={dangerRooms}
            accent={dangerRooms > 0 ? "red" : "green"}
            sub={dangerRooms > 0 ? "Immediate action required" : "All clear"}
          />
          <SummaryCard
            label="Evacuation Paths"
            value={pathCount}
            accent={pathCount > 0 ? "amber" : "blue"}
            sub={pathCount > 0 ? "A* routes computed" : "Pending detection"}
          />
          <SummaryCard
            label="Persons Accounted"
            value={accountedFor}
            accent={accountedFor > 0 ? "green" : "blue"}
            sub={`of ${occupiedRooms.length} occupied rooms`}
          />
        </div>

        {/* ── Filters + Sort ───────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
          <div
            className="flex items-center gap-1.5"
            data-ocid="manifest.floor_filter"
          >
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider mr-1">
              Floor:
            </span>
            {(["all", "1", "2", "3"] as FloorFilter[]).map((v) => (
              <FilterBtn
                key={v}
                filter="floor"
                value={v}
                label={v === "all" ? "All" : `F${v}`}
                count={floorCounts[v] ?? 0}
                ocid={`manifest.filter.floor.${v}`}
              />
            ))}
          </div>
          <div
            className="flex items-center gap-1.5"
            data-ocid="manifest.status_filter"
          >
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider mr-1">
              Status:
            </span>
            {(["all", "critical", "warning", "safe"] as StatusFilter[]).map(
              (v) => (
                <FilterBtn
                  key={v}
                  filter="status"
                  value={v}
                  label={v === "all" ? "All" : v}
                  count={statusCounts[v] ?? 0}
                  ocid={`manifest.filter.status.${v}`}
                />
              ),
            )}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider mr-1">
              Sort:
            </span>
            <SortBtn k="floor" label="Floor" />
            <SortBtn k="room" label="Room" />
            <SortBtn k="status" label="Status" />
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div
          className="border border-border rounded-sm overflow-auto"
          data-ocid="manifest.table"
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border sticky top-0">
                {[
                  "Floor",
                  "Room",
                  "Camera",
                  "Status",
                  "Threat Level",
                  "Evacuation Path",
                  "Instruction",
                  "Signal",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-mono uppercase tracking-widest text-muted-foreground text-[10px] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => (
                <tr
                  key={r.room.id}
                  className={`border-b last:border-0 border-border/40 ${RowBg(r.status)} transition-smooth`}
                  data-ocid={`manifest.row.item.${i + 1}`}
                >
                  {/* Floor */}
                  <td className="px-3 py-2 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                    F{r.room.floor}
                  </td>
                  {/* Room */}
                  <td className="px-3 py-2 font-display font-semibold whitespace-nowrap">
                    {r.room.name}
                    {r.isOccupied && (
                      <span className="ml-1.5 text-[9px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded-sm">
                        OCC
                      </span>
                    )}
                  </td>
                  {/* Camera */}
                  <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                    {r.room.cameraId || "—"}
                  </td>
                  {/* Status */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="flex items-center">
                      <StatusDot status={r.status} />
                      <span
                        className={`font-mono uppercase tracking-wider text-[10px] font-bold ${
                          r.status === "primary-threat"
                            ? "text-destructive"
                            : r.status === "secondary-threat"
                              ? "text-secondary"
                              : r.status === "evacuating"
                                ? "text-chart-3"
                                : "text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </span>
                  </td>
                  {/* Threat level */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.status === "primary-threat" ? (
                      <Badge className="status-critical emergency-badge text-[9px]">
                        HIGH
                      </Badge>
                    ) : r.status === "secondary-threat" ? (
                      <Badge className="status-warning emergency-badge text-[9px]">
                        MED
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        —
                      </span>
                    )}
                  </td>
                  {/* Path */}
                  <td className="px-3 py-2 font-mono text-muted-foreground max-w-[180px]">
                    {r.route ? (
                      <span
                        title={r.route.path.join(" → ")}
                        className="cursor-help"
                      >
                        {formatPath(r.route.path)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {/* Instruction */}
                  <td className="px-3 py-2 max-w-[220px]">
                    {r.route?.instruction ? (
                      <span
                        title={r.route.instruction}
                        className="cursor-help text-foreground/80 line-clamp-1 block"
                      >
                        {r.route.instruction}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        Pending
                      </span>
                    )}
                  </td>
                  {/* Signal */}
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-muted-foreground">
                    {r.status !== "safe" && currentThreat ? (
                      <span className="text-chart-3 font-bold">LIVE</span>
                    ) : (
                      <span className="text-muted-foreground/60 text-[10px]">
                        {new Date().toLocaleTimeString([], { hour12: false })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedRows.length === 0 && (
            <div
              className="py-12 text-center text-muted-foreground font-mono text-xs"
              data-ocid="manifest.table.empty_state"
            >
              No rooms match current filters
            </div>
          )}
        </div>

        {/* ── Operations Log ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-2" data-ocid="manifest.ops_log">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Operations Log
            </span>
            <span className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {logEntries.length} entries
            </span>
          </div>
          <div
            ref={logRef}
            className="bg-card border border-border rounded-sm h-40 overflow-y-auto p-3 flex flex-col gap-0.5 font-mono text-[11px]"
          >
            {logEntries.map((entry) => (
              <div
                key={entry.id}
                className={`flex gap-3 leading-5 ${
                  entry.level === "error"
                    ? "text-destructive"
                    : entry.level === "warn"
                      ? "text-secondary"
                      : entry.level === "success"
                        ? "text-chart-3"
                        : "text-muted-foreground"
                }`}
              >
                <span className="text-muted-foreground/50 tabular-nums flex-shrink-0">
                  {entry.timestamp.toLocaleTimeString([], { hour12: false })}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider flex-shrink-0 w-14 ${
                    entry.level === "error"
                      ? "text-destructive"
                      : entry.level === "warn"
                        ? "text-secondary"
                        : entry.level === "success"
                          ? "text-chart-3"
                          : "text-muted-foreground/60"
                  }`}
                >
                  [{entry.level.toUpperCase()}]
                </span>
                <span className="break-words">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
