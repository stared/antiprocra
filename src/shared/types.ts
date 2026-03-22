export interface SiteData {
  totalSeconds: number;
  visits: number;
  currentSessionStart: number; // epoch ms, 0 if no active session
  currentSessionSeconds: number; // total budget for current session
}

export interface TrackingData {
  date: string; // ISO date string, based on DAY_START_HOUR
  sites: Record<string, SiteData>;
}

export type MessageType = "SESSION_START" | "SESSION_EXTEND" | "GET_DATA";

export interface SessionStartMessage {
  type: "SESSION_START";
  domain: string;
}

export interface SessionExtendMessage {
  type: "SESSION_EXTEND";
  domain: string;
}

export interface GetDataMessage {
  type: "GET_DATA";
  domain: string;
}

export type ExtensionMessage =
  | SessionStartMessage
  | SessionExtendMessage
  | GetDataMessage;
