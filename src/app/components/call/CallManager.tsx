import React, { useEffect } from 'react';
import { useCallState, CallState } from '../../hooks/useCallState';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { LegacyCallView } from './LegacyCallView';
import { IncomingCallToast } from './IncomingCallToast';
import { VideoCall } from '../video-call/VideoCall';

interface CallManagerProps {
  // Additional props for Element Call integration
  elementCallRoomId?: string;
  onElementCallClose?: () => void;
}

export function CallManager({ elementCallRoomId, onElementCallClose }: CallManagerProps) {
  const mx = useMatrixClient();
  const { activeCall, incomingCall, answerCall, hangupCall, toggleMute, toggleVideo } =
    useCallState();

  // Handle incoming call notifications
  useEffect(() => {
    if (incomingCall) {
      console.log('Incoming call received in CallManager:', {
        roomId: incomingCall.roomId,
        type: incomingCall.type,
        callId: incomingCall.callId,
      });

      // Request permission for notifications if needed
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }

      // Show browser notification as backup
      if (Notification.permission === 'granted') {
        const room = mx.getRoom(incomingCall.roomId);
        const callTypeText = incomingCall.type === 'voice' ? 'voice' : 'video';
        new Notification(`Incoming ${callTypeText} call`, {
          body: `From ${room?.name || 'Unknown'}`,
          icon: '/favicon.ico',
          tag: 'call-notification',
          requireInteraction: true, // Keep notification until user interacts
        });
      }
    }
  }, [incomingCall, mx]);

  const handleAnswerCall = async () => {
    if (!incomingCall) return;

    try {
      console.log('Answering call:', incomingCall.callId);
      await answerCall(incomingCall.roomId);
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;

    try {
      console.log('Rejecting call:', incomingCall.callId);
      await hangupCall(incomingCall.roomId);
    } catch (error) {
      console.error('Failed to reject call:', error);
    }
  };

  const handleHangupActiveCall = async () => {
    if (!activeCall) return;

    try {
      console.log('Hanging up active call:', activeCall.callId);
      await hangupCall(activeCall.roomId);
    } catch (error) {
      console.error('Failed to hang up call:', error);
    }
  };

  return (
    <>
      {/* Incoming Call Toast */}
      {incomingCall && (
        <IncomingCallToast
          room={mx.getRoom(incomingCall.roomId)!}
          type={incomingCall.type === 'voice' ? 'voice' : 'video'}
          onAnswer={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Active Legacy Call View */}
      {activeCall && activeCall.participantCount <= 2 && (
        <LegacyCallView
          room={mx.getRoom(activeCall.roomId)!}
          callId={activeCall.callId || ''}
          type={activeCall.type === 'voice' ? 'voice' : 'video'}
          state={activeCall.state}
          onHangup={handleHangupActiveCall}
          onMuteToggle={toggleMute}
          onVideoToggle={toggleVideo}
          isMuted={activeCall.isMicrophoneMuted}
          isVideoMuted={!activeCall.hasLocalUserMediaVideoTrack}
          matrixCall={activeCall.call}
        />
      )}

      {/* Element Call Widget for Group Calls */}
      {elementCallRoomId && (
        <VideoCall
          roomId={elementCallRoomId}
          isOpen={!!elementCallRoomId}
          onClose={onElementCallClose || (() => {})}
        />
      )}
    </>
  );
}
