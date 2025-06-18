import React from 'react';
import { Room } from 'matrix-js-sdk';
import { IconButton, toRem } from 'folds';
import { ElementCallWidget } from './ElementCallWidget';
import { useCallView } from '../../hooks/useCallView';
import styles from './RoomCallView.module.css';

interface RoomCallViewProps {
  room: Room;
  className?: string;
}

export function RoomCallView({ room, className }: RoomCallViewProps) {
  const { shouldShowCallView, callType, closeCall } = useCallView(room);

  if (!shouldShowCallView || !callType) {
    return null;
  }

  const handleError = (error: Error) => {
    console.error('Element Call widget error:', error);
    // Optionally close the call on error
    closeCall();
  };

  return (
    <div className={`${styles.roomCallView} ${className || ''}`}>
      <div className={styles.callHeader}>
        <div className={styles.callInfo}>
          <h3 className={styles.callTitle}>
            {callType === 'video' ? 'Video Call' : 'Voice Call'} - {room.name || 'Room'}
          </h3>
          <span className={styles.callSubtitle}>Element Call (Beta)</span>
        </div>

        <IconButton
          aria-label="Close call"
          onClick={closeCall}
          style={{
            borderRadius: '50%',
            width: toRem(32),
            height: toRem(32),
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </IconButton>
      </div>

      <div className={styles.callContent}>
        <ElementCallWidget
          room={room}
          callType={callType}
          skipLobby={false}
          onClose={closeCall}
          onError={handleError}
        />
      </div>
    </div>
  );
}
