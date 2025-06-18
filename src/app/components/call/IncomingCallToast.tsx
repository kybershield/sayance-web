import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { Badge, Box, Button, Icon, Text, as, toRem, Icons } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { useElementCall } from '../../hooks/useElementCall';
import { CallType, PlatformCallType } from '../../types/call';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { audioManager } from '../../utils/audioManager';
import RingSound from '../../../../public/sound/ring.ogg';
import styles from './IncomingCallToast.module.css';

const MAX_RING_TIME_MS = 90 * 1000; // 90 seconds like element-web

export interface IncomingCallToastProps {
  notifyEvent: MatrixEvent;
  onDismiss: () => void;
}

export function IncomingCallToast({ notifyEvent, onDismiss }: IncomingCallToastProps) {
  const mx = useMatrixClient();
  const roomId = notifyEvent.getRoomId();
  const room = roomId ? mx.getRoom(roomId) : null;
  const elementCallHook = useElementCall(room!);
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');
  const audioRef = useRef<HTMLAudioElement | undefined>();
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Get call details from the event
  const callType = notifyEvent.getContent()?.call_type || 'voice';
  const senderId = notifyEvent.getSender();
  const senderName =
    room && senderId
      ? getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId
      : senderId ?? 'Unknown Caller';
  const roomName = room?.name ?? 'Unknown Room';

  // Don't render if no room or room ID
  if (!room || !roomId) {
    return null;
  }

  // Start playing ring sound
  useEffect(() => {
    if (notificationSound && audioManager.getHasUserGesture()) {
      audioManager.playSound(RingSound, { loop: true, volume: 0.8 }).then((audio) => {
        audioRef.current = audio;
      });
    } else if (notificationSound) {
      console.warn('Ring sound blocked - waiting for user interaction');
    }

    return () => {
      if (audioRef.current) {
        audioManager.stopSound(audioRef.current);
      }
    };
  }, [notificationSound]);

  // Auto-dismiss after MAX_RING_TIME_MS
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      onDismiss();
    }, MAX_RING_TIME_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onDismiss]);

  const handleJoin = useCallback(async () => {
    // Stop ring sound
    if (audioRef.current) {
      audioManager.stopSound(audioRef.current);
    }

    // Start Element Call
    try {
      const callTypeEnum = callType === 'voice' ? CallType.Voice : CallType.Video;
      elementCallHook.startCall(callTypeEnum, PlatformCallType.ElementCall);
      onDismiss();
    } catch (error) {
      console.error('Failed to join call:', error);
    }
  }, [callType, elementCallHook, onDismiss]);

  const handleDecline = useCallback(() => {
    // Stop ring sound
    if (audioRef.current) {
      audioManager.stopSound(audioRef.current);
    }
    onDismiss();
  }, [onDismiss]);

  const isVideoCall = callType === 'video';

  return (
    <div className={styles.incomingCallToast}>
      <div className={styles.toastHeader}>
        <Box gap="300" alignItems="Center">
          <Icon size="400" src={isVideoCall ? Icons.Play : Icons.Phone} />
          <Text size="T300" priority="400">
            Incoming {isVideoCall ? 'Video' : 'Voice'} Call
          </Text>
        </Box>
        <Badge variant="Secondary" size="300">
          Beta
        </Badge>
      </div>

      <div className={styles.toastContent}>
        <Text size="T400" priority="500" className={styles.callerName}>
          {senderName}
        </Text>
        <Text size="T200" priority="300" className={styles.roomName}>
          {roomName}
        </Text>
      </div>

      <div className={styles.buttonContainer}>
        <Button
          variant="Critical"
          size="300"
          radii="300"
          onClick={handleDecline}
          className={styles.declineButton}
        >
          <Icon size="200" src={Icons.Cross} />
          Decline
        </Button>
        <Button
          variant="Success"
          size="300"
          radii="300"
          onClick={handleJoin}
          className={styles.joinButton}
        >
          <Icon size="200" src={isVideoCall ? Icons.Play : Icons.Phone} />
          Join
        </Button>
      </div>
    </div>
  );
}
