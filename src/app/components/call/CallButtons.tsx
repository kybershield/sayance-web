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
  const {
    canStartCall,
    canJoinCall,
    disabledReason,
    startCall,
    joinCall,
    action,
    participantCount,
    isElementCallEnabled,
  } = useElementCall(room);

  const handleVoiceCall = () => {
    if (action === 'join' && canJoinCall) {
      joinCall(CallType.Voice, PlatformCallType.ElementCall);
      onElementCallStart?.(room.roomId);
    } else if (action === 'start' && canStartCall) {
      startCall(CallType.Voice, PlatformCallType.ElementCall);
      onElementCallStart?.(room.roomId);
    }
  };

  const handleVideoCall = () => {
    if (action === 'join' && canJoinCall) {
      joinCall(CallType.Video, PlatformCallType.ElementCall);
      onElementCallStart?.(room.roomId);
    } else if (action === 'start' && canStartCall) {
      startCall(CallType.Video, PlatformCallType.ElementCall);
      onElementCallStart?.(room.roomId);
    }
  };

  const isCallEnabled = (action === 'start' && canStartCall) || (action === 'join' && canJoinCall);

  const getButtonLabel = (baseLabel: string) => {
    if (action === 'join') {
      return `Join ${baseLabel.toLowerCase()}`;
    }
    return `Start ${baseLabel.toLowerCase()}`;
  };

  const getTooltipText = (baseText: string) => {
    if (action === 'join') {
      const participantText =
        participantCount === 1 ? '1 participant' : `${participantCount} participants`;
      return `Join ongoing call (${participantText})`;
    }
    return disabledReason || baseText;
  };

  const renderCallButton = (
    icon: string,
    alt: string,
    label: string,
    onClick: () => void,
    showBeta: boolean = false,
    baseTooltipText: string
  ) => {
    const buttonLabel = getButtonLabel(label);
    const tooltipText = getTooltipText(baseTooltipText);

    const button = (
      <IconButton
        aria-label={buttonLabel}
        style={{ borderRadius: '100%', width: toRem(35), height: toRem(35) }}
        onClick={onClick}
        disabled={!isCallEnabled}
      >
        <img
          src={icon}
          alt={alt}
          style={{
            width: toRem(20),
            height: toRem(20),
            opacity: isCallEnabled ? 1 : 0.5,
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
        'voice call',
        handleVoiceCall,
        true,
        'Start voice call'
      )}

      {renderCallButton(
        VideoCallIcon,
        'Video Call',
        'video call',
        handleVideoCall,
        true,
        'Start video call'
      )}
    </>
  );
}
