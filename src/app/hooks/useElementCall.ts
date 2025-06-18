import { Room } from 'matrix-js-sdk';
import { useCallback, useMemo } from 'react';
import { useClientConfig, ElementCallConfig } from './useClientConfig';
import { useMatrixClient } from './useMatrixClient';
import { PlatformCallType, CallType, CallPlatformTypeProps } from '../types/call';
import { sendCallNotification, isWidgetUrlAllowed, createElementCallWidget } from '../utils/elementCall';
import { startEmbeddedCall, useCallState } from './useCallState';

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
  disabledReason: string | null;
  availableCallTypes: PlatformCallType[];
  startCall: (callType: CallType, platformType: PlatformCallType) => void;
  isElementCallEnabled: boolean;
  callState: any; // Current call state for this room
}

export function useElementCall(room: Room): UseElementCallResult {
  const mx = useMatrixClient();
  const clientConfig = useClientConfig();
  const callState = useCallState(room);

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

  // Check permissions - simplified for now
  const canStartCall = useMemo(() => {
    if (!room || !mx) return false;
    if (!isElementCallEnabled) return false;
    if (!elementCallConfig?.url) return false;
    if (!isUrlAllowed) return false;
    
    // Don't allow starting a new call if there's already an active call
    if (callState?.isActive) return false;
    
    // Check if user has permission to start calls
    const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '');
    if (!powerLevels) return true; // Default to allowing if no power levels set
    
    const content = powerLevels.getContent();
    const userLevel = content.users?.[mx.getUserId()!] ?? content.users_default ?? 0;
    const requiredLevel = content.events?.['im.vector.modular.widgets'] ?? content.state_default ?? 50;
    
    return userLevel >= requiredLevel;
  }, [room, mx, isElementCallEnabled, elementCallConfig, isUrlAllowed, callState]);

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
    if (!isElementCallEnabled) {
      return 'Element Call is not enabled';
    }
    if (!elementCallConfig?.url) {
      return 'Element Call URL not configured';
    }
    if (!isUrlAllowed) {
      return 'Element Call URL not allowed';
    }
    if (callState?.isActive) {
      return 'Call already in progress';
    }
    if (!canStartCall) {
      return 'You do not have permission to start calls';
    }
    if (!room) {
      return 'Room not available';
    }
    
    // Check if there are any members in the room
    const memberCount = room.getJoinedMemberCount();
    if (memberCount <= 1) {
      return 'No one else is in this room';
    }
    
    return null;
  }, [isElementCallEnabled, elementCallConfig, isUrlAllowed, callState, canStartCall, room]);

  // Start call function
  const startCall = useCallback(async (callType: CallType, platformType: PlatformCallType) => {
    if (!canStartCall || !room || !elementCallConfig) return;
    
    if (platformType === PlatformCallType.ElementCall) {
      try {
        // Create Element Call widget with unique ID
        const widget = createElementCallWidget(mx, room.roomId, elementCallConfig, {
          skipLobby: false, // TODO: Make configurable
          returnToLobby: false,
        });
        
        console.log('Created Element Call widget:', widget);
        
        // Send call notification to room members
        await sendCallNotification(mx, room.roomId, callType);
        
        // Start embedded call tracking with widget
        startEmbeddedCall(room.roomId, callType, widget);
        
        console.log('Element Call started in embedded mode for room:', room.roomId, 'with widget ID:', widget.id);
      } catch (error) {
        console.error('Failed to start Element Call:', error);
      }
    }
    // Handle other platform types here
  }, [canStartCall, room, elementCallConfig, mx]);

  return {
    canStartCall: canStartCall && !disabledReason,
    disabledReason,
    availableCallTypes,
    startCall,
    isElementCallEnabled,
    callState,
  };
} 