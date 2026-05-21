import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CAMERA_TO_ROOM, FLOOR_PLAN } from "../lib/floorplan-data";

// ─── Camera list ──────────────────────────────────────────────────────────────
export const CCTV_CAMERAS = FLOOR_PLAN.filter((r) => r.cameraId !== "").map(
  (r) => ({
    id: r.cameraId,
    roomId: r.id,
    label: `Camera ${r.cameraId} — Floor ${r.floor}, ${r.name}`,
    floor: r.floor,
    room: r.name,
  }),
);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DetectionEvent {
  timestamp: number;
  cameraId: string;
  threatType: string;
  confidence: number;
  motionDetected: boolean;
}

type PermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

interface CCTVMonitorProps {
  selectedCamera: string;
  onCameraChange: (id: string) => void;
  isMonitoring: boolean;
  onStartMonitoring: () => void;
  onStopMonitoring: () => void;
  onAudioChunk: (base64: string, mimeType: string, roomId: string) => void;
  onMotionDetected: (detected: boolean) => void;
  activityFeed: DetectionEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MOTION_THRESHOLD = 30;
const MOTION_SAMPLE_INTERVAL = 150;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the current context supports getUserMedia over a secure origin. */
function isSecureContext(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.isSecureContext ||
      location.protocol === "https:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1")
  );
}

/** Returns true if getUserMedia is available at all. */
function hasMediaDevices(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/** Translates DOMException names into friendly messages. */
function friendlyPermissionError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  switch (err.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera/microphone access was denied. Click the lock icon in your browser address bar to reset permissions and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera or microphone found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Camera or microphone is already in use by another application.";
    case "OverconstrainedError":
      return "Camera constraints could not be satisfied. Try a different camera.";
    case "SecurityError":
      return "Camera access is blocked by your browser security settings. Ensure you are on HTTPS.";
    case "AbortError":
      return "Camera access was aborted. Please try again.";
    default:
      return err.message || "Unknown camera error.";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CCTVMonitor({
  selectedCamera,
  onCameraChange,
  isMonitoring,
  onStartMonitoring,
  onStopMonitoring,
  onAudioChunk,
  onMotionDetected,
  activityFeed,
}: CCTVMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const motionFrameRef = useRef<ImageData | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastMotionCheckRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const selectedCameraRef = useRef(selectedCamera);

  const [motionLevel, setMotionLevel] = useState(0);
  const [permissionState, setPermissionState] =
    useState<PermissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep selectedCameraRef in sync so callbacks don't close over stale value
  useEffect(() => {
    selectedCameraRef.current = selectedCamera;
  }, [selectedCamera]);

  // ── Motion / canvas loop ────────────────────────────────────────────────────
  const detectMotion = useCallback(() => {
    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectMotion);
      return;
    }

    const now = performance.now();
    if (now - lastMotionCheckRef.current > MOTION_SAMPLE_INTERVAL) {
      lastMotionCheckRef.current = now;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 64;
        canvas.height = 48;
        ctx.drawImage(video, 0, 0, 64, 48);
        const current = ctx.getImageData(0, 0, 64, 48);

        if (motionFrameRef.current) {
          const prev = motionFrameRef.current.data;
          const cur = current.data;
          let diff = 0;
          for (let i = 0; i < cur.length; i += 4) {
            diff += Math.abs(cur[i] - prev[i]);
            diff += Math.abs(cur[i + 1] - prev[i + 1]);
            diff += Math.abs(cur[i + 2] - prev[i + 2]);
          }
          const avg = diff / (cur.length / 4);
          const pct = Math.min(100, (avg / 255) * 600);
          setMotionLevel(Math.round(pct));
          onMotionDetected(avg > MOTION_THRESHOLD);
        }
        motionFrameRef.current = current;
      }
    }

    // Mirror video to visible canvas
    const visCtx = canvasRef.current?.getContext("2d");
    if (visCtx && canvasRef.current) {
      canvasRef.current.width = video.videoWidth || 320;
      canvasRef.current.height = video.videoHeight || 240;
      visCtx.drawImage(video, 0, 0);
    }

    animFrameRef.current = requestAnimationFrame(detectMotion);
  }, [onMotionDetected]);

  // ── Audio recording cycle ───────────────────────────────────────────────────
  const startAudioCycle = useCallback(
    (audioStream: MediaStream) => {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const startCycle = () => {
        const recorder = new MediaRecorder(audioStream, { mimeType });
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          if (audioChunksRef.current.length === 0) return;
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            if (base64) {
              const roomId = CAMERA_TO_ROOM[selectedCameraRef.current] ?? "103";
              onAudioChunk(base64, mimeType, roomId);
            }
          };
          reader.readAsDataURL(blob);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      };

      startCycle();
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
        startCycle();
      }, 5000);
    },
    [onAudioChunk],
  );

  // ── Start stream (called on button press — user gesture required) ───────────
  const startStream = useCallback(async () => {
    setErrorMessage(null);
    setPermissionState("requesting");

    // Feature + secure-context checks
    if (!isSecureContext()) {
      setPermissionState("unavailable");
      setErrorMessage(
        "Camera access requires a secure (HTTPS) connection. Please access this app over HTTPS.",
      );
      return;
    }
    if (!hasMediaDevices()) {
      setPermissionState("unavailable");
      setErrorMessage(
        "Your browser does not support camera/microphone access. Please use a modern browser (Chrome, Firefox, Edge, or Safari).",
      );
      return;
    }

    try {
      // Request both video and audio together — browser shows a single combined prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      setPermissionState("granted");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() may reject if autoplay policy blocks — catch gracefully
        await videoRef.current.play().catch(() => {
          /* video will play once user interacts */
        });
      }

      // Separate audio-only stream for MediaRecorder
      const audioStream = new MediaStream(stream.getAudioTracks());
      startAudioCycle(audioStream);

      animFrameRef.current = requestAnimationFrame(detectMotion);
      onStartMonitoring();
    } catch (err) {
      const msg = friendlyPermissionError(err);
      setErrorMessage(msg);
      const errName = err instanceof Error ? err.name : "";
      setPermissionState(
        errName === "NotAllowedError" || errName === "PermissionDeniedError"
          ? "denied"
          : "unavailable",
      );
    }
  }, [startAudioCycle, detectMotion, onStartMonitoring]);

  // ── Stop stream ─────────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (recordingIntervalRef.current)
      clearInterval(recordingIntervalRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    motionFrameRef.current = null;
    setMotionLevel(0);
    setPermissionState("idle");
    onStopMonitoring();
  }, [onStopMonitoring]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
      }
    };
  }, []);

  const selectedCamData = CCTV_CAMERAS.find((c) => c.id === selectedCamera);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Camera selector */}
      <div className="space-y-2">
        <label
          htmlFor="camera-select"
          className="text-xs font-mono uppercase tracking-widest text-muted-foreground"
        >
          Select CCTV Camera
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {CCTV_CAMERAS.map((cam) => (
            <button
              key={cam.id}
              type="button"
              data-ocid={`detection.camera.${cam.id.toLowerCase()}`}
              onClick={() => {
                if (isMonitoring) stopStream();
                onCameraChange(cam.id);
              }}
              className={[
                "flex flex-col items-start px-3 py-2 rounded-sm border text-left transition-colors duration-200",
                selectedCamera === cam.id
                  ? "border-secondary bg-secondary/10 text-secondary"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="font-display font-bold text-xs tracking-widest uppercase">
                {cam.id}
              </span>
              <span className="font-mono text-[10px] mt-0.5 leading-tight opacity-70">
                F{cam.floor} · {cam.room}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Video preview area */}
      <div className="relative rounded-sm overflow-hidden border border-border bg-muted/20 aspect-video max-h-52">
        {/* Visible canvas for motion-processed frames */}
        <canvas
          ref={canvasRef}
          className={[
            "absolute inset-0 w-full h-full object-cover",
            isMonitoring && permissionState === "granted"
              ? "opacity-100"
              : "opacity-0",
          ].join(" ")}
          data-ocid="detection.cctv.canvas_target"
        />
        {/* Hidden video source */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="hidden"
          tabIndex={-1}
        />
        {/* Hidden canvas for frame diff */}
        <canvas ref={hiddenCanvasRef} className="hidden" tabIndex={-1} />

        {/* Idle state */}
        {!isMonitoring && permissionState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full border border-border/50 bg-muted/20 flex items-center justify-center">
              <Camera className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest text-center px-4">
              {selectedCamData ? selectedCamData.label : "No camera selected"}
            </p>
          </div>
        )}

        {/* Requesting permission overlay */}
        {permissionState === "requesting" && (
          <div
            data-ocid="detection.cctv.loading_state"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80"
          >
            <div className="w-10 h-10 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-mono text-secondary uppercase tracking-widest text-center px-4">
              Awaiting camera permission…
            </p>
            <p className="text-[10px] font-mono text-muted-foreground text-center px-6">
              Allow camera &amp; microphone access in the browser prompt
            </p>
          </div>
        )}

        {/* Permission denied / unavailable overlay */}
        {(permissionState === "denied" ||
          permissionState === "unavailable") && (
          <div
            data-ocid="detection.cctv.error_state"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-destructive/5"
          >
            <ShieldAlert className="w-8 h-8 text-destructive/70" />
            <p className="text-[10px] font-mono text-destructive/80 uppercase tracking-widest text-center">
              {permissionState === "denied" ? "Access Denied" : "Unavailable"}
            </p>
          </div>
        )}

        {/* Active monitoring overlay */}
        {isMonitoring && permissionState === "granted" && (
          <>
            {/* REC badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-destructive/80 text-destructive-foreground px-2 py-0.5 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground alert-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
                LIVE · {selectedCamera}
              </span>
            </div>
            {/* Motion bar */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-foreground/60 uppercase tracking-widest shrink-0">
                  MOTION
                </span>
                <div className="flex-1 h-1 bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${motionLevel}%`,
                      background:
                        motionLevel > 60
                          ? "oklch(var(--destructive))"
                          : motionLevel > 30
                            ? "oklch(var(--secondary))"
                            : "oklch(var(--chart-3))",
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-foreground/60 w-8 text-right shrink-0">
                  {motionLevel}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Permission / error banner */}
      {errorMessage && (
        <div
          data-ocid="detection.cctv.error_state"
          className="flex gap-2 items-start bg-destructive/10 border border-destructive/30 rounded-sm px-3 py-2"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-destructive leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Permission granted info */}
      {permissionState === "granted" && isMonitoring && !errorMessage && (
        <div className="flex gap-2 items-center bg-chart-3/10 border border-chart-3/30 rounded-sm px-3 py-1.5">
          <ShieldCheck className="w-3 h-3 text-chart-3 shrink-0" />
          <p className="text-[10px] font-mono text-chart-3 uppercase tracking-widest">
            Camera &amp; microphone access granted
          </p>
        </div>
      )}

      {/* Permission context info (idle, before first attempt) */}
      {permissionState === "idle" && !errorMessage && (
        <div className="flex gap-2 items-center bg-muted/30 border border-border/50 rounded-sm px-3 py-1.5">
          <Shield className="w-3 h-3 text-muted-foreground shrink-0" />
          <p className="text-[10px] font-mono text-muted-foreground">
            Your browser will ask for camera &amp; microphone permission when
            you start monitoring.
          </p>
        </div>
      )}

      {/* Start / Stop controls */}
      <div className="flex items-center gap-3">
        {!isMonitoring ? (
          <Button
            onClick={startStream}
            data-ocid="detection.start_monitoring.button"
            disabled={permissionState === "requesting"}
            className="font-display font-bold tracking-widest uppercase text-xs gap-2"
          >
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            {permissionState === "requesting"
              ? "REQUESTING…"
              : "START MONITORING"}
          </Button>
        ) : (
          <Button
            onClick={stopStream}
            variant="outline"
            data-ocid="detection.stop_monitoring.button"
            className="font-display font-bold tracking-widest uppercase text-xs gap-2 border-destructive text-destructive hover:bg-destructive/10"
          >
            <CameraOff className="w-3.5 h-3.5" aria-hidden="true" />
            STOP MONITORING
          </Button>
        )}

        {/* Retry button when denied/unavailable */}
        {!isMonitoring &&
          (permissionState === "denied" ||
            permissionState === "unavailable") && (
            <Button
              onClick={() => {
                setPermissionState("idle");
                setErrorMessage(null);
              }}
              variant="outline"
              data-ocid="detection.cctv.retry_button"
              className="font-display font-bold tracking-widest uppercase text-xs gap-2"
            >
              RETRY
            </Button>
          )}

        {isMonitoring && (
          <span
            data-ocid="detection.monitoring.loading_state"
            className="flex items-center gap-1.5 text-xs font-mono text-secondary alert-pulse"
          >
            <Zap className="w-3 h-3" />
            MONITORING ACTIVE · CAM {selectedCamera} · {selectedCamData?.room}
          </span>
        )}
      </div>

      {/* Activity feed */}
      {activityFeed.length > 0 && (
        <div data-ocid="detection.activity_feed.list" className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Live Detection Feed
          </p>
          {activityFeed.map((evt, i) => (
            <div
              key={`${evt.timestamp}-${i}`}
              data-ocid={`detection.activity_feed.item.${i + 1}`}
              className="flex items-center gap-2 bg-card border border-border/50 rounded-sm px-3 py-1.5"
            >
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-[10px] font-mono text-secondary font-bold shrink-0">
                CAM {evt.cameraId}
              </span>
              <span
                className={[
                  "text-[10px] font-mono font-bold uppercase tracking-wider",
                  evt.threatType === "none" || evt.threatType === "safe"
                    ? "text-chart-3"
                    : "text-destructive",
                ].join(" ")}
              >
                {evt.threatType.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto shrink-0">
                {evt.confidence}% conf
                {evt.motionDetected ? " · MOTION" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
