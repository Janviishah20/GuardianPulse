import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, ShieldAlert, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CAMERA_TO_ROOM,
  ROOM_MAP,
  getRoomsByFloor,
} from "../lib/floorplan-data";
import { useEmergencyStore } from "../store/emergency";
import type { RoomData, RoomStatus } from "../types";

// ─── Layout constants ──────────────────────────────────────────────────────────
const ROOM_W = 90;
const ROOM_H = 68;
const GAP = 8;
const CORRIDOR_H = 28;
const STAIR_W = 52;
const PAD_X = 24;
const PAD_Y = 24;
const NUM_ROOMS = 8;

const SVG_W =
  PAD_X * 2 +
  NUM_ROOMS * ROOM_W +
  (NUM_ROOMS - 1) * GAP +
  STAIR_W * 2 +
  GAP * 2;
const SVG_H = PAD_Y * 2 + ROOM_H + CORRIDOR_H + ROOM_H;

function roomX(idx: number) {
  return PAD_X + STAIR_W + GAP + idx * (ROOM_W + GAP);
}
const ROOM_TOP_Y = PAD_Y;
const CORRIDOR_Y = PAD_Y + ROOM_H;
const EXIT_LABEL_Y = CORRIDOR_Y + CORRIDOR_H + 4;

// ─── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_FILLS: Record<RoomStatus, string> = {
  safe: "oklch(0.14 0.02 260)",
  "primary-threat": "oklch(0.45 0.22 25)",
  "secondary-threat": "oklch(0.55 0.18 55)",
  evacuating: "oklch(0.14 0.02 260)",
};
const STATUS_STROKES: Record<RoomStatus, string> = {
  safe: "oklch(0.30 0.01 260)",
  "primary-threat": "oklch(0.70 0.25 25)",
  "secondary-threat": "oklch(0.82 0.22 70)",
  evacuating: "oklch(0.65 0.18 145)",
};
const STATUS_TEXT: Record<RoomStatus, string> = {
  safe: "oklch(0.70 0.01 260)",
  "primary-threat": "oklch(0.97 0 0)",
  "secondary-threat": "oklch(0.12 0.01 260)",
  evacuating: "oklch(0.90 0.01 260)",
};

// ─── Path helper ──────────────────────────────────────────────────────────────
function getRoomCentre(
  id: string,
  floor: number,
): { x: number; y: number } | null {
  const rooms = getRoomsByFloor(floor).filter((r) => !r.isCorridor);
  const idx = rooms.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  return { x: roomX(idx) + ROOM_W / 2, y: ROOM_TOP_Y + ROOM_H / 2 };
}

// ─── Person silhouette ────────────────────────────────────────────────────────
function PersonIcon({
  cx,
  cy,
  scale = 1,
  color = "oklch(0.94 0.01 260)",
}: {
  cx: number;
  cy: number;
  scale?: number;
  color?: string;
}) {
  const hr = 2.6 * scale;
  const bw = 5.8 * scale;
  const bh = 5.2 * scale;
  const neck = 1.6 * scale;
  const headY = cy - bh * 0.52 - hr;
  const bodyTop = cy - bh * 0.5;
  const bodyBot = cy + bh * 0.5;
  return (
    <g>
      <circle cx={cx} cy={headY} r={hr} fill={color} />
      <path
        d={`M ${cx - neck} ${bodyTop} Q ${cx - bw / 2} ${bodyTop} ${cx - bw / 2} ${bodyTop + bh * 0.35} L ${cx - bw * 0.38} ${bodyBot} Q ${cx} ${bodyBot + 1 * scale} ${cx + bw * 0.38} ${bodyBot} L ${cx + bw / 2} ${bodyTop + bh * 0.35} Q ${cx + bw / 2} ${bodyTop} ${cx + neck} ${bodyTop} Z`}
        fill={color}
      />
    </g>
  );
}

// ─── Occupancy icons ──────────────────────────────────────────────────────────
function OccupancyIcons({
  x,
  y,
  count,
}: {
  x: number;
  y: number;
  count: number;
}) {
  const iconColor = "oklch(0.94 0.01 260)";
  const badgeBg = "oklch(0.97 0 0)";
  const badgeText = "oklch(0.10 0.01 260)";
  const ax = x + ROOM_W - 8;
  const ay = y + 14;

  if (count === 1) {
    return <PersonIcon cx={ax} cy={ay} scale={0.85} color={iconColor} />;
  }
  if (count === 2) {
    return (
      <g>
        <PersonIcon cx={ax - 5} cy={ay} scale={0.75} color={iconColor} />
        <PersonIcon cx={ax + 5} cy={ay} scale={0.75} color={iconColor} />
      </g>
    );
  }
  return (
    <g>
      <PersonIcon cx={ax - 5} cy={ay} scale={0.75} color={iconColor} />
      <PersonIcon cx={ax + 5} cy={ay} scale={0.75} color={iconColor} />
      <circle cx={ax + 5} cy={ay - 10} r={5} fill={badgeBg} />
      <text
        x={ax + 5}
        y={ay - 10 + 3.5}
        textAnchor="middle"
        fontSize={6}
        fontWeight="700"
        fill={badgeText}
        fontFamily="var(--font-mono)"
      >
        {count}
      </text>
    </g>
  );
}

// ─── Smoke particles overlay for primary-threat rooms ─────────────────────────
function SmokeParticles({ x, y }: { x: number; y: number }) {
  // Three smoke blobs with staggered animation via CSS classes
  return (
    <g style={{ pointerEvents: "none" }}>
      <ellipse
        cx={x + ROOM_W * 0.35}
        cy={y + ROOM_H * 0.55}
        rx={10}
        ry={7}
        fill="oklch(0.55 0.005 260 / 0.5)"
        className="smoke-particle"
      />
      <ellipse
        cx={x + ROOM_W * 0.55}
        cy={y + ROOM_H * 0.65}
        rx={8}
        ry={5}
        fill="oklch(0.50 0.005 260 / 0.45)"
        className="smoke-particle-2"
      />
      <ellipse
        cx={x + ROOM_W * 0.45}
        cy={y + ROOM_H * 0.6}
        rx={6}
        ry={4}
        fill="oklch(0.48 0.005 260 / 0.4)"
        className="smoke-particle-3"
      />
    </g>
  );
}

// ─── SVG Room ─────────────────────────────────────────────────────────────────
function SvgRoom({
  room,
  idx,
  status,
  occupantCount,
  onClick,
}: {
  room: RoomData;
  idx: number;
  status: RoomStatus;
  occupantCount: number;
  onClick: () => void;
}) {
  const x = roomX(idx);
  const y = ROOM_TOP_Y;
  const fill = STATUS_FILLS[status];
  const stroke = STATUS_STROKES[status];
  const textCol = STATUS_TEXT[status];
  const strokeW =
    status === "evacuating" || status === "primary-threat" ? 2 : 1;

  return (
    <g key={room.id} data-ocid={`floorplan.room.${room.id}`}>
      {/* Enhanced CSS-animated glow ring for primary-threat */}
      {status === "primary-threat" && (
        <>
          {/* Outer glow halo */}
          <rect
            x={x - 6}
            y={y - 6}
            width={ROOM_W + 12}
            height={ROOM_H + 12}
            rx={4}
            fill="none"
            stroke="oklch(0.65 0.28 25)"
            strokeWidth={4}
            className="fire-pulse-ring"
          />
          {/* Inner sharper ring */}
          <rect
            x={x - 3}
            y={y - 3}
            width={ROOM_W + 6}
            height={ROOM_H + 6}
            rx={3}
            fill="none"
            stroke="oklch(0.75 0.30 20)"
            strokeWidth={2}
            style={{
              animation: "fire-pulse-ring 0.5s ease-in-out 0.15s infinite",
            }}
          />
        </>
      )}

      {/* Room body — flickers for primary-threat */}
      <rect
        x={x}
        y={y}
        width={ROOM_W}
        height={ROOM_H}
        rx={2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
        className={
          status === "primary-threat" ? "fire-fill-flicker" : undefined
        }
      />

      {/* Room number */}
      <text
        x={x + ROOM_W / 2}
        y={y + 20}
        textAnchor="middle"
        fontSize={13}
        fontWeight="700"
        fill={textCol}
        fontFamily="var(--font-mono)"
      >
        {room.id}
      </text>

      {/* Camera ID */}
      {room.cameraId && (
        <text
          x={x + ROOM_W / 2}
          y={y + 34}
          textAnchor="middle"
          fontSize={9}
          fill={textCol}
          opacity={0.7}
          fontFamily="var(--font-mono)"
        >
          CAM {room.cameraId}
        </text>
      )}

      {/* Smoke overlay for primary-threat */}
      {status === "primary-threat" && <SmokeParticles x={x} y={y} />}

      {/* Occupancy */}
      {occupantCount > 0 && (
        <OccupancyIcons x={x} y={y} count={occupantCount} />
      )}

      {/* Threat / warning icons */}
      {status === "primary-threat" && (
        <text x={x + 10} y={y + 14} fontSize={12} fill="oklch(0.97 0 0)">
          🔥
        </text>
      )}
      {status === "secondary-threat" && (
        <text x={x + 10} y={y + 14} fontSize={10} fill="oklch(0.12 0.01 260)">
          ⚠️
        </text>
      )}

      {/* Exit badge */}
      {room.isExit && (
        <>
          <rect
            x={x + 4}
            y={y + ROOM_H - 14}
            width={ROOM_W - 8}
            height={11}
            rx={2}
            fill="oklch(0.65 0.18 145)"
            opacity={0.9}
          />
          <text
            x={x + ROOM_W / 2}
            y={y + ROOM_H - 6}
            textAnchor="middle"
            fontSize={7}
            fontWeight="700"
            fill="oklch(0.97 0 0)"
            fontFamily="var(--font-mono)"
          >
            EXIT
          </text>
        </>
      )}

      {/* Click overlay */}
      <rect
        x={x}
        y={y}
        width={ROOM_W}
        height={ROOM_H}
        rx={2}
        fill="transparent"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        tabIndex={0}
        aria-label={`Toggle occupancy for room ${room.id}`}
        style={{ cursor: "pointer" }}
      />
    </g>
  );
}

// ─── Evacuation path ──────────────────────────────────────────────────────────
function EvacPath({
  path,
  floor,
  dashOffset,
  fast,
}: {
  path: string[];
  floor: number;
  dashOffset: number;
  fast: boolean;
}) {
  const points: string[] = [];
  for (const roomId of path) {
    const room = ROOM_MAP.get(roomId);
    if (!room || room.floor !== floor || room.isCorridor) continue;
    const c = getRoomCentre(roomId, floor);
    if (c) points.push(`${c.x},${c.y}`);
  }
  if (points.length < 2) return null;

  const lastPt = points[points.length - 1].split(",").map(Number);
  const prevPt = points[points.length - 2].split(",").map(Number);
  const angle =
    Math.atan2(lastPt[1] - prevPt[1], lastPt[0] - prevPt[0]) * (180 / Math.PI);

  // Pulsing arrowhead scale during fire drill
  const arrowScale = fast ? 1.4 : 1;

  return (
    <g>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="oklch(0.65 0.18 145)"
        strokeWidth={fast ? 3.5 : 2.5}
        strokeDasharray="8 4"
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={fast ? 1 : 0.9}
      />
      {/* Arrow tip — scales during drill */}
      <polygon
        points={`${-6 * arrowScale},${-4 * arrowScale} 0,0 ${-6 * arrowScale},${4 * arrowScale}`}
        fill="oklch(0.65 0.18 145)"
        transform={`translate(${lastPt[0]},${lastPt[1]}) rotate(${angle})`}
        style={
          fast
            ? { animation: "alert-pulse 0.6s ease-in-out infinite" }
            : undefined
        }
      />
    </g>
  );
}

// ─── Floor SVG ────────────────────────────────────────────────────────────────
function FloorSvg({
  floor,
  roomStatuses,
  occupiedRooms,
  evacuationRoutes,
  isFireDrillActive,
  onRoomClick,
}: {
  floor: number;
  roomStatuses: Record<string, RoomStatus>;
  occupiedRooms: string[];
  evacuationRoutes: { roomId: string; path: string[] }[];
  isFireDrillActive: boolean;
  onRoomClick: (roomId: string) => void;
}) {
  const rooms = getRoomsByFloor(floor).filter((r) => !r.isCorridor);
  const stairLabel =
    floor === 1 ? "STAIR A" : floor === 2 ? "A  ↕  B" : "STAIR B";
  const [dashOffset, setDashOffset] = useState(0);

  // Faster animation speed when fire drill is active
  const speed = isFireDrillActive ? 0.9 : 0.4;

  useEffect(() => {
    let frame: number;
    let offset = 0;
    function tick() {
      offset = (offset + speed) % 24;
      setDashOffset(-offset);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speed]);

  const corridorFill = "oklch(0.18 0.015 260)";
  const corridorStroke = "oklch(0.28 0.01 260)";

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      style={{ maxWidth: SVG_W, display: "block" }}
      aria-label={`Floor ${floor} plan`}
    >
      <title>Floor {floor} Plan</title>

      {/* Corridor */}
      <rect
        x={PAD_X}
        y={CORRIDOR_Y}
        width={SVG_W - PAD_X * 2}
        height={CORRIDOR_H}
        rx={2}
        fill={corridorFill}
        stroke={corridorStroke}
        strokeWidth={1}
      />
      <text
        x={SVG_W / 2}
        y={CORRIDOR_Y + CORRIDOR_H / 2 + 4}
        textAnchor="middle"
        fontSize={8}
        fill="oklch(0.45 0.01 260)"
        fontFamily="var(--font-mono)"
        letterSpacing={2}
      >
        CORRIDOR {floor}
      </text>

      {/* Left stairwell */}
      <rect
        x={PAD_X}
        y={ROOM_TOP_Y}
        width={STAIR_W}
        height={ROOM_H + CORRIDOR_H}
        rx={2}
        fill="oklch(0.15 0.02 260)"
        stroke="oklch(0.30 0.01 260)"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      <text
        x={PAD_X + STAIR_W / 2}
        y={ROOM_TOP_Y + ROOM_H / 2 + 4}
        textAnchor="middle"
        fontSize={7}
        fill="oklch(0.45 0.01 260)"
        fontFamily="var(--font-mono)"
        letterSpacing={1}
      >
        {stairLabel}
      </text>

      {/* Right stairwell */}
      <rect
        x={SVG_W - PAD_X - STAIR_W}
        y={ROOM_TOP_Y}
        width={STAIR_W}
        height={ROOM_H + CORRIDOR_H}
        rx={2}
        fill="oklch(0.15 0.02 260)"
        stroke="oklch(0.30 0.01 260)"
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      <text
        x={SVG_W - PAD_X - STAIR_W / 2}
        y={ROOM_TOP_Y + ROOM_H / 2 + 4}
        textAnchor="middle"
        fontSize={7}
        fill="oklch(0.45 0.01 260)"
        fontFamily="var(--font-mono)"
        letterSpacing={1}
      >
        STAIR
      </text>

      {/* Rooms */}
      {rooms.map((room, idx) => {
        const occupantCount = occupiedRooms.filter((r) => r === room.id).length;
        return (
          <SvgRoom
            key={room.id}
            room={room}
            idx={idx}
            status={roomStatuses[room.id] ?? "safe"}
            occupantCount={occupantCount}
            onClick={() => onRoomClick(room.id)}
          />
        );
      })}

      {/* Evacuation paths */}
      {evacuationRoutes.map((route) => (
        <EvacPath
          key={route.roomId}
          path={route.path}
          floor={floor}
          dashOffset={dashOffset}
          fast={isFireDrillActive}
        />
      ))}

      {/* Floor label */}
      <text
        x={8}
        y={14}
        fontSize={9}
        fill="oklch(0.40 0.01 260)"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        letterSpacing={2}
      >
        FL {floor}
      </text>

      {/* Exit markers (floor 1 only) */}
      {floor === 1 && (
        <>
          <text
            x={roomX(0) + ROOM_W / 2}
            y={EXIT_LABEL_Y + CORRIDOR_H - 4}
            textAnchor="middle"
            fontSize={7}
            fill="oklch(0.65 0.18 145)"
            fontFamily="var(--font-mono)"
          >
            ▼ EXIT A
          </text>
          <text
            x={roomX(NUM_ROOMS - 1) + ROOM_W / 2}
            y={EXIT_LABEL_Y + CORRIDOR_H - 4}
            textAnchor="middle"
            fontSize={7}
            fill="oklch(0.65 0.18 145)"
            fontFamily="var(--font-mono)"
          >
            ▼ EXIT B
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "oklch(0.45 0.22 25)", label: "Primary Threat" },
    { color: "oklch(0.55 0.18 55)", label: "Adjacent Zone" },
    {
      color: "oklch(0.14 0.02 260)",
      label: "Safe",
      border: "oklch(0.65 0.18 145)",
    },
    { color: "oklch(0.65 0.18 145)", label: "Escape Path" },
  ];
  return (
    <div
      className="flex flex-wrap gap-4 items-center"
      data-ocid="floorplan.legend"
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              background: item.color,
              border: item.border
                ? `1.5px solid ${item.border}`
                : "1px solid oklch(0.35 0.01 260)",
            }}
          />
          <span className="text-xs font-mono text-muted-foreground">
            {item.label}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          className="shrink-0 opacity-80"
        >
          <circle cx="7" cy="4" r="2.2" fill="oklch(0.94 0.01 260)" />
          <path
            d="M4.2 7.5 Q4 8 4 9.2 Q4.8 10.5 7 10.5 Q9.2 10.5 10 9.2 Q10 8 9.8 7.5 Q8.5 7 7 7 Q5.5 7 4.2 7.5 Z"
            fill="oklch(0.94 0.01 260)"
          />
        </svg>
        <span className="text-xs font-mono text-muted-foreground">
          Occupied
        </span>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function FloorPlanPage() {
  const [activeFloor, setActiveFloor] = useState(3);

  const {
    roomStatuses,
    occupiedRooms,
    evacuationRoutes,
    currentThreat,
    isFireDrillActive,
    setThreat,
    updateRoomStatuses,
    setOccupied,
  } = useEmergencyStore();

  // Auto-switch to floor 3 when fire drill activates
  useEffect(() => {
    if (isFireDrillActive) setActiveFloor(3);
  }, [isFireDrillActive]);

  // ── Demo scenario ─────────────────────────────────────────────────────────
  function simulateFire() {
    const threat = {
      threatType: "fire" as const,
      confidence: 97,
      severity: "high" as const,
      rawResponse:
        "Fire simulation triggered in Room 302, Floor 3. Smoke and heat detected via Camera 3A.",
      timestamp: BigInt(Date.now()),
    };
    setThreat(threat);
    updateRoomStatuses(threat, CAMERA_TO_ROOM["3A"]);
    setActiveFloor(3);
  }

  function resetScenario() {
    setThreat(null);
    updateRoomStatuses(null);
  }

  // ── Room occupancy toggle ─────────────────────────────────────────────────
  function toggleOccupied(roomId: string) {
    if (occupiedRooms.includes(roomId)) {
      setOccupied(occupiedRooms.filter((r) => r !== roomId));
    } else {
      setOccupied([...occupiedRooms, roomId]);
    }
  }

  const threatActive =
    currentThreat !== null && currentThreat.threatType !== "none";
  const floorRooms = getRoomsByFloor(activeFloor).filter((r) => !r.isCorridor);

  const floorRoutes = evacuationRoutes.filter((route) => {
    const firstRoom = ROOM_MAP.get(route.roomId);
    return firstRoom?.floor === activeFloor;
  });

  return (
    <div
      className="flex flex-col gap-0 min-h-0 flex-1 bg-background"
      data-ocid="floorplan.page"
    >
      {/* ── Header bar ───────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-widest uppercase text-foreground">
            Floor Plan — Heat Map
          </span>
          {threatActive && (
            <Badge
              variant="destructive"
              className="font-mono text-xs animate-pulse"
              data-ocid="floorplan.threat_badge"
            >
              🔥 FIRE — {currentThreat?.confidence}% CONF
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!threatActive ? (
            <Button
              variant="destructive"
              size="sm"
              className="font-mono text-xs tracking-wide"
              onClick={simulateFire}
              data-ocid="floorplan.simulate_button"
            >
              <Flame className="w-3.5 h-3.5 mr-1.5" />
              Simulate Fire in Camera 3B
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs tracking-wide"
              onClick={resetScenario}
              data-ocid="floorplan.reset_button"
            >
              Reset Scenario
            </Button>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 p-6">
        {/* Floor tabs */}
        <div
          className="flex items-center gap-1"
          data-ocid="floorplan.floor_tabs"
        >
          {[1, 2, 3].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFloor(f)}
              data-ocid={`floorplan.floor_tab.${f}`}
              className={[
                "px-4 py-1.5 font-mono text-xs font-bold tracking-widest uppercase border transition-colors duration-150",
                activeFloor === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/50",
              ].join(" ")}
            >
              Floor {f}
            </button>
          ))}
          <div className="ml-auto">
            <Legend />
          </div>
        </div>

        {/* SVG Floor plan */}
        <div
          className="border border-border bg-card rounded-sm p-4 overflow-x-auto"
          data-ocid="floorplan.svg_container"
        >
          <FloorSvg
            floor={activeFloor}
            roomStatuses={roomStatuses}
            occupiedRooms={occupiedRooms}
            evacuationRoutes={floorRoutes}
            isFireDrillActive={isFireDrillActive}
            onRoomClick={toggleOccupied}
          />
        </div>

        {/* Threat status banner */}
        {threatActive && (
          <div
            className="border border-destructive/60 bg-destructive/10 rounded-sm px-4 py-3 flex flex-wrap items-center gap-4"
            data-ocid="floorplan.threat_banner"
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-destructive animate-pulse" />
              <span className="font-mono text-xs font-bold text-destructive tracking-widest uppercase">
                {currentThreat?.threatType.toUpperCase()} DETECTED
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {currentThreat?.rawResponse
                ? currentThreat.rawResponse.split(".")[0]
                : "Threat detected — check floor plan"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Severity:{" "}
              <span className="text-foreground font-bold">
                {currentThreat?.severity.toUpperCase()}
              </span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Confidence:{" "}
              <span className="text-foreground font-bold">
                {currentThreat?.confidence}%
              </span>
            </span>
            {floorRoutes.length > 0 && (
              <span className="font-mono text-xs text-foreground">
                <Zap className="w-3 h-3 inline mr-1 text-accent" />
                {floorRoutes.length} evacuation route(s) computed
              </span>
            )}
          </div>
        )}

        {/* Occupancy toggles */}
        <div
          className="border border-border bg-card rounded-sm p-4"
          data-ocid="floorplan.occupancy_panel"
        >
          <p className="font-mono text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
            Occupancy Controls — Floor {activeFloor}
          </p>
          <div className="flex flex-wrap gap-2">
            {floorRooms.map((room: RoomData) => {
              const isOccupied = occupiedRooms.includes(room.id);
              const status = roomStatuses[room.id] ?? "safe";
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleOccupied(room.id)}
                  data-ocid={`floorplan.occupancy.${room.id}`}
                  className={[
                    "px-3 py-1.5 font-mono text-xs border transition-all duration-150 rounded-sm",
                    isOccupied
                      ? "border-foreground/50 bg-foreground/10 text-foreground"
                      : "border-border bg-background text-muted-foreground",
                    status === "primary-threat"
                      ? "!border-destructive !text-destructive"
                      : "",
                    status === "secondary-threat"
                      ? "!border-accent !text-accent"
                      : "",
                  ].join(" ")}
                >
                  {room.id} {isOccupied ? "●" : "○"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Evacuation routes list */}
        {evacuationRoutes.length > 0 && (
          <div
            className="border border-border bg-card rounded-sm p-4"
            data-ocid="floorplan.routes_panel"
          >
            <p className="font-mono text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3">
              Active Evacuation Routes
            </p>
            <div className="flex flex-col gap-2">
              {evacuationRoutes.map((route, i) => (
                <div
                  key={route.roomId}
                  className="flex items-start gap-3 border border-border rounded-sm px-3 py-2"
                  data-ocid={`floorplan.route.item.${i + 1}`}
                >
                  <span className="font-mono text-xs font-bold text-foreground min-w-[3.5rem]">
                    Room {route.roomId}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {route.path.join(" → ")}
                  </span>
                  {route.instruction && (
                    <span className="font-mono text-xs text-accent ml-auto max-w-xs text-right">
                      {route.instruction}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
