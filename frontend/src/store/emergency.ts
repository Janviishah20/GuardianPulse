import { create } from "zustand";
import { FLOOR_PLAN, ROOM_MAP } from "../lib/floorplan-data";
import type { EvacuationRoute, RoomStatus, ThreatResult } from "../types";

interface LoadingState {
  detection: boolean;
  routing: boolean;
  tts: boolean;
}

interface EmergencyStore {
  // State
  currentThreat: ThreatResult | null;
  floorPlan: typeof FLOOR_PLAN;
  roomStatuses: Record<string, RoomStatus>;
  evacuationRoutes: EvacuationRoute[];
  occupiedRooms: string[];
  isLoading: LoadingState;
  error: string | null;
  // Simulator state
  isFireDrillActive: boolean;
  isSimulating: boolean;
  // Actions
  setThreat: (threat: ThreatResult | null) => void;
  updateRoomStatuses: (
    threat: ThreatResult | null,
    threatRoomId?: string,
  ) => void;
  addEvacuationRoute: (route: EvacuationRoute) => void;
  setEvacuationRoutes: (routes: EvacuationRoute[]) => void;
  setOccupied: (roomIds: string[]) => void;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
  setError: (error: string | null) => void;
  setFireDrillActive: (active: boolean) => void;
  setSimulating: (simulating: boolean) => void;
  reset: () => void;
}

function computeRoomStatuses(
  threat: ThreatResult | null,
  threatRoomId?: string,
): Record<string, RoomStatus> {
  const statuses: Record<string, RoomStatus> = {};
  for (const r of FLOOR_PLAN) {
    statuses[r.id] = "safe";
  }

  if (!threat || threat.threatType === "none" || !threatRoomId) return statuses;

  const primary = ROOM_MAP.get(threatRoomId);
  if (!primary) return statuses;

  statuses[threatRoomId] = "primary-threat";

  for (const neighborId of primary.neighbors) {
    const neighbor = ROOM_MAP.get(neighborId);
    if (neighbor) {
      statuses[neighborId] = "secondary-threat";
      for (const secondId of neighbor.neighbors) {
        if (statuses[secondId] === "safe") {
          statuses[secondId] = "evacuating";
        }
      }
    }
  }

  return statuses;
}

const initialLoading: LoadingState = {
  detection: false,
  routing: false,
  tts: false,
};

const initialStatuses: Record<string, RoomStatus> = {};
for (const r of FLOOR_PLAN) {
  initialStatuses[r.id] = "safe";
}

export const useEmergencyStore = create<EmergencyStore>((set) => ({
  currentThreat: null,
  floorPlan: FLOOR_PLAN,
  roomStatuses: initialStatuses,
  evacuationRoutes: [],
  occupiedRooms: ["302", "305", "204", "106", "103"],
  isLoading: initialLoading,
  error: null,
  isFireDrillActive: false,
  isSimulating: false,

  setThreat: (threat) => {
    set({ currentThreat: threat });
  },

  updateRoomStatuses: (threat, threatRoomId) => {
    set({ roomStatuses: computeRoomStatuses(threat, threatRoomId) });
  },

  addEvacuationRoute: (route) => {
    set((state) => ({
      evacuationRoutes: [
        ...state.evacuationRoutes.filter((r) => r.roomId !== route.roomId),
        route,
      ],
    }));
  },

  setEvacuationRoutes: (routes) => {
    set({ evacuationRoutes: routes });
  },

  setOccupied: (roomIds) => {
    set({ occupiedRooms: roomIds });
  },

  setLoading: (key, value) => {
    set((state) => ({ isLoading: { ...state.isLoading, [key]: value } }));
  },

  setError: (error) => {
    set({ error });
  },

  setFireDrillActive: (active) => {
    set({ isFireDrillActive: active });
  },

  setSimulating: (simulating) => {
    set({ isSimulating: simulating });
  },

  reset: () => {
    set({
      currentThreat: null,
      roomStatuses: { ...initialStatuses },
      evacuationRoutes: [],
      isLoading: initialLoading,
      error: null,
      isFireDrillActive: false,
      isSimulating: false,
    });
  },
}));

export function useThreatActive() {
  return useEmergencyStore(
    (s) => s.currentThreat !== null && s.currentThreat.threatType !== "none",
  );
}
