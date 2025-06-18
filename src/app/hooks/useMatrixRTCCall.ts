import { useCallback, useEffect, useMemo, useState } from 'react';
import { Room, RoomMember } from 'matrix-js-sdk';
import { MatrixRTCSession, MatrixRTCSessionEvent, MatrixRTCSessionManagerEvents } from 'matrix-js-sdk/lib/matrixrtc';
import { useMatrixClient } from './useMatrixClient';
import { CallType } from '../types/call';
import { Widget } from '../utils/elementCall';
import { getCallWidget } from './useCallState';

export interface MatrixRTCCallState {
  // Call existence and basic info
  hasCall: boolean;
  hasActiveSession: boolean;
  hasActiveParticipants: boolean;
  isVideoRoom: boolean;

  // Session info
  session: MatrixRTCSession | null;
  participants: Map<RoomMember, Set<string>>;
  participantCount: number;
  
  // Current user state
  isJoined: boolean;
  canJoin: boolean;
  
  // Widget info
  widget: Widget | null;
}

/**
 * Hook that detects existing Element Calls and provides MatrixRTC session information
 * Similar to Element Web's ElementCall.get() functionality
 */
export function useMatrixRTCCall(room: Room): MatrixRTCCallState {
  const mx = useMatrixClient();
  const [, forceUpdate] = useState(0);

  // Get MatrixRTC session for this room
  const session = useMemo(() => {
    if (!mx || !room) return null;
    return mx.matrixRTC.getRoomSession(room);
  }, [mx, room]);

  // Check if this is a video room (dedicated call room)
  const isVideoRoom = useMemo(() => {
    // Add your video room detection logic here
    // For now, checking room type or name patterns
    return room?.getType() === 'm.space.child' || 
           room?.name?.toLowerCase().includes('call') ||
           false; // Adjust based on your video room logic
  }, [room]);

  // Get existing widget for this room
  const widget = useMemo(() => {
    return getCallWidget(room.roomId) || null;
  }, [room.roomId]);

  // Check if there are active participants in the session
  const hasActiveParticipants = useMemo(() => {
    if (!session) return false;
    return session.memberships.length > 0;
  }, [session]);

  // Check if there's a call (either widget exists or active session or video room)
  const hasCall = useMemo(() => {
    return !!(widget || hasActiveParticipants || isVideoRoom);
  }, [widget, hasActiveParticipants, isVideoRoom]);

  // Check if current user is joined to the session
  const isJoined = useMemo(() => {
    if (!session || !mx) return false;
    const userId = mx.getUserId();
    return session.memberships.some(m => m.sender === userId);
  }, [session, mx]);

  // Build participants map like Element Web does
  const participants = useMemo(() => {
    const participantsMap = new Map<RoomMember, Set<string>>();
    
    if (!session || !room) return participantsMap;

    for (const membership of session.memberships) {
      if (!membership.sender) continue;
      
      const member = room.getMember(membership.sender);
      if (member) {
        if (participantsMap.has(member)) {
          participantsMap.get(member)?.add(membership.deviceId);
        } else {
          participantsMap.set(member, new Set([membership.deviceId]));
        }
      }
    }

    return participantsMap;
  }, [session, room]);

  // Count unique participants (one per user, regardless of devices)
  const participantCount = useMemo(() => {
    return participants.size;
  }, [participants]);

  // Determine if user can join
  const canJoin = useMemo(() => {
    if (!room || !mx) return false;
    
    // Check room membership
    const myMembership = room.getMyMembership();
    if (myMembership !== 'join') return false;
    
    // If already joined the session, can't join again
    if (isJoined) return false;
    
    // Check basic permissions (simplified)
    return true;
  }, [room, mx, isJoined]);

  // Listen to session membership changes
  useEffect(() => {
    if (!session) return;

    const onMembershipsChanged = () => {
      console.log('MatrixRTC memberships changed for room:', room.roomId);
      forceUpdate(prev => prev + 1);
    };

    session.on(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
    
    return () => {
      session.off(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
    };
  }, [session, room.roomId]);

  // Listen to session manager events
  useEffect(() => {
    if (!mx) return;

    const onSessionStarted = (roomId: string) => {
      if (roomId === room.roomId) {
        console.log('MatrixRTC session started for room:', roomId);
        forceUpdate(prev => prev + 1);
      }
    };

    const onSessionEnded = (roomId: string) => {
      if (roomId === room.roomId) {
        console.log('MatrixRTC session ended for room:', roomId);
        forceUpdate(prev => prev + 1);
      }
    };

    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionStarted, onSessionStarted);
    mx.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, onSessionEnded);

    return () => {
      mx.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionStarted, onSessionStarted);
      mx.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionEnded, onSessionEnded);
    };
  }, [mx, room.roomId]);

  return {
    hasCall,
    hasActiveSession: !!session,
    hasActiveParticipants,
    isVideoRoom,
    session,
    participants,
    participantCount,
    isJoined,
    canJoin,
    widget,
  };
}

/**
 * Hook to get call action type (start vs join) and disabled reason
 */
export function useCallAction(room: Room): {
  action: 'start' | 'join' | 'disabled';
  reason?: string;
  callState: MatrixRTCCallState;
} {
  const callState = useMatrixRTCCall(room);

  const action = useMemo(() => {
    // If there are active participants, this is a join scenario
    if (callState.hasActiveParticipants) {
      return callState.canJoin ? 'join' : 'disabled';
    }
    
    // If it's a video room with no active participants, can always start
    if (callState.isVideoRoom) {
      return 'start';
    }
    
    // For regular rooms, check if we can start a call
    if (callState.canJoin) {
      return 'start';
    }
    
    return 'disabled';
  }, [callState]);

  const reason = useMemo(() => {
    if (action === 'disabled') {
      if (callState.isJoined) {
        return 'Already joined this call';
      }
      if (room.getMyMembership() !== 'join') {
        return 'You must join the room first';
      }
      return 'Cannot join call';
    }
    return undefined;
  }, [action, callState.isJoined, room]);

  return {
    action,
    reason,
    callState,
  };
} 