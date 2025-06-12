import React, { useEffect, useRef } from 'react';
import { Box, Button, IconButton, Icon, Icons, Text } from 'folds';
import { Room } from 'matrix-js-sdk';
import { RoomAvatar } from '../room-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { partialMatrixIdToPhoneNumber } from '../../../util/functionsUtil';

interface IncomingCallToastProps {
  room: Room;
  type: 'voice' | 'video';
  onAnswer: () => void;
  onReject: () => void;
}

export function IncomingCallToast({ room, type, onAnswer, onReject }: IncomingCallToastProps) {
  const mx = useMatrixClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ring sound when component mounts
  useEffect(() => {
    const playRingSound = async () => {
      try {
        // Create audio element for ring sound
        const audio = new Audio();
        audioRef.current = audio;

        // Try to find a ring sound file (you may need to add this to your public folder)
        audio.src = '/sound/notification.ogg'; // Use existing notification sound
        audio.loop = true;
        audio.volume = 0.7;

        // Play the sound
        await audio.play();
      } catch (error) {
        console.warn('Could not play ring sound:', error);
        // Fallback: Use browser notification sound or vibration
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      }
    };

    playRingSound();

    // Cleanup function to stop the sound
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Stop the ring sound when call is answered or rejected
  const handleAnswer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onAnswer();
  };

  const handleReject = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onReject();
  };

  return (
    <Box
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '320px',
        padding: '16px',
        backgroundColor: 'var(--bg-surface-50)',
        borderRadius: '12px',
        border: '1px solid var(--bg-surface-300)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 1000,
        // Animation
        animation: 'slideInFromRight 0.3s ease-out',
      }}
      direction="Row"
      alignItems="Center"
      gap="200"
    >
      {/* Room Avatar */}
      {/* <Box shrink="No">
        <RoomAvatar
          roomId={room.roomId}
          renderFallback={() => (
            <Box
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon src={Icons.User} size="300" style={{ color: 'white' }} />
            </Box>
          )}
        />
      </Box> */}

      {/* Call Content */}
      <Box grow="Yes" direction="Column" gap="100">
        {/* Caller Name */}
        <Text size="T400" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
          {partialMatrixIdToPhoneNumber(room.name) || 'Unknown'}
        </Text>

        {/* Call Type with Icon */}
        <Box alignItems="Center" gap="100">
          <Icon
            src={type === 'video' ? Icons.Play : Icons.Phone}
            size="200"
            style={{ color: 'var(--text-secondary)' }}
          />
          <Text size="T300" style={{ color: 'var(--text-secondary)' }}>
            Incoming {type} call
          </Text>
        </Box>

        {/* Action Buttons */}
        <Box gap="200" justifyContent="End" style={{ marginTop: '8px' }}>
          <IconButton
            variant="Critical"
            onClick={handleReject}
            aria-label="Decline call"
            size="300"
          >
            <Icon src={Icons.Cross} size="200" />
          </IconButton>

          <Button
            variant="Primary"
            onClick={handleAnswer}
            aria-label="Accept call"
            size="300"
            style={{ minWidth: '80px' }}
          >
            <Icon src={type === 'video' ? Icons.Play : Icons.Phone} size="200" />
            <Text>Answer</Text>
          </Button>
        </Box>
      </Box>

      {/* Add CSS animation styles */}
      <style>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        /* Add pulsing animation to make it more noticeable */
        .incoming-call-toast {
          animation: slideInFromRight 0.3s ease-out, pulse 2s infinite;
        }
      `}</style>
    </Box>
  );
}
