import { useEffect, useState } from 'react';
import { MatrixClient, Room, RoomStateEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

// Import MatrixRTC types if available
let MatrixRTCSessionEvent: any;
try {
  // Try to import MatrixRTC types
  const matrixRTCModule = require('matrix-js-sdk/lib/matrixrtc');
  MatrixRTCSessionEvent = matrixRTCModule.MatrixRTCSessionEvent;
} catch (e) {
  // MatrixRTC not available
  MatrixRTCSessionEvent = null;
}

export interface RoomCallInfo {
  isCallActive: boolean;
  participantCount: number;
  participants: string[];
  canJoinCall: boolean;
}

export const useRoomCall = (room: Room): RoomCallInfo => {
  const mx = useMatrixClient();
  const [callInfo, setCallInfo] = useState<RoomCallInfo>({
    isCallActive: false,
    participantCount: 0,
    participants: [],
    canJoinCall: false,
  });

  useEffect(() => {
    const updateCallInfo = () => {
      try {
        // Check if MatrixRTC is available
        if (!mx.matrixRTC) {
          setCallInfo({
            isCallActive: false,
            participantCount: 0,
            participants: [],
            canJoinCall: false,
          });
          return;
        }

        // Get MatrixRTC session for the room
        const rtcSession = mx.matrixRTC.getRoomSession(room);
        
        if (!rtcSession) {
          setCallInfo({
            isCallActive: false,
            participantCount: 0,
            participants: [],
            canJoinCall: false,
          });
          return;
        }

        // Get call memberships
        const memberships = rtcSession.memberships || [];
        const participants = memberships
          .filter(m => m.sender)
          .map(m => m.sender!)
          .filter((sender, index, arr) => arr.indexOf(sender) === index); // Remove duplicates

        const isCallActive = participants.length > 0;
        const currentUserId = mx.getUserId();
        const canJoinCall = isCallActive && !participants.includes(currentUserId || '');

        setCallInfo({
          isCallActive,
          participantCount: participants.length,
          participants,
          canJoinCall,
        });
      } catch (error) {
        console.error('Error checking room call status:', error);
        setCallInfo({
          isCallActive: false,
          participantCount: 0,
          participants: [],
          canJoinCall: false,
        });
      }
    };

    // Initial update
    updateCallInfo();

    // Listen for MatrixRTC membership changes
    const handleMembershipChange = () => {
      updateCallInfo();
    };

    // Listen for room state changes (call member events)
    const handleRoomStateChange = () => {
      updateCallInfo();
    };

    // Try to listen for MatrixRTC events if available
    try {
      if (mx.matrixRTC && MatrixRTCSessionEvent) {
        const rtcSession = mx.matrixRTC.getRoomSession(room);
        if (rtcSession) {
          // Listen for membership changes using the correct event
          rtcSession.on(MatrixRTCSessionEvent.MembershipsChanged, handleMembershipChange);
        }
      }
    } catch (e) {
      console.warn('Failed to setup MatrixRTC listeners:', e);
    }

    // Listen for room state events as backup
    room.on(RoomStateEvent.Events, handleRoomStateChange);

    return () => {
      // Cleanup listeners
      try {
        if (mx.matrixRTC && MatrixRTCSessionEvent) {
          const rtcSession = mx.matrixRTC.getRoomSession(room);
          if (rtcSession) {
            rtcSession.off(MatrixRTCSessionEvent.MembershipsChanged, handleMembershipChange);
          }
        }
      } catch (e) {
        console.warn('Failed to cleanup MatrixRTC listeners:', e);
      }
      
      room.off(RoomStateEvent.Events, handleRoomStateChange);
    };
  }, [mx, room]);

  return callInfo;
}; 