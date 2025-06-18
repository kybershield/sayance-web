import { useCallback, useMemo } from 'react';
import { Room } from 'matrix-js-sdk';
import { useCallState, endEmbeddedCall, getCallWidget } from './useCallState';
import { CallType } from '../types/call';
import { Widget } from '../utils/elementCall';

export interface UseCallViewResult {
  shouldShowCallView: boolean;
  callType: CallType | null;
  isCallActive: boolean;
  widget: Widget | null;
  closeCall: () => void;
}

/**
 * Hook to manage call view state for a room
 */
export function useCallView(room: Room): UseCallViewResult {
  const callState = useCallState(room);

  const shouldShowCallView = useMemo(() => {
    return !!(callState?.isActive && callState?.isEmbedded);
  }, [callState]);

  const callType = useMemo(() => {
    return callState?.callType || null;
  }, [callState]);

  const isCallActive = useMemo(() => {
    return !!(callState?.isActive);
  }, [callState]);

  const widget = useMemo(() => {
    return getCallWidget(room.roomId) || null;
  }, [room.roomId]);

  const closeCall = useCallback(() => {
    if (callState?.isActive) {
      endEmbeddedCall(room.roomId);
    }
  }, [callState, room.roomId]);

  return {
    shouldShowCallView,
    callType,
    isCallActive,
    widget,
    closeCall,
  };
} 