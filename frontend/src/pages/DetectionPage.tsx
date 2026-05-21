import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActor } from "@caffeineai/core-infrastructure";
import { Link } from "@tanstack/react-router";
import { LiveVideoDetector } from "../components/LiveVideoDetector";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  KeyRound,
  Loader2,
  MapIcon,
  Mic,
  RefreshCw,
  Route,
  Square,
  Users,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createActor } from "../backend";
import {
  CCTVMonitor,
  CCTV_CAMERAS,
  type DetectionEvent,
} from "../components/CCTVMonitor";
import { SeverityBadge, ThreatBadge } from "../components/ThreatBadge";
import { CAMERA_TO_ROOM } from "../lib/floorplan-data";
import { useEmergencyStore } from "../store/emergency";
import type { ThreatResult } from "../types";
import { THREAT_LABELS } from "../types";

// ─── Backend ThreatResult ─────────────────────────────────────────────────────
interface BackendThreatResult {
  threatType: string;
  confidence: bigint;
  severity: string;
  rawResponse: string;
  timestamp: bigint;
}

function adaptThreat(raw: BackendThreatResult): ThreatResult {
  const rawSeverity = raw.severity as string;
  const severity: ThreatResult["severity"] =
    rawSeverity === "critical" || rawSeverity === "high"
      ? "high"
      : rawSeverity === "medium"
        ? "medium"
        : "low";
  return {
    threatType: raw.threatType as ThreatResult["threatType"],
    confidence: Number(raw.confidence),
    severity,
    rawResponse: raw.rawResponse,
    timestamp: raw.timestamp,
  };
}

type StepStatus = "idle" | "active" | "complete" | "error";

interface StepState {
  status: StepStatus;
  error?: string;
}

function formatCountdown(secs: number): string {
  if (secs <= 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CANNED_EVACUATION =
  "Attention all occupants: A fire has been detected. Please evacuate immediately.";

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

type DetectionSource = "cctv" | "live-video";

export function DetectionPage() {
  const { actor, isFetching } = useActor(createActor);
  const {
    setThreat,
    updateRoomStatuses,
    setEvacuationRoutes,
    setLoading,
    occupiedRooms,
    currentThreat,
    isFireDrillActive,
    isSimulating,
    setFireDrillActive,
    setSimulating,
    reset,
  } = useEmergencyStore();

  // ✅ FIX: ENV KEY
  const PREFILLED_GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || "";

  const [geminiKey, setGeminiKey] = useState(PREFILLED_GEMINI_KEY);

  const [detectionSource, setDetectionSource] =
    useState<DetectionSource>("cctv");

  const [selectedCamera, setSelectedCamera] = useState(
    CCTV_CAMERAS[0]?.id ?? "1A",
  );

  const [step1, setStep1] = useState<StepState>({ status: "idle" });
  const [routes, setRoutes] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState<Record<string, string>>({});

  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // ✅ FIX: CLEANUP AUDIO URL
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // ✅ FIX: PIPELINE LOCK
  const pipelineLock = useRef(false);

  // ✅ FIX: AUDIO CONTEXT
  const startAlarm = useCallback(async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    const osc = ctx.createOscillator();
    osc.frequency.value = 800;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), 500);
  }, []);

  const runFirePipeline = useCallback(
    async (roomId: string) => {
      if (!actor || pipelineLock.current) return;
      pipelineLock.current = true;

      setSimulating(true);
      setFireDrillActive(true);

      await startAlarm();

      try {
        setStep1({ status: "active" });

        const threat: ThreatResult = {
          threatType: "fire",
          confidence: 95,
          severity: "high",
          rawResponse: "Fire detected",
          timestamp: BigInt(Date.now()),
        };

        setThreat(threat);
        updateRoomStatuses(threat, roomId);

        setStep1({ status: "complete" });
      } finally {
        pipelineLock.current = false;
        setSimulating(false);
      }
    },
    [actor, setThreat, updateRoomStatuses],
  );

  // ✅ FIX: CCTV → PIPELINE
  const handleAudioChunk = useCallback(
    async (base64: string, mimeType: string, roomId: string) => {
      if (!actor) return;

      const result = await actor.classifyAudio(base64, mimeType);
      if (result.__kind__ === "err") return;

      const threat = adaptThreat(result.ok as BackendThreatResult);

      setThreat(threat);

      if (threat.threatType === "fire" && threat.confidence > 70) {
        await runFirePipeline(roomId);
      }
    },
    [actor, runFirePipeline],
  );

  // ✅ FIX: LIVE VIDEO HOOK READY
  const handleFireDetected = useCallback(
    (confidence: number, roomId: string) => {
      if (confidence > 70) {
        runFirePipeline(roomId);
      }
    },
    [runFirePipeline],
  );

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-bold">Detection Console</h1>

      {/* SOURCE TOGGLE */}
      <div className="flex gap-2">
        <Button onClick={() => setDetectionSource("cctv")}>
          CCTV
        </Button>
        <Button onClick={() => setDetectionSource("live-video")}>
          Live
        </Button>
      </div>

      {/* CCTV */}
      {detectionSource === "cctv" && (
        <CCTVMonitor
          selectedCamera={selectedCamera}
          onCameraChange={setSelectedCamera}
          onAudioChunk={handleAudioChunk}
        />
      )}

      {/* LIVE VIDEO */}
      {detectionSource === "live-video" && (
  <LiveVideoDetector
    onFireDetected={(confidence) =>
      handleFireDetected(confidence, liveDetectionRoom)
    }
  />
)}

      {/* RESULT */}
      {currentThreat && (
        <div className="border p-3">
          <ThreatBadge threat={currentThreat} />
          <SeverityBadge severity={currentThreat.severity} />
        </div>
      )}

      {/* NAV */}
      <div className="flex gap-2">
        <Link to="/floorplan">
          <Button>Floor Plan</Button>
        </Link>
        <Link to="/manifest">
          <Button>Manifest</Button>
        </Link>
      </div>
    </div>
  );
}