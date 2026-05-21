export interface RoomData {
  id: string;
  floor: number;
  name: string;
  cameraId: string;
  neighbors: string[];
  isExit: boolean;
  isCorridor: boolean;
}

export interface ThreatResult {
  threatType: "fire" | "gas" | "structural" | "none";
  confidence: number;
  severity: "low" | "medium" | "high";
  rawResponse: string;
  timestamp: bigint;
}

export interface EvacuationRoute {
  roomId: string;
  path: string[];
  instruction: string;
  ttsAudio?: string;
}

export type RoomStatus =
  | "safe"
  | "primary-threat"
  | "secondary-threat"
  | "evacuating";

export interface AppState {
  currentThreat: ThreatResult | null;
  floorPlan: RoomData[];
  evacuationRoutes: EvacuationRoute[];
  occupiedRooms: string[];
  roomStatuses: Record<string, RoomStatus>;
}

export interface LoadingState {
  detection: boolean;
  routing: boolean;
  tts: boolean;
}

export const SEVERITY_LABELS: Record<ThreatResult["severity"], string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export const THREAT_LABELS: Record<ThreatResult["threatType"], string> = {
  fire: "FIRE",
  gas: "GAS LEAK",
  structural: "STRUCTURAL",
  none: "ALL CLEAR",
};
