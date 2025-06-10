import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, IconButton, Icon, Icons, Text, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import { Room, CallEvent } from 'matrix-js-sdk';
import { CallState as MatrixCallState } from 'matrix-js-sdk/lib/webrtc/call';
import { CallFeed, CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { MatrixCall } from 'matrix-js-sdk/lib/webrtc/call';
import { SDPStreamMetadataPurpose } from 'matrix-js-sdk/lib/webrtc/callEventTypes';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { CallState } from '../../hooks/useCallState';
import { RoomAvatar } from '../room-avatar';

interface LegacyCallViewProps {
  room: Room;
  callId: string;
  type: 'voice' | 'video';
  state: CallState;
  onHangup: () => void;
  onMuteToggle: () => void;
  onVideoToggle: () => void;
  isMuted: boolean;
  isVideoMuted: boolean;
  matrixCall?: MatrixCall;
}

interface VideoFeedProps {
  feed: CallFeed;
  call: MatrixCall;
  primary?: boolean;
  onResize?: () => void;
}

// VideoFeed component to handle individual media streams
function VideoFeed({ feed, call, primary, onResize }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioMuted, setAudioMuted] = useState(feed.isAudioMuted());
  const [videoMuted, setVideoMuted] = useState(feed.isVideoMuted());

  const playMedia = useCallback(async () => {
    const element = videoRef.current;
    if (!element || !feed.stream) return;

    // Audio is handled separately, video element is muted for display
    element.muted = true;
    element.srcObject = feed.stream;
    element.autoplay = true;

    try {
      await element.play();
    } catch (error) {
      console.warn('Failed to play video feed:', error);
    }
  }, [feed.stream]);

  const stopMedia = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;

    element.pause();
    element.removeAttribute('src');
    element.srcObject = null;
  }, []);

  useEffect(() => {
    const handleNewStream = () => {
      setAudioMuted(feed.isAudioMuted());
      setVideoMuted(feed.isVideoMuted());
      playMedia();
    };

    const handleMuteStateChanged = () => {
      setAudioMuted(feed.isAudioMuted());
      setVideoMuted(feed.isVideoMuted());
    };

    // Set up feed event listeners
    feed.addListener(CallFeedEvent.NewStream, handleNewStream);
    feed.addListener(CallFeedEvent.MuteStateChanged, handleMuteStateChanged);

    // Start volume monitoring for audio feeds
    if (feed.purpose === SDPStreamMetadataPurpose.Usermedia) {
      feed.measureVolumeActivity(true);
    }

    // Play media initially
    playMedia();

    return () => {
      feed.removeListener(CallFeedEvent.NewStream, handleNewStream);
      feed.removeListener(CallFeedEvent.MuteStateChanged, handleMuteStateChanged);

      if (feed.purpose === SDPStreamMetadataPurpose.Usermedia) {
        feed.measureVolumeActivity(false);
      }

      stopMedia();
    };
  }, [feed, playMedia, stopMedia]);

  // Handle stream changes
  useEffect(() => {
    playMedia();
  }, [feed.stream, videoMuted, playMedia]);

  if (videoMuted) {
    // Show avatar for muted video
    return (
      <Box
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--bg-surface-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: primary ? '0' : '8px',
        }}
      >
        <RoomAvatar
          roomId={call.roomId || ''}
          renderFallback={() => (
            <Box
              style={{
                width: primary ? '160px' : '48px',
                height: primary ? '160px' : '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon src={Icons.User} size={primary ? '600' : '400'} style={{ color: 'white' }} />
            </Box>
          )}
        />
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: primary ? '0' : '8px',
          transform: feed.isLocal() ? 'scaleX(-1)' : 'none', // Mirror local video
        }}
      />

      {/* Microphone indicator */}
      {!audioMuted && (
        <Box
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderRadius: '4px',
            padding: '4px',
          }}
        >
          <Icon src={Icons.VolumeHigh} size="200" style={{ color: 'white' }} />
        </Box>
      )}
    </Box>
  );
}

export function LegacyCallView({
  room,
  callId,
  type,
  state,
  onHangup,
  onMuteToggle,
  onVideoToggle,
  isMuted,
  isVideoMuted,
  matrixCall,
}: LegacyCallViewProps) {
  const mx = useMatrixClient();
  const [call, setCall] = useState<MatrixCall | null>(null);
  const [callState, setCallState] = useState<MatrixCallState>(MatrixCallState.Fledgling);
  const [feeds, setFeeds] = useState<CallFeed[]>([]);
  const [isLocalOnHold, setIsLocalOnHold] = useState(false);
  const [isRemoteOnHold, setIsRemoteOnHold] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Find the call object
  useEffect(() => {
    // Use the passed matrixCall if available
    if (matrixCall) {
      setCall(matrixCall);
      setCallState(matrixCall.state);
      setFeeds(matrixCall.getFeeds());
      setIsLocalOnHold(matrixCall.isLocalOnHold());
      setIsRemoteOnHold(matrixCall.isRemoteOnHold());
      return;
    }

    // Fallback: try to find the call if not passed directly
    const findCall = () => {
      // Try different approaches to find the call
      try {
        // Check if there are any calls in the client
        const allCalls = (mx as any).callEventHandler?.calls || new Map();
        for (const call of allCalls.values()) {
          if (call.callId === callId || call.roomId === room.roomId) {
            return call;
          }
        }

        // Alternative: check for calls in a different way
        if ((mx as any).calls) {
          const matrixCall = (mx as any).calls.find(
            (c: MatrixCall) => c.callId === callId || c.roomId === room.roomId
          );
          if (matrixCall) return matrixCall;
        }
      } catch (error) {
        console.warn('Error finding call:', error);
      }

      return null;
    };

    const foundCall = findCall();
    if (foundCall) {
      setCall(foundCall);
      setCallState(foundCall.state);
      setFeeds(foundCall.getFeeds());
      setIsLocalOnHold(foundCall.isLocalOnHold());
      setIsRemoteOnHold(foundCall.isRemoteOnHold());
    } else {
      // If we can't find the call, we'll still render the UI with the state we have
      console.warn('Could not find MatrixCall object, using basic UI');
    }
  }, [mx, callId, room.roomId, matrixCall]);

  // Handle audio for remote streams
  useEffect(() => {
    if (!call || !feeds.length) return;

    // Find remote audio feed
    const remoteAudioFeed = feeds.find((feed) => !feed.isLocal() && !feed.isAudioMuted());

    if (remoteAudioFeed && remoteAudioFeed.stream && audioRef.current) {
      const audioElement = audioRef.current;
      audioElement.srcObject = remoteAudioFeed.stream;
      audioElement.autoplay = true;
      audioElement.muted = false; // We want to hear the audio

      audioElement.play().catch((error) => {
        console.warn('Failed to play remote audio:', error);
      });
    }
  }, [call, feeds]);

  // Set up call event listeners
  useEffect(() => {
    if (!call) return;

    const handleCallStateChange = (state: MatrixCallState) => {
      console.log('Call state changed:', state);
      setCallState(state);
    };

    const handleFeedsChanged = (newFeeds: CallFeed[]) => {
      console.log('Feeds changed:', newFeeds);
      setFeeds(newFeeds);
    };

    const handleLocalHoldUnhold = () => {
      setIsLocalOnHold(call.isLocalOnHold());
    };

    const handleRemoteHoldUnhold = () => {
      setIsRemoteOnHold(call.isRemoteOnHold());
      setIsLocalOnHold(call.isLocalOnHold());
    };

    call.on(CallEvent.State, handleCallStateChange);
    call.on(CallEvent.FeedsChanged, handleFeedsChanged);
    call.on(CallEvent.LocalHoldUnhold, handleLocalHoldUnhold);
    call.on(CallEvent.RemoteHoldUnhold, handleRemoteHoldUnhold);

    return () => {
      call.removeListener(CallEvent.State, handleCallStateChange);
      call.removeListener(CallEvent.FeedsChanged, handleFeedsChanged);
      call.removeListener(CallEvent.LocalHoldUnhold, handleLocalHoldUnhold);
      call.removeListener(CallEvent.RemoteHoldUnhold, handleRemoteHoldUnhold);
    };
  }, [call]);

  // Organize feeds into primary and secondary
  const getOrderedFeeds = (feedList: CallFeed[]) => {
    if (feedList.length <= 2) {
      return {
        primary: feedList.find((feed) => !feed.isLocal()), // Remote feed is primary
        secondary: feedList.find((feed) => feed.isLocal()), // Local feed is secondary
      };
    }

    // For multiple feeds, prioritize screenshare
    const screensharingFeeds = feedList.filter(
      (feed) => feed.purpose === SDPStreamMetadataPurpose.Screenshare
    );
    const primary =
      screensharingFeeds.find((feed) => !feed.isLocal()) ||
      screensharingFeeds[0] ||
      feedList.find((feed) => !feed.isLocal());

    return {
      primary,
      secondary: feedList.find((feed) => feed.isLocal()),
    };
  };

  const { primary: primaryFeed, secondary: secondaryFeed } = getOrderedFeeds(feeds);

  const renderCallControls = () => (
    <Box
      direction="Row"
      gap="300"
      alignItems="Center"
      justifyContent="Center"
      style={{
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: '16px 24px',
        borderRadius: '20px',
        zIndex: 10,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <IconButton
        variant={isMuted ? 'Critical' : 'Surface'}
        onClick={() => {
          console.log('Mute button clicked, current state:', isMuted);
          onMuteToggle();
        }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        size="500"
        style={{
          background: isMuted ? 'var(--bg-critical)' : 'rgba(255,255,255,0.1)',
          border: isMuted ? '2px solid var(--bg-critical)' : '2px solid rgba(255,255,255,0.2)',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon
          src={isMuted ? Icons.VolumeMute : Icons.VolumeHigh}
          size="300"
          style={{ color: 'white' }}
        />
      </IconButton>

      {type === 'video' && (
        <IconButton
          variant={isVideoMuted ? 'Critical' : 'Surface'}
          onClick={() => {
            console.log('Video button clicked, current state:', isVideoMuted);
            onVideoToggle();
          }}
          aria-label={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          size="500"
          style={{
            background: isVideoMuted ? 'var(--bg-critical)' : 'rgba(255,255,255,0.1)',
            border: isVideoMuted
              ? '2px solid var(--bg-critical)'
              : '2px solid rgba(255,255,255,0.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <Icon
            src={isVideoMuted ? Icons.EyeBlind : Icons.Eye}
            size="300"
            style={{ color: 'white' }}
          />
        </IconButton>
      )}

      <IconButton
        variant="Critical"
        onClick={() => {
          console.log('Hangup button clicked');
          onHangup();
        }}
        aria-label="Hang up"
        size="500"
        style={{
          background: 'var(--bg-critical)',
          border: '2px solid var(--bg-critical)',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon src={Icons.Cross} size="300" style={{ color: 'white' }} />
      </IconButton>
    </Box>
  );

  const renderConnectionStatus = () => {
    let statusText = '';
    switch (callState) {
      case MatrixCallState.WaitLocalMedia:
        statusText = 'Requesting media permissions...';
        break;
      case MatrixCallState.CreateOffer:
      case MatrixCallState.InviteSent:
        statusText = 'Calling...';
        break;
      case MatrixCallState.Ringing:
        statusText = 'Ringing...';
        break;
      case MatrixCallState.Connecting:
        statusText = 'Connecting...';
        break;
      case MatrixCallState.Connected:
        if (isLocalOnHold) statusText = 'Call on hold';
        else if (isRemoteOnHold) statusText = `${room.name} has put the call on hold`;
        break;
      default:
        if (feeds.length === 0) statusText = 'Connecting...';
    }

    if (statusText) {
      return (
        <Box
          style={{
            position: 'absolute',
            top: '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: '12px 20px',
            borderRadius: '12px',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <Text style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{statusText}</Text>
        </Box>
      );
    }

    return null;
  };

  const renderVideoCall = () => (
    <Box
      style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: 'black' }}
    >
      {/* Primary feed (remote user) */}
      {primaryFeed && <VideoFeed feed={primaryFeed} call={call!} primary />}

      {/* Secondary feed (local user) - Picture in Picture */}
      {secondaryFeed && !secondaryFeed.isVideoMuted() && (
        <Box
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '200px',
            height: '150px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid white',
            zIndex: 5,
          }}
        >
          <VideoFeed feed={secondaryFeed} call={call!} />
        </Box>
      )}

      {renderConnectionStatus()}
      {renderCallControls()}
    </Box>
  );

  const renderVoiceCall = () => (
    <Box
      direction="Column"
      alignItems="Center"
      justifyContent="Center"
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-surface-100)',
        position: 'relative',
      }}
    >
      {/* Voice Call Info Card - Top Right */}
      <Box
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '280px',
          padding: '16px',
          backgroundColor: 'var(--bg-surface-50)',
          borderRadius: '12px',
          border: '1px solid var(--bg-surface-300)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
        direction="Column"
        gap="200"
      >
        {/* Participant Name */}
        <Text size="H4" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
          {room.name || 'Unknown'}
        </Text>

        {/* Call Type with Icon */}
        <Box alignItems="Center" gap="100">
          <Icon src={Icons.Phone} size="200" style={{ color: 'var(--accent-brand)' }} />
          <Text size="T300" style={{ color: 'var(--text-secondary)' }}>
            Voice call active
          </Text>
        </Box>

        {/* Call Duration or Status */}
        <Box alignItems="Center" gap="100">
          <Box
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                callState === MatrixCallState.Connected
                  ? 'var(--accent-positive)'
                  : 'var(--accent-caution)',
              animation: callState === MatrixCallState.Connected ? 'none' : 'pulse 2s infinite',
            }}
          />
          <Text size="T300" style={{ color: 'var(--text-secondary)' }}>
            {callState === MatrixCallState.Connected ? 'Connected' : 'Connecting...'}
          </Text>
        </Box>
      </Box>

      {renderConnectionStatus()}
      {renderCallControls()}

      {/* Add CSS for the pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );

  return (
    <Overlay open={true} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        {/* Hidden audio element for voice calls */}
        <audio ref={audioRef} style={{ display: 'none' }} />

        {type === 'video' ? renderVideoCall() : renderVoiceCall()}
      </OverlayCenter>
    </Overlay>
  );
}
