import React from 'react';
import { IconButton, toRem } from 'folds';
import { Room } from 'matrix-js-sdk';
import VideoCallIcon from '../../../../public/icons/video-call.svg';
import VoiceCallIcon from '../../../../public/icons/voice-call.svg';

interface CallButtonsProps {
  room: Room;
  onElementCallStart?: (roomId: string) => void;
}

export function CallButtons({ room, onElementCallStart }: CallButtonsProps) {
  return (
    <>
      <IconButton
        aria-label="Start voice call"
        style={{ borderRadius: '100%', width: toRem(35), height: toRem(35) }}
      >
        <img src={VoiceCallIcon} alt="Voice Call" style={{ width: toRem(20), height: toRem(20) }} />
      </IconButton>

      <IconButton
        aria-label="Start video call"
        style={{ borderRadius: '100%', width: toRem(35), height: toRem(35) }}
      >
        <img src={VideoCallIcon} alt="Video Call" style={{ width: toRem(20), height: toRem(20) }} />
      </IconButton>
    </>
  );
}
