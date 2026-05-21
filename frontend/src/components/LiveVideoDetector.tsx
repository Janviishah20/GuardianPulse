import { useEffect, useRef } from "react";
import { useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";
const busyRef = useRef(false);

export function LiveVideoDetector({
  onFireDetected,
}: {
  onFireDetected: (confidence: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let stream: MediaStream;

    async function startCamera() {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    }

    startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx?.drawImage(video, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg").split(",")[1];
      setInterval(async () => {
  if (!videoRef.current || !canvasRef.current) return;

  const video = videoRef.current;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx?.drawImage(video, 0, 0);

  const base64 = canvas.toDataURL("image/jpeg").split(",")[1];

  // ✅ ADD IT HERE
  if (busyRef.current) return;
  busyRef.current = true;

  try {
    if (!actor) return;

    const result = await actor.classifyImage(base64);

    if (result.__kind__ === "ok") {
      const confidence = Number(result.ok.confidence);

      if (result.ok.threatType === "fire" && confidence > 70) {
        onFireDetected(confidence);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    busyRef.current = false;
  }
}, 1000);


      // ⚠️ TEMP MOCK — replace with backend call
      if (!actor) return;

try {
  const result = await actor.classifyImage(base64);

  if (result.__kind__ === "ok") {
    const data = result.ok;

    const confidence = Number(data.confidence);

    if (data.threatType === "fire" && confidence > 70) {
      onFireDetected(confidence);
    }
  }
} catch (err) {
  console.error("Vision error", err);
}
    }, 1000); // 1 FPS

    return () => clearInterval(interval);
  }, [onFireDetected]);

  return (
    <div className="space-y-2">
      <video ref={videoRef} autoPlay playsInline className="w-full rounded" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}