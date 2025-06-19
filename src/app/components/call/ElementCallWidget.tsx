import React, { useRef, useCallback, useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { ClientWidgetApi, Widget } from 'matrix-widget-api';
import { getCallWidget } from '../../hooks/useCallState';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { CallType } from '../../types/call';
import { SayanceWidgetDriver } from '../../utils/SayanceWidgetDriver';
import styles from './ElementCallWidget.module.css';
import { sendCallNotification } from '../../utils/elementCall';

interface ElementCallWidgetProps {
  room: Room;
  callType: CallType;
  skipLobby?: boolean;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export function ElementCallWidget({
  room,
  callType,
  skipLobby = false,
  onClose,
  onError,
}: ElementCallWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetApiRef = useRef<ClientWidgetApi | null>(null);
  const driverRef = useRef<SayanceWidgetDriver | null>(null);
  const matrixClient = useMatrixClient();

  // Get the widget from call state
  const widget = getCallWidget(room.roomId);

  // Prepare step - like element-web's prepare()
  useEffect(() => {
    if (!widget) return;

    // Create driver
    const driver = new SayanceWidgetDriver(matrixClient, room.roomId, callType);
    driverRef.current = driver;

    // Mark as prepared
    setIsPreparing(false);
  }, [widget, matrixClient, room.roomId, callType]);

  // Start messaging when iframe ref is set - following element-web pattern
  const startMessaging = useCallback(() => {
    if (!widget || !iframeRef.current || !driverRef.current || isPreparing) {
      return;
    }

    try {
      // Create matrix-widget-api Widget instance
      const matrixWidget = new Widget({
        id: widget.id,
        type: widget.type,
        url: widget.url,
        name: widget.name || 'Element Call',
        creatorUserId: widget.creatorUserId || '@unknown:unknown',
        data: widget.data || {},
      });

      // Create ClientWidgetApi instance
      const widgetApi = new ClientWidgetApi(matrixWidget, iframeRef.current, driverRef.current);
      widgetApiRef.current = widgetApi;

      // Set up event listeners
      widgetApi.on('preparing', () => {});

      widgetApi.on('ready', () => {
        setIsLoading(false);
      });

      widgetApi.on('content_loaded', () => {
        setIsLoading(false);
      });

      widgetApi.on('error:preparing', (error: any) => {
        console.error('[ElementCallWidget] Widget preparation error:', error);
        onError?.(new Error(`Widget preparation failed: ${error}`));
      });

      // Add Element Call specific action handlers

      widgetApi.on('action:org.matrix.msc4157.update_delayed_event', (ev: any) => {
        widgetApi.transport.reply(ev.detail, {});
      });

      // Handle io.element.join - Element Call trying to join the call
      widgetApi.on('action:io.element.join', async (ev: any) => {
        ev.preventDefault();

        if (widget.data?.action === 'start') {
          await sendCallNotification(matrixClient, room.roomId, callType);
        }

        // Acknowledge the join request - Element Call expects an empty response
        widgetApi.transport.reply(ev.detail, {});

        // You could emit a custom event here to notify sayance-web that user joined
        // For now, just log success
      });

      // Handle io.element.device_mute - Element Call sending/requesting device mute state
      widgetApi.on('action:io.element.device_mute', (ev: any) => {
        ev.preventDefault();

        // Element Call expects audio_enabled/video_enabled response
        // For now, return current states (could be enhanced to track actual mute states)
        const response = {
          audio_enabled: true, // Default to audio enabled
          video_enabled: callType === 'video', // Video enabled only for video calls
        };

        // If Element Call is sending us a mute state change, we should acknowledge it
        if (ev.detail.data.audio_enabled !== undefined) {
          response.audio_enabled = ev.detail.data.audio_enabled;
        }
        if (ev.detail.data.video_enabled !== undefined) {
          response.video_enabled = ev.detail.data.video_enabled;
        }

        widgetApi.transport.reply(ev.detail, response);
      });

      // Handle set_always_on_screen - Element Call trying to keep widget active
      widgetApi.on('action:set_always_on_screen', (ev: any) => {
        ev.preventDefault();

        // For sayance-web, we can just acknowledge this - the widget will stay active
        // In element-web this manages widget persistence via ActiveWidgetStore
        const { value } = ev.detail.data || {};

        // Acknowledge the request
        widgetApi.transport.reply(ev.detail, {});
      });

      // Handle io.element.spotlight_layout - Element Call trying to change layout
      widgetApi.on('action:io.element.spotlight_layout', (ev: any) => {
        ev.preventDefault();

        // For sayance-web, we can just acknowledge this
        // In element-web this would switch to spotlight view in the call UI

        // Acknowledge the request
        widgetApi.transport.reply(ev.detail, {});
      });

      // Handle io.element.tile_layout - Element Call trying to change layout
      widgetApi.on('action:io.element.tile_layout', (ev: any) => {
        ev.preventDefault();

        // Acknowledge the request
        widgetApi.transport.reply(ev.detail, {});
      });

      // Handle hangup call - Element Call notifying about call end
      widgetApi.on('action:im.vector.hangup', (ev: any) => {
        ev.preventDefault();

        // Acknowledge and potentially trigger onClose
        widgetApi.transport.reply(ev.detail, {});

        if (ev.detail.data?.errorMessage) {
          console.error('[ElementCallWidget] Call ended with error:', ev.detail.data.errorMessage);
          onError?.(new Error(`Call ended: ${ev.detail.data.errorMessage}`));
        } else {
          onClose?.();
        }
      });

      // Add a catch-all handler to see what actions we're receiving
      const originalOn = widgetApi.on.bind(widgetApi);
      widgetApi.on = function (event: string, handler: (...args: any[]) => void) {
        return originalOn(event, handler);
      };

      // Also log all incoming messages
      window.addEventListener('message', (event) => {
        if (event.data && event.data.api === 'fromWidget') {
        }
      });
    } catch (error) {
      console.error('[ElementCallWidget] Error starting Widget API messaging:', error);
      onError?.(error as Error);
    }
  }, [widget, isPreparing, callType, onError]);

  // Iframe ref callback - following element-web pattern
  const iframeRefCallback = useCallback(
    (ref: HTMLIFrameElement | null) => {
      iframeRef.current = ref;

      if (ref && !isPreparing) {
        // Start messaging immediately when iframe is set and we're prepared
        startMessaging();
      } else if (!ref) {
        // Cleanup when iframe is removed
        if (widgetApiRef.current) {
          widgetApiRef.current.stop();
          widgetApiRef.current = null;
        }
      }
    },
    [isPreparing, startMessaging]
  );

  // Start messaging when preparation is complete and iframe exists
  useEffect(() => {
    if (!isPreparing && iframeRef.current) {
      startMessaging();
    }
  }, [isPreparing, startMessaging]);

  // Clean up Widget API on unmount
  useEffect(() => {
    return () => {
      if (widgetApiRef.current) {
        widgetApiRef.current.stop();
        widgetApiRef.current = null;
      }
    };
  }, []);

  // Handle iframe errors
  const handleIframeError = useCallback(() => {
    const error = new Error('Failed to load Element Call widget');
    console.error(error);
    onError?.(error);
  }, [onError]);

  if (!widget) {
    return (
      <div className={`${styles.elementCallWidget} ${styles.elementCallWidgetError}`}>
        <div className={styles.error}>
          <h3>Unable to start call</h3>
          <p>Call widget not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.elementCallWidget}>
      {(isLoading || isPreparing) && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <p>{isPreparing ? 'Preparing call...' : 'Loading call...'}</p>
        </div>
      )}

      <iframe
        ref={iframeRefCallback}
        src={widget.url}
        title={widget.name || 'Element Call'}
        allow="camera; microphone; display-capture; autoplay; clipboard-write; clipboard-read"
        allowFullScreen
        onError={handleIframeError}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 'inherit',
        }}
      />
    </div>
  );
}
