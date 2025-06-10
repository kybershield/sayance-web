import { useCallback, useEffect, useState } from 'react';
import { Room, MatrixClient, CallEvent } from 'matrix-js-sdk';
import { MatrixCall, CallState as MatrixCallState, CallType as MatrixCallType, CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { useMatrixClient } from './useMatrixClient';

export enum CallState {
  Fledgling = 'fledgling',
  WaitLocalMedia = 'wait_local_media',
  CreateOffer = 'create_offer',
  InviteSent = 'invite_sent',
  Ringing = 'ringing',
  Connecting = 'connecting',
  Connected = 'connected',
  Ended = 'ended',
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
}

export type CallType = MatrixCallType;
export const CallType = MatrixCallType;

export interface CallInfo {
  callId?: string;
  roomId: string;
  type: CallType;
  state: CallState;
  direction: 'inbound' | 'outbound';
  isLocalOnHold: boolean;
  isRemoteOnHold: boolean;
  isMicrophoneMuted: boolean;
  isScreensharing: boolean;
  hasLocalUserMediaVideoTrack: boolean;
  hasRemoteUserMediaVideoTrack: boolean;
  participantCount: number;
  call?: MatrixCall; // Reference to the actual Matrix call
}

export interface CallStateHook {
  activeCall: CallInfo | null;
  incomingCall: CallInfo | null;
  isCallActive: (roomId?: string) => boolean;
  hasIncomingCall: () => boolean;
  canPlaceCall: (roomId: string) => boolean;
  placeCall: (roomId: string, type: CallType) => Promise<void>;
  answerCall: (roomId: string) => Promise<void>;
  hangupCall: (roomId: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  connectionState: ConnectionState;
}

// Simple call manager to track calls
class CallManager {
  private calls = new Map<string, MatrixCall>(); // roomId -> call
  private activeCall: CallInfo | null = null;
  private incomingCall: CallInfo | null = null;
  private listeners: Array<() => void> = [];

  addCall(roomId: string, call: MatrixCall) {
    if (this.calls.has(roomId)) {
      throw new Error(`Call already exists for room ${roomId}`);
    }
    this.calls.set(roomId, call);
  }

  removeCall(roomId: string) {
    const call = this.calls.get(roomId);
    if (call) {
      this.calls.delete(roomId);
    }
  }

  getCall(roomId: string): MatrixCall | undefined {
    return this.calls.get(roomId);
  }

  getAllCalls(): MatrixCall[] {
    return Array.from(this.calls.values());
  }

  setActiveCall(callInfo: CallInfo | null) {
    this.activeCall = callInfo;
    this.notifyListeners();
  }

  setIncomingCall(callInfo: CallInfo | null) {
    this.incomingCall = callInfo;
    this.notifyListeners();
  }

  getActiveCall(): CallInfo | null {
    return this.activeCall;
  }

  getIncomingCall(): CallInfo | null {
    return this.incomingCall;
  }

  addListener(callback: () => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: () => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

// Global call manager instance
const callManager = new CallManager();

const mapMatrixCallState = (matrixState: MatrixCallState): CallState => {
  switch (matrixState) {
    case MatrixCallState.Fledgling: return CallState.Fledgling;
    case MatrixCallState.WaitLocalMedia: return CallState.WaitLocalMedia;
    case MatrixCallState.CreateOffer: return CallState.CreateOffer;
    case MatrixCallState.InviteSent: return CallState.InviteSent;
    case MatrixCallState.Ringing: return CallState.Ringing;
    case MatrixCallState.Connecting: return CallState.Connecting;
    case MatrixCallState.Connected: return CallState.Connected;
    case MatrixCallState.Ended: return CallState.Ended;
    default: return CallState.Fledgling;
  }
};

const createCallInfo = (call: MatrixCall, direction: 'inbound' | 'outbound'): CallInfo => {
  // Helper function to safely call methods that might be getters
  const safeGetBoolean = (fn: any): boolean => {
    try {
      return typeof fn === 'function' ? fn() : fn;
    } catch {
      return false;
    }
  };

  // Enhanced video state detection
  const getVideoState = () => {
    try {
      // Try multiple methods to detect video state
      if (typeof (call as any).isLocalVideoMuted === 'function') {
        const muted = (call as any).isLocalVideoMuted();
        console.log('Video state via isLocalVideoMuted:', !muted);
        return !muted;
      }
      
      if (typeof (call as any).hasLocalUserMediaVideoTrack === 'function') {
        const hasTrack = (call as any).hasLocalUserMediaVideoTrack();
        console.log('Video state via hasLocalUserMediaVideoTrack:', hasTrack);
        return hasTrack;
      }

      // Check feeds for local video
      const feeds = call.getFeeds?.() || [];
      const localVideoFeed = feeds.find((feed: any) => 
        feed.isLocal?.() && feed.purpose === 'usermedia' && !feed.isVideoMuted?.()
      );
      const hasLocalVideo = !!localVideoFeed;
      console.log('Video state via feeds:', hasLocalVideo, 'feeds:', feeds.length);
      return hasLocalVideo;
    } catch (error) {
      console.warn('Error detecting video state:', error);
      return false;
    }
  };

  const callInfo = {
    callId: call.callId,
    roomId: call.roomId!,
    type: call.type,
    state: mapMatrixCallState(call.state),
    direction,
    isLocalOnHold: call.isLocalOnHold(),
    isRemoteOnHold: call.isRemoteOnHold(),
    isMicrophoneMuted: call.isMicrophoneMuted(),
    isScreensharing: safeGetBoolean((call as any).isScreensharing),
    hasLocalUserMediaVideoTrack: getVideoState(),
    hasRemoteUserMediaVideoTrack: safeGetBoolean((call as any).hasRemoteUserMediaVideoTrack),
    participantCount: 2, // Legacy calls are always 1-on-1
    call,
  };

  console.log('Created call info:', {
    callId: callInfo.callId,
    type: callInfo.type,
    state: callInfo.state,
    isMicrophoneMuted: callInfo.isMicrophoneMuted,
    hasLocalUserMediaVideoTrack: callInfo.hasLocalUserMediaVideoTrack,
  });

  return callInfo;
};

export const useCallState = (): CallStateHook => {
  const mx = useMatrixClient();
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);

  // Initialize call event handling
  useEffect(() => {
    const handleIncomingCall = (call: MatrixCall) => {
      console.log('Incoming call received:', call.callId, call.roomId);
      
      if (!call.roomId) {
        console.error('Incoming call has no room ID');
        return;
      }

      // Check if we already have a call in this room
      if (callManager.getCall(call.roomId)) {
        console.warn('Already have a call in room', call.roomId);
        return;
      }

      // Add call to manager
      callManager.addCall(call.roomId, call);

      // Create call info
      const callInfo = createCallInfo(call, 'inbound');
      
      // Set up call event listeners
      const handleStateChange = () => {
        const updatedCallInfo = createCallInfo(call, 'inbound');
        
        if (call.state === MatrixCallState.Ended) {
          // Call ended
          callManager.removeCall(call.roomId!);
          if (callManager.getIncomingCall()?.callId === call.callId) {
            callManager.setIncomingCall(null);
          }
          if (callManager.getActiveCall()?.callId === call.callId) {
            callManager.setActiveCall(null);
          }
          setConnectionState(ConnectionState.Disconnected);
        } else if (call.state === MatrixCallState.Connected) {
          // Call connected
          callManager.setActiveCall(updatedCallInfo);
          callManager.setIncomingCall(null);
          setConnectionState(ConnectionState.Connected);
        } else {
          // Update call info
          if (callManager.getIncomingCall()?.callId === call.callId) {
            callManager.setIncomingCall(updatedCallInfo);
          }
          if (callManager.getActiveCall()?.callId === call.callId) {
            callManager.setActiveCall(updatedCallInfo);
          }
        }
      };

      const handleHangup = () => {
        console.log('Call hung up:', call.callId);
        callManager.removeCall(call.roomId!);
        if (callManager.getIncomingCall()?.callId === call.callId) {
          callManager.setIncomingCall(null);
        }
        if (callManager.getActiveCall()?.callId === call.callId) {
          callManager.setActiveCall(null);
        }
        setConnectionState(ConnectionState.Disconnected);
        
        // Clean up listeners
        call.removeAllListeners();
      };

      call.on(CallEvent.State, handleStateChange);
      call.on(CallEvent.Hangup, handleHangup);
      call.on(CallEvent.Error, handleHangup);

      // Set as incoming call
      callManager.setIncomingCall(callInfo);
    };

    // Listen for incoming calls on the Matrix client
    mx.on(CallEventHandlerEvent.Incoming, handleIncomingCall);

    // Set up call manager listener
    const handleCallManagerUpdate = () => {
      setActiveCall(callManager.getActiveCall());
      setIncomingCall(callManager.getIncomingCall());
    };

    callManager.addListener(handleCallManagerUpdate);

    return () => {
      mx.removeListener(CallEventHandlerEvent.Incoming, handleIncomingCall);
      callManager.removeListener(handleCallManagerUpdate);
    };
  }, [mx]);

  const isCallActive = useCallback((roomId?: string) => {
    const active = callManager.getActiveCall();
    if (!active) return false;
    if (roomId) return active.roomId === roomId;
    return true;
  }, []);

  const hasIncomingCall = useCallback(() => {
    return callManager.getIncomingCall() !== null;
  }, []);

  const canPlaceCall = useCallback((roomId: string) => {
    // Can't place call if already in a call
    if (callManager.getActiveCall() || callManager.getIncomingCall()) return false;
    
    const room = mx.getRoom(roomId);
    if (!room) return false;
    
    // Check if user has permission to call
    const myUserId = mx.getUserId();
    if (!myUserId) return false;
    
    // Check if client supports VoIP
    if (!mx.supportsVoip()) return false;
    
    return true;
  }, [mx]);

  const placeCall = useCallback(async (roomId: string, type: CallType) => {
    if (!canPlaceCall(roomId)) {
      throw new Error('Cannot place call in current state');
    }

    console.log(`Placing ${type} call in room ${roomId}`);

    try {
      setConnectionState(ConnectionState.Connecting);
      
      // Create matrix call using the Matrix client
      const call = mx.createCall(roomId);
      if (!call) {
        throw new Error('Failed to create call');
      }

      // Add to call manager
      callManager.addCall(roomId, call);

      // Create call info
      const callInfo = createCallInfo(call, 'outbound');

      // Set up call event listeners
      const handleStateChange = () => {
        const updatedCallInfo = createCallInfo(call, 'outbound');
        
        if (call.state === MatrixCallState.Ended) {
          // Call ended
          callManager.removeCall(roomId);
          callManager.setActiveCall(null);
          setConnectionState(ConnectionState.Disconnected);
        } else if (call.state === MatrixCallState.Connected) {
          // Call connected
          callManager.setActiveCall(updatedCallInfo);
          setConnectionState(ConnectionState.Connected);
        } else {
          // Update call info
          callManager.setActiveCall(updatedCallInfo);
        }
      };

      const handleHangup = () => {
        console.log('Outbound call hung up:', call.callId);
        callManager.removeCall(roomId);
        callManager.setActiveCall(null);
        setConnectionState(ConnectionState.Disconnected);
        
        // Clean up listeners
        call.removeAllListeners();
      };

      call.on(CallEvent.State, handleStateChange);
      call.on(CallEvent.Hangup, handleHangup);
      call.on(CallEvent.Error, handleHangup);

      // Set as active call immediately
      callManager.setActiveCall(callInfo);

      // Place the call
      if (type === CallType.Voice) {
        await call.placeVoiceCall();
      } else if (type === CallType.Video) {
        await call.placeVideoCall();
      } else {
        throw new Error(`Unknown call type: ${type}`);
      }

      console.log('Call placed successfully');
    } catch (error) {
      console.error('Failed to place call:', error);
      callManager.removeCall(roomId);
      callManager.setActiveCall(null);
      setConnectionState(ConnectionState.Disconnected);
      throw error;
    }
  }, [mx, canPlaceCall]);

  const answerCall = useCallback(async (roomId: string) => {
    const incoming = callManager.getIncomingCall();
    if (!incoming || incoming.roomId !== roomId || !incoming.call) {
      throw new Error('No incoming call to answer');
    }

    try {
      console.log('Answering call:', incoming.callId);
      setConnectionState(ConnectionState.Connecting);
      
      await incoming.call.answer();
      
      // The call state change will be handled by the event listener
    } catch (error) {
      console.error('Failed to answer call:', error);
      setConnectionState(ConnectionState.Disconnected);
      throw error;
    }
  }, []);

  const hangupCall = useCallback(async (roomId: string) => {
    const call = callManager.getCall(roomId);
    if (!call) {
      console.warn('No call to hang up in room', roomId);
      return;
    }

    try {
      console.log('Hanging up call:', call.callId);
      
      if (callManager.getIncomingCall()?.roomId === roomId) {
        // Reject incoming call
        call.reject();
      } else {
        // Hang up active call
        call.hangup(CallErrorCode.UserHangup, false);
      }
      
      // The call end will be handled by the event listener
    } catch (error) {
      console.error('Failed to hang up call:', error);
      throw error;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const active = callManager.getActiveCall();
    if (!active?.call) return;
    
    try {
      const currentlyMuted = active.call.isMicrophoneMuted();
      active.call.setMicrophoneMuted(!currentlyMuted);
      console.log('Toggled microphone mute:', !currentlyMuted);
      
      // Force update the call info to reflect the change
      setTimeout(() => {
        if (active.call) {
          const updatedCallInfo = createCallInfo(active.call, active.direction);
          callManager.setActiveCall(updatedCallInfo);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const active = callManager.getActiveCall();
    if (!active?.call) return;
    
    try {
      // Check if setLocalVideoMuted method exists and use it
      if (typeof (active.call as any).setLocalVideoMuted === 'function') {
        const currentlyMuted = (active.call as any).isLocalVideoMuted?.() || false;
        (active.call as any).setLocalVideoMuted(!currentlyMuted);
        console.log('Toggled video mute:', !currentlyMuted);
      } else if (typeof (active.call as any).setVideoMuted === 'function') {
        // Alternative method name
        const currentlyMuted = (active.call as any).isVideoMuted?.() || false;
        (active.call as any).setVideoMuted(!currentlyMuted);
        console.log('Toggled video mute (alt method):', !currentlyMuted);
      } else {
        console.warn('Video mute methods not available on call object');
        // Log available methods for debugging
        console.log('Available call methods:', Object.getOwnPropertyNames(active.call));
      }
      
      // Force update the call info to reflect the change
      setTimeout(() => {
        if (active.call) {
          const updatedCallInfo = createCallInfo(active.call, active.direction);
          callManager.setActiveCall(updatedCallInfo);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to toggle video:', error);
    }
  }, []);

  return {
    activeCall,
    incomingCall,
    isCallActive,
    hasIncomingCall,
    canPlaceCall,
    placeCall,
    answerCall,
    hangupCall,
    toggleMute,
    toggleVideo,
    connectionState,
  };
}; 