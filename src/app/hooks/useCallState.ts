import { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { ConnectionState, CallType } from '../types/call';
import { Widget } from '../utils/elementCall';

interface CallState {
  roomId: string;
  isActive: boolean;
  connectionState: ConnectionState;
  participantCount: number;
  callType: CallType;
  isEmbedded: boolean;
  startTime?: Date;
  widget?: Widget;
}

// Simple in-memory store for call states
const callStates = new Map<string, CallState>();
const callStateListeners = new Set<() => void>();

function notifyCallStateChange() {
  callStateListeners.forEach(listener => listener());
}

export function setCallState(roomId: string, state: Partial<CallState>) {
  const currentState = callStates.get(roomId) || {
    roomId,
    isActive: false,
    connectionState: ConnectionState.Disconnected,
    participantCount: 0,
    callType: CallType.Video,
    isEmbedded: false,
  };

  const newState = { ...currentState, ...state };
  callStates.set(roomId, newState);
  notifyCallStateChange();
}

export function removeCallState(roomId: string) {
  callStates.delete(roomId);
  notifyCallStateChange();
}

export function getCallState(roomId: string): CallState | undefined {
  return callStates.get(roomId);
}

export function getAllCallStates(): CallState[] {
  return Array.from(callStates.values());
}

/**
 * Get widget for a specific room's call
 */
export function getCallWidget(roomId: string): Widget | undefined {
  return getCallState(roomId)?.widget;
}

/**
 * Hook to track call state for a specific room
 */
export function useCallState(room: Room | string): CallState | null {
  const roomId = typeof room === 'string' ? room : room.roomId;
  const [callState, setCallStateLocal] = useState<CallState | null>(() => 
    getCallState(roomId) || null
  );

  useEffect(() => {
    const updateState = () => {
      setCallStateLocal(getCallState(roomId) || null);
    };

    callStateListeners.add(updateState);
    return () => {
      callStateListeners.delete(updateState);
    };
  }, [roomId]);

  return callState;
}

/**
 * Hook to track all ongoing calls
 */
export function useAllCallStates(): CallState[] {
  const [callStates, setCallStatesLocal] = useState<CallState[]>(() => 
    getAllCallStates()
  );

  useEffect(() => {
    const updateStates = () => {
      setCallStatesLocal(getAllCallStates());
    };

    callStateListeners.add(updateStates);
    return () => {
      callStateListeners.delete(updateStates);
    };
  }, []);

  return callStates;
}

/**
 * Hook to check if there are any ongoing calls
 */
export function useHasOngoingCalls(): boolean {
  const callStates = useAllCallStates();
  return callStates.some(state => state.isActive);
}

/**
 * Start tracking an embedded call widget
 */
export function startEmbeddedCall(roomId: string, callType: CallType, widget: Widget) {
  setCallState(roomId, {
    isActive: true,
    connectionState: ConnectionState.Connected,
    callType,
    isEmbedded: true,
    startTime: new Date(),
    widget,
  });
}

/**
 * End an embedded call
 */
export function endEmbeddedCall(roomId: string) {
  removeCallState(roomId);
}

/**
 * Update call connection state
 */
export function updateCallConnectionState(roomId: string, connectionState: ConnectionState) {
  const currentState = getCallState(roomId);
  if (currentState) {
    setCallState(roomId, { connectionState });
  }
}

/**
 * Update participant count
 */
export function updateParticipantCount(roomId: string, participantCount: number) {
  const currentState = getCallState(roomId);
  if (currentState) {
    setCallState(roomId, { participantCount });
  }
}

/**
 * Utility to start tracking a call window (legacy - keeping for compatibility)
 * @deprecated Use startEmbeddedCall instead
 */
export function trackCallWindow(roomId: string, callWindow: Window) {
  setCallState(roomId, {
    isActive: true,
    connectionState: ConnectionState.Connected,
    callType: CallType.Video,
    isEmbedded: false,
  });

  // Monitor if the window is closed
  const checkClosed = setInterval(() => {
    if (callWindow.closed) {
      removeCallState(roomId);
      clearInterval(checkClosed);
    }
  }, 1000);

  // Clean up on beforeunload
  const handleBeforeUnload = () => {
    removeCallState(roomId);
    clearInterval(checkClosed);
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    clearInterval(checkClosed);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
} 