import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface ThreatResult {
    threatType: string;
    timestamp: bigint;
    severity: string;
    rawResponse: string;
    confidence: bigint;
}
export interface RoomData {
    id: string;
    floor: bigint;
    isCorridor: boolean;
    name: string;
    isExit: boolean;
    neighbors: Array<string>;
    cameraId: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface backendInterface {
    classifyAudio(audioBase64: string, mimeType: string): Promise<{
        __kind__: "ok";
        ok: ThreatResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    classifyImage(imageBase64: string, mimeType: string, roomId: string): Promise<{
        __kind__: "ok";
        ok: ThreatResult;
    } | {
        __kind__: "err";
        err: string;
    }>;
    computeEscapePath(startRoom: string, blockedRooms: Array<string>): Promise<{
        __kind__: "ok";
        ok: Array<string>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateEvacuationInstruction(roomId: string, path: Array<string>): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    generateTTS(text: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getFloorPlan(): Promise<Array<RoomData>>;
    getLatestThreat(): Promise<ThreatResult | null>;
    getOccupiedRooms(): Promise<Array<string>>;
    getSimulatorState(): Promise<ThreatResult | null>;
    resetSimulator(): Promise<void>;
    setGeminiApiKey(key: string): Promise<void>;
    setGoogleTtsApiKey(key: string): Promise<void>;
    setOccupied(roomId: string, occupied: boolean): Promise<void>;
    simulateFire(roomId: string): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    whoami(): Promise<string>;
}
