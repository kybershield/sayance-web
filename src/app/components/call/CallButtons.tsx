import React, { useCallback } from 'react';
import { IconButton, Icon, Icons, Button } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useCallState, CallType } from '../../hooks/useCallState';
import { useRoomCall } from '../../hooks/useRoomCall';

interface CallButtonsProps {
  room: Room;
  onElementCallStart?: (roomId: string) => void;
}

export function CallButtons({ room, onElementCallStart }: CallButtonsProps) {
  const { canPlaceCall, placeCall, isCallActive } = useCallState();
  const roomCallInfo = useRoomCall(room);

  const roomId = room.roomId;
  const canCall = canPlaceCall(roomId);
  const hasActiveCall = isCallActive(roomId);

  const handleVoiceCall = useCallback(async () => {
    if (!canCall) return;

    try {
      await placeCall(roomId, CallType.Voice);
    } catch (error) {
      console.error('Failed to start voice call:', error);
    }
  }, [canCall, placeCall, roomId]);

  const handleVideoCall = useCallback(async () => {
    if (!canCall) return;

    try {
      await placeCall(roomId, CallType.Video);
    } catch (error) {
      console.error('Failed to start video call:', error);
    }
  }, [canCall, placeCall, roomId]);

  const handleElementCall = useCallback(() => {
    if (onElementCallStart) {
      onElementCallStart(roomId);
    }
  }, [onElementCallStart, roomId]);

  // Determine which call buttons to show
  const memberCount = room.getJoinedMemberCount();
  const showLegacyCall = memberCount <= 2;
  const showElementCall = memberCount > 2 || roomCallInfo.isCallActive;

  if (hasActiveCall) {
    return (
      <IconButton variant="Primary" disabled aria-label="Call in progress">
        <Icon src={Icons.Phone} size="200" />
      </IconButton>
    );
  }

  return (
    <>
      {showLegacyCall && (
        <>
          <IconButton
            variant="Background"
            onClick={handleVoiceCall}
            disabled={!canCall}
            aria-label="Start voice call"
          >
            <Icon src={Icons.Phone} size="200" />
          </IconButton>

          <IconButton
            variant="Background"
            onClick={handleVideoCall}
            disabled={!canCall}
            aria-label="Start video call"
          >
            <Icon src={Icons.Play} size="200" />
          </IconButton>
        </>
      )}

      {showElementCall && (
        <>
          {roomCallInfo.isCallActive ? (
            <Button
              variant="Primary"
              size="300"
              onClick={handleElementCall}
              aria-label="Join ongoing call"
            >
              <Icon src={Icons.Play} size="200" />
              Join Call
            </Button>
          ) : (
            <IconButton
              variant="Background"
              onClick={handleElementCall}
              aria-label="Start group call"
            >
              <Icon src={Icons.Play} size="200" />
            </IconButton>
          )}
        </>
      )}
    </>
  );
}
