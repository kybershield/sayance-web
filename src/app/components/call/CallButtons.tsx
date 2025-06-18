import React from 'react';
import { IconButton, toRem, Tooltip, TooltipProvider, Badge, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import VideoCallIcon from '../../../../public/icons/video-call.svg';
import VoiceCallIcon from '../../../../public/icons/voice-call.svg';
import { useElementCall } from '../../hooks/useElementCall';
import { CallType, PlatformCallType } from '../../types/call';

interface CallButtonsProps {
  room: Room;
  onElementCallStart?: (roomId: string) => void;
}

export function CallButtons({ room, onElementCallStart }: CallButtonsProps) {
  const { canStartCall, disabledReason, availableCallTypes, startCall, isElementCallEnabled } =
    useElementCall(room);

  const handleVoiceCall = () => {
    if (!canStartCall) return;

    // Use Element Call if available, fallback to other types
    const callType = availableCallTypes.includes(PlatformCallType.ElementCall)
      ? PlatformCallType.ElementCall
      : availableCallTypes[0];

    if (callType) {
      startCall(CallType.Voice, callType);
      onElementCallStart?.(room.roomId);
    }
  };

  const handleVideoCall = () => {
    if (!canStartCall) return;

    // Use Element Call if available, fallback to other types
    const callType = availableCallTypes.includes(PlatformCallType.ElementCall)
      ? PlatformCallType.ElementCall
      : availableCallTypes[0];

    if (callType) {
      startCall(CallType.Video, callType);
      onElementCallStart?.(room.roomId);
    }
  };

  const renderCallButton = (
    icon: string,
    alt: string,
    label: string,
    onClick: () => void,
    showBeta: boolean = false,
    tooltipText: string
  ) => {
    const button = (
      <IconButton
        aria-label={label}
        style={{ borderRadius: '100%', width: toRem(35), height: toRem(35) }}
        onClick={onClick}
        disabled={!canStartCall}
      >
        <img
          src={icon}
          alt={alt}
          style={{
            width: toRem(20),
            height: toRem(20),
            opacity: canStartCall ? 1 : 0.5,
          }}
        />
      </IconButton>
    );

    const buttonWithBadge = showBeta ? (
      <div style={{ position: 'relative' }}>
        {button}
        <Badge
          variant="Secondary"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            fontSize: '0.6rem',
            padding: '1px 4px',
          }}
        >
          β
        </Badge>
      </div>
    ) : (
      button
    );

    return (
      <TooltipProvider
        delay={400}
        position="Top"
        tooltip={
          <Tooltip style={{ maxWidth: toRem(280) }}>
            <Text size="H5">{tooltipText}</Text>
          </Tooltip>
        }
      >
        {(triggerRef) => <div ref={triggerRef}>{buttonWithBadge}</div>}
      </TooltipProvider>
    );
  };

  if (!isElementCallEnabled) {
    return null; // Don't render call buttons if Element Call is not enabled
  }

  return (
    <>
      {renderCallButton(
        VoiceCallIcon,
        'Voice Call',
        'Start voice call',
        handleVoiceCall,
        availableCallTypes.includes(PlatformCallType.ElementCall),
        disabledReason || 'Start voice call'
      )}

      {renderCallButton(
        VideoCallIcon,
        'Video Call',
        'Start video call',
        handleVideoCall,
        availableCallTypes.includes(PlatformCallType.ElementCall),
        disabledReason || 'Start video call'
      )}
    </>
  );
}
