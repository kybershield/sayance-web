import { Room } from 'matrix-js-sdk';
import { useCallback, useMemo } from 'react';
import { useClientConfig, ElementCallConfig } from './useClientConfig';
import { useMatrixClient } from './useMatrixClient';
import { PlatformCallType, CallType, CallPlatformTypeProps } from '../types/call';
import { sendCallNotification, isWidgetUrlAllowed, createElementCallWidget } from '../utils/elementCall';
import { startEmbeddedCall, useCallState } from './useCallState';
import { useCallAction } from './useMatrixRTCCall';

export const getPlatformCallTypeProps = (
  platformCallType: PlatformCallType
): CallPlatformTypeProps => {
  switch (platformCallType) {
    case PlatformCallType.ElementCall:
      return {
        label: 'Element Call',
        analyticsName: 'WebVoipOptionElementCall',
        isBeta: true,
      };
    case PlatformCallType.JitsiCall:
      return {
        label: 'Jitsi Call',
        analyticsName: 'WebVoipOptionJitsi',
      };
    case PlatformCallType.LegacyCall:
      return {
        label: 'Legacy Call',
        analyticsName: 'WebVoipOptionLegacy',
      };
  }
};

export interface UseElementCallResult {
  canStartCall: boolean;
  canJoinCall: boolean;
  disabledReason: string | null;
  availableCallTypes: PlatformCallType[];
  startCall: (callType: CallType, platformType: PlatformCallType) => void;
  joinCall: (callType: CallType, platformType: PlatformCallType) => void;
  action: 'start' | 'join' | 'disabled';
  participantCount: number;
  isElementCallEnabled: boolean;
  callState: any; // Current call state for this room
}

export function useElementCall(room: Room): UseElementCallResult {
  const mx = useMatrixClient();
  const clientConfig = useClientConfig();
  const callState = useCallState(room);
  const callAction = useCallAction(room);

  // Check if Element Call is enabled in configuration
  const isElementCallEnabled = useMemo(() => {
    return !!(clientConfig.featuresEnabled?.elementCallEnabled);
  }, [clientConfig]);

  // Check if Element Call is configured
  const elementCallConfig = useMemo(() => {
    return clientConfig.elementCall;
  }, [clientConfig]);

  // Check if Element Call URL is allowed
  const isUrlAllowed = useMemo(() => {
    if (!elementCallConfig?.url) return false;
    return isWidgetUrlAllowed(elementCallConfig.url, clientConfig.allowedWidgets);
  }, [elementCallConfig?.url, clientConfig.allowedWidgets]);

  // Check basic prerequisites
  const hasBasicRequirements = useMemo(() => {
    return !!(room && mx && isElementCallEnabled && elementCallConfig?.url && isUrlAllowed);
  }, [room, mx, isElementCallEnabled, elementCallConfig, isUrlAllowed]);

  // Check permissions
  const hasPermissions = useMemo(() => {
    if (!hasBasicRequirements) return false;
    
    // Check if user has permission to start calls
    const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '');
    if (!powerLevels) return true; // Default to allowing if no power levels set
    
    const content = powerLevels.getContent();
    const userLevel = content.users?.[mx.getUserId()!] ?? content.users_default ?? 0;
    const requiredLevel = content.events?.['im.vector.modular.widgets'] ?? content.state_default ?? 50;
    
    return userLevel >= requiredLevel;
  }, [hasBasicRequirements, room, mx]);

  // Determine if can start or join based on call action
  const canStartCall = useMemo(() => {
    return hasBasicRequirements && hasPermissions && callAction.action === 'start';
  }, [hasBasicRequirements, hasPermissions, callAction.action]);

  const canJoinCall = useMemo(() => {
    return hasBasicRequirements && hasPermissions && callAction.action === 'join';
  }, [hasBasicRequirements, hasPermissions, callAction.action]);

  // Determine available call types
  const availableCallTypes = useMemo((): PlatformCallType[] => {
    const types: PlatformCallType[] = [];
    
    if (isElementCallEnabled && elementCallConfig?.url && isUrlAllowed) {
      types.push(PlatformCallType.ElementCall);
    }
    
    // Could add Jitsi and Legacy call support here
    
    return types;
  }, [isElementCallEnabled, elementCallConfig, isUrlAllowed]);

  // Determine disabled reason
  const disabledReason = useMemo((): string | null => {
    if (callAction.reason) {
      return callAction.reason;
    }
    if (!isElementCallEnabled) {
      return 'Element Call is not enabled';
    }
    if (!elementCallConfig?.url) {
      return 'Element Call URL not configured';
    }
    if (!isUrlAllowed) {
      return 'Element Call URL not allowed';
    }
    if (!hasPermissions) {
      return 'You do not have permission to start calls';
    }
    if (!room) {
      return 'Room not available';
    }
    
    // Check if there are any members in the room for starting new calls
    if (callAction.action === 'start') {
      const memberCount = room.getJoinedMemberCount();
      if (memberCount <= 1) {
        return 'No one else is in this room';
      }
    }
    
    return null;
  }, [callAction, isElementCallEnabled, elementCallConfig, isUrlAllowed, hasPermissions, room]);

  // Start call function (creates a new call)
  const startCall = useCallback(async (callType: CallType, platformType: PlatformCallType) => {
    if (!canStartCall || !room || !elementCallConfig) return;
    
    if (platformType === PlatformCallType.ElementCall) {
      try {
        // Create Element Call widget with unique ID
        const widget = createElementCallWidget(mx, room.roomId, elementCallConfig, {
          skipLobby: false, // TODO: Make configurable
          returnToLobby: false,
          action: 'start',
        });
        
        console.log('Created Element Call widget for new call:', widget);
        
        // Send call notification to room members
        // await sendCallNotification(mx, room.roomId, callType);
        
        // Start embedded call tracking with widget
        startEmbeddedCall(room.roomId, callType, widget);
        
        console.log('Element Call started in embedded mode for room:', room.roomId, 'with widget ID:', widget.id);
      } catch (error) {
        console.error('Failed to start Element Call:', error);
      }
    }
    // Handle other platform types here
  }, [canStartCall, room, elementCallConfig, mx]);

  // Join call function (joins existing call)
  const joinCall = useCallback(async (callType: CallType, platformType: PlatformCallType) => {
    if (!canJoinCall || !room || !elementCallConfig) return;
    
    if (platformType === PlatformCallType.ElementCall) {
      try {
        // For joining, reuse existing widget or create one that connects to existing session
        let widget = callAction.callState.widget;
        
        if (!widget) {
          // Create widget that will join the existing session
          widget = createElementCallWidget(mx, room.roomId, elementCallConfig, {
            skipLobby: false, // Show lobby to let user configure devices before joining
            returnToLobby: false,
            action: 'join',
          });
          console.log('Created Element Call widget for joining existing call:', widget);
        } else {
          console.log('Reusing existing Element Call widget for joining:', widget);
        }
        
        // Start embedded call tracking with widget (joining existing session)
        startEmbeddedCall(room.roomId, callType, widget);
        
        console.log('Joining existing Element Call in room:', room.roomId, 'with', callAction.callState.participantCount, 'participants');
      } catch (error) {
        console.error('Failed to join Element Call:', error);
      }
    }
    // Handle other platform types here
  }, [canJoinCall, room, elementCallConfig, mx, callAction.callState]);

  return {
    canStartCall: canStartCall && !disabledReason,
    canJoinCall: canJoinCall && !disabledReason,
    disabledReason,
    availableCallTypes,
    startCall,
    joinCall,
    action: callAction.action,
    participantCount: callAction.callState.participantCount,
    isElementCallEnabled,
    callState,
  };
} 