import React, { useCallback, useEffect, useState } from 'react';
import { MatrixEvent, RoomEvent, EventType, MatrixEventEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useSelectedRoom } from '../hooks/router/useSelectedRoom';
import { useCallState } from '../hooks/useCallState';
import { IncomingCallToast } from './call/IncomingCallToast';

interface ToastData {
  id: string;
  notifyEvent: MatrixEvent;
}

export function CallNotificationToastManager() {
  const mx = useMatrixClient();
  const selectedRoomId = useSelectedRoom();
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((notifyEvent: MatrixEvent) => {
    const id = `call_${notifyEvent.getRoomId()}_${notifyEvent.getId()}`;

    setToasts((prev) => {
      // Remove any existing toasts for this room first
      const filtered = prev.filter(
        (toast) =>
          !toast.notifyEvent.getRoomId() ||
          toast.notifyEvent.getRoomId() !== notifyEvent.getRoomId()
      );

      // Add new toast
      return [...filtered, { id, notifyEvent }];
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Helper function to check if an event is a call notification
  const isCallNotifyEvent = useCallback((event: MatrixEvent): boolean => {
    const eventType = event.getType();

    // Check for unencrypted call notify events
    if (eventType === EventType.CallNotify) {
      return true;
    }

    // Check for encrypted events that might contain call notifications
    if (eventType === 'm.room.encrypted') {
      // Check if the event has been decrypted and contains call notification content
      try {
        const decryptedContent = event.getContent();
        // For encrypted events, the actual event type might be available after decryption
        const effectiveType = event.getWireContent()?.type || event.getType();

        // Check if this is a decrypted call notification
        if (effectiveType === EventType.CallNotify) {
          return true;
        }

        // Alternative: check content structure for call notification
        if (
          decryptedContent &&
          (decryptedContent.application === 'm.call' || decryptedContent.notify_type)
        ) {
          return true;
        }
      } catch (error) {
        console.error('CallNotificationToastManager: Error checking encrypted event:', error);
      }
    }

    return false;
  }, []);

  // Helper function to handle call notification logic
  const handleCallNotification = useCallback(
    (event: MatrixEvent) => {
      const eventAge = Date.now() - event.getTs();
      const sender = event.getSender();
      const currentUserId = mx.getUserId();

      // Don't show notification for our own calls
      if (sender === currentUserId) {
        return;
      }

      // Don't show notifications for old events (older than 1 minute)
      if (eventAge > 60000) {
        return;
      }

      addToast(event);
    },
    [mx, addToast]
  );

  useEffect(() => {
    const handleTimelineEvent = (
      event: MatrixEvent,
      eventRoom: any,
      toStartOfTimeline: boolean | undefined,
      removed: boolean,
      data: any
    ) => {
      // Only handle live events (not historical)
      if (!data.liveEvent) {
        return;
      }

      // Check if it's a call notification (encrypted or unencrypted)
      if (isCallNotifyEvent(event)) {
        handleCallNotification(event);
      } else if (event.getType() === 'm.room.encrypted') {
        // For encrypted events, also listen for the decrypted event
        const handleDecrypted = () => {
          if (isCallNotifyEvent(event)) {
            handleCallNotification(event);
          }
        };

        event.once(MatrixEventEvent.Decrypted, handleDecrypted);
      }
    };

    mx.on(RoomEvent.Timeline, handleTimelineEvent);

    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [mx, selectedRoomId, isCallNotifyEvent, handleCallNotification]);

  return (
    <>
      {toasts.map((toast) => (
        <IncomingCallToast
          key={toast.id}
          notifyEvent={toast.notifyEvent}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </>
  );
}
