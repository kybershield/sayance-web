export enum PlatformCallType {
  ElementCall = 'element_call',
  JitsiCall = 'jitsi_call', 
  LegacyCall = 'legacy_call',
}

export enum CallType {
  Voice = 'voice',
  Video = 'video',
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connected = 'connected',
  Disconnecting = 'disconnecting',
}

export interface CallPlatformTypeProps {
  label: string;
  analyticsName: string;
  isBeta?: boolean;
}

export interface ElementCallConfig {
  url?: string;
  participantLimit?: number;
  brand?: string;
}

export interface CallOptions {
  skipLobby?: boolean;
  returnToLobby?: boolean;
  perParticipantE2EE?: boolean;
} 