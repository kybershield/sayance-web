import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  Box,
  Button,
  Icon,
  Icons,
  Modal,
  Text,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
} from 'folds';

interface VideoCallProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoCall({ roomId, isOpen, onClose }: VideoCallProps) {
  const mx = useMatrixClient();
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rtcSession, setRtcSession] = useState<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !roomId) return;

    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the room
        const room = mx.getRoom(roomId);
        if (!room) {
          throw new Error('Room not found');
        }

        console.log('Starting MatrixRTC call for room:', roomId);

        // Get or create MatrixRTC session for the room
        let matrixRTCSession;
        try {
          // Check if MatrixRTC is available (matrix-js-sdk 35.0.0+ should have it)
          if (mx.matrixRTC) {
            matrixRTCSession = mx.matrixRTC.getRoomSession(room);
            console.log('MatrixRTC session:', matrixRTCSession);

            // Join the MatrixRTC session to send call membership events
            if (matrixRTCSession && !matrixRTCSession.isJoined()) {
              console.log('Joining MatrixRTC session...');
              try {
                // The focus configuration for LiveKit
                const focusConfig = {
                  type: 'livekit',
                  livekit_service_url: 'https://rtc.sayance.localhost/livekit/jwt',
                };

                await matrixRTCSession.joinRoomSession([focusConfig], {
                  type: 'oldest_membership',
                });
                console.log('Successfully joined MatrixRTC session');
              } catch (joinError) {
                console.error('Failed to join MatrixRTC session:', joinError);
                // Continue anyway - might work without explicit join
              }
            }
          } else {
            console.warn('MatrixRTC not available in this matrix-js-sdk version');
          }
        } catch (e) {
          console.warn('MatrixRTC not available:', e);
        }

        // Create widget parameters for Element Call widget mode
        const callId = `ec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        widgetIdRef.current = callId;

        const userId = mx.getUserId();
        const deviceId = mx.getDeviceId();
        const homeserverUrl = mx.getHomeserverUrl();

        // Check if room is encrypted for E2EE
        const isRoomEncrypted = room.hasEncryptionStateEvent();
        console.log(
          'Room encryption status:',
          isRoomEncrypted ? 'ENCRYPTED (E2EE enabled)' : 'NOT ENCRYPTED (Basic WebRTC only)'
        );

        // Build Element Call widget URL with proper parameters based on documentation
        const baseUrl = 'https://call.sayance.localhost';

        const params = new URLSearchParams({
          // Widget mode parameters
          widgetId: callId,
          parentUrl: window.location.origin,

          // Room and user context
          roomId: roomId,
          userId: userId || '',
          deviceId: deviceId || '',
          baseUrl: homeserverUrl,

          // Enable E2EE for encrypted rooms
          perParticipantE2EE: isRoomEncrypted.toString(),

          // Call configuration
          preload: 'false', // Start immediately, don't wait for join action
          hideHeader: 'false', // Show header for better UX in testing
          confineToRoom: 'true', // Keep user in call room
          theme: 'dark', // Match app theme
        });

        const widgetUrl = `${baseUrl}/?${params.toString()}`;

        console.log('Element Call widget URL:', widgetUrl);
        console.log('Widget ID:', callId);

        setCallUrl(widgetUrl);
        setRtcSession(matrixRTCSession);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize call:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize call');
        setIsLoading(false);
      }
    };

    initializeCall();
  }, [isOpen, roomId, mx]);

  // Proper Widget API message handling per Element Call documentation
  useEffect(() => {
    if (!callUrl || !widgetIdRef.current) return;

    // Ultra-comprehensive message handler to catch EVERYTHING
    const handleAllMessages = (event: MessageEvent) => {
      // Log ALL postMessage events to see if we're missing something
      console.log('🌍 ALL postMessage events (any origin):', {
        origin: event.origin,
        data: event.data,
        source: event.source,
      });
    };

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Element Call
      if (!event.origin.includes('call.sayance.localhost')) return;

      // Log ALL messages from Element Call for debugging
      console.log('=== ALL Widget messages from Element Call ===', event.data);

      try {
        const { api, widgetId, requestId, action, data } = event.data;

        // Only handle messages for our widget
        if (widgetId && widgetId !== widgetIdRef.current) {
          console.log('Ignoring message for different widget:', widgetId);
          return;
        }

        // Handle widget API requests (fromWidget means request from widget to client)
        if (api === 'fromWidget' && requestId && action) {
          console.log(`🔥 Handling widget action: ${action}`, { requestId, data });

          const sendResponse = (responseData: any, error?: any) => {
            const response = {
              api: 'toWidget',
              widgetId: widgetIdRef.current,
              requestId,
              response: error ? { error } : responseData,
            };
            console.log(`✅ Responding to ${action}:`, response);
            iframeRef.current?.contentWindow?.postMessage(
              response,
              'https://call.sayance.localhost'
            );
          };

          // Handle widget API actions according to matrix-widget-api spec
          switch (action) {
            case 'supported_api_versions':
              // Respond with supported widget API versions as simple array (correct format)
              console.log('Responding to supported_api_versions with correct array format');
              sendResponse(['0.0.1', '0.0.2']);
              break;

            case 'content_loaded':
              // Widget has finished loading
              sendResponse({});
              console.log('Element Call widget content loaded successfully');

              // Proactively send client versions to prevent timeout
              setTimeout(() => {
                console.log('Proactively sending client versions to prevent timeout');
                const proactiveResponse = {
                  api: 'toWidget',
                  widgetId: widgetIdRef.current,
                  action: 'client_versions',
                  data: {
                    supported_versions: ['0.0.1', '0.0.2'],
                    versions: ['0.0.1', '0.0.2'],
                  },
                };
                iframeRef.current?.contentWindow?.postMessage(
                  proactiveResponse,
                  'https://call.sayance.localhost'
                );
              }, 100);
              break;

            case 'get_supported_versions':
            case 'get_client_versions':
            case 'get_supported_client_versions':
            case 'supported_client_versions':
            case 'client_versions':
              // Element Call is requesting supported client versions (try multiple variants)
              console.log('Element Call requesting supported client versions');
              sendResponse({
                supported_versions: ['0.0.1', '0.0.2'],
                versions: ['0.0.1', '0.0.2'],
                supported_client_versions: ['0.0.1', '0.0.2'],
                client_versions: ['0.0.1', '0.0.2'],
              });
              break;

            case 'capabilities':
              // Provide capabilities that the widget can use
              sendResponse({
                capabilities: [
                  // Matrix RTC capabilities for call management
                  'org.matrix.msc2762.send.event:org.matrix.msc3401.call.member',
                  'org.matrix.msc2762.receive.event:org.matrix.msc3401.call.member',
                  'org.matrix.msc2762.send.state_event:org.matrix.msc3401.call.member',
                  'org.matrix.msc2762.receive.state_event:org.matrix.msc3401.call.member',

                  // OpenID token for LiveKit authentication
                  'town.robin.msc3846.get_open_id_token',

                  // Basic Matrix event capabilities
                  'org.matrix.msc2762.send.event:m.room.message',
                  'org.matrix.msc2762.receive.event:m.room.message',
                ],
              });
              break;

            case 'get_open_id_token':
              // Provide OpenID token for LiveKit authentication
              console.log('Element Call requesting OpenID token for LiveKit');
              mx.getOpenIdToken()
                .then((token) => {
                  console.log('Sending OpenID token to Element Call');
                  sendResponse(token);
                })
                .catch((error) => {
                  console.error('Failed to get OpenID token:', error);
                  sendResponse(null, 'Failed to get OpenID token');
                });
              break;

            case 'send_event':
              // Send Matrix events (call membership events)
              const { type, content, state_key } = data || {};
              console.log('Element Call requesting to send event:', { type, content, state_key });

              const room = mx.getRoom(roomId);
              if (room) {
                const eventPromise =
                  state_key !== undefined
                    ? mx.sendStateEvent(roomId, type, content, state_key)
                    : mx.sendEvent(roomId, type, content);

                eventPromise
                  .then((eventResponse) => {
                    console.log('Event sent successfully:', eventResponse);
                    sendResponse({ event_id: eventResponse.event_id });
                  })
                  .catch((error) => {
                    console.error('Failed to send event:', error);
                    sendResponse(null, 'Failed to send event');
                  });
              } else {
                sendResponse(null, 'Room not found');
              }
              break;

            case 'read_events':
              // Read Matrix events (call-related events)
              const { type: eventType, limit } = data || {};
              console.log('Element Call requesting to read events:', { eventType, limit });

              const room2 = mx.getRoom(roomId);
              if (room2) {
                const events = room2
                  .getLiveTimeline()
                  .getEvents()
                  .filter((event) => {
                    if (
                      eventType &&
                      Array.isArray(eventType) &&
                      !eventType.includes(event.getType())
                    )
                      return false;
                    // Filter for call-related events
                    return (
                      event.getType().includes('call') ||
                      event.getType().includes('m.call') ||
                      event.getType().includes('org.matrix.msc3401.call')
                    );
                  })
                  .slice(-(limit || 10))
                  .map((event) => ({
                    event_id: event.getId(),
                    type: event.getType(),
                    sender: event.getSender(),
                    content: event.getContent(),
                    origin_server_ts: event.getTs(),
                    state_key: event.getStateKey(),
                  }));

                sendResponse({ events });
              } else {
                sendResponse(null, 'Room not found');
              }
              break;

            // Additional widget API actions that Element Call might request
            case 'transport_ready':
            case 'widget_ready':
            case 'visibility_change':
              console.log(`Handling ${action} request`);
              sendResponse({});
              break;

            case 'set_always_on_screen':
            case 'get_openid_token':
            case 'navigate':
              console.log(`Handling ${action} request - responding with success`);
              sendResponse({ success: true });
              break;

            default:
              // For any other unhandled actions, provide empty response to prevent timeout
              console.log(
                `⚠️ UNHANDLED widget action: ${action} - sending empty response to prevent timeout`
              );
              sendResponse({});
              break;
          }
        } else if (api === 'fromWidget' && action) {
          // Handle widget API requests without requestId (fire-and-forget)
          console.log(`🔥 Fire-and-forget widget action: ${action}`, data);
        } else if (api && requestId) {
          // Log requests that don't match expected pattern
          console.log(`❓ Unknown widget API request pattern:`, { api, requestId, action, data });
          // Try to respond anyway
          if (requestId) {
            const response = {
              api: 'toWidget',
              widgetId: widgetIdRef.current,
              requestId,
              response: {},
            };
            console.log(`📤 Sending fallback response:`, response);
            iframeRef.current?.contentWindow?.postMessage(
              response,
              'https://call.sayance.localhost'
            );
          }
        } else {
          // Log any other types of messages for debugging
          console.log('🔍 Non-widget API message from Element Call:', event.data);
        }
      } catch (error) {
        console.error('❌ Error handling widget message:', error, 'Original message:', event.data);
      }
    };

    // Listen to ALL postMessage events first
    window.addEventListener('message', handleAllMessages);
    // Then our specific handler
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleAllMessages);
      window.removeEventListener('message', handleMessage);
    };
  }, [callUrl, mx, roomId]);

  // Handle cleanup when call closes
  useEffect(() => {
    return () => {
      if (rtcSession && rtcSession.leaveRoomSession) {
        try {
          console.log('Leaving MatrixRTC session');
          rtcSession.leaveRoomSession();
        } catch (e) {
          console.error('Failed to leave RTC session:', e);
        }
      }
    };
  }, [rtcSession]);

  const handleClose = useCallback(() => {
    // Leave RTC session
    if (rtcSession && rtcSession.leaveRoomSession) {
      try {
        rtcSession.leaveRoomSession();
      } catch (e) {
        console.error('Failed to leave RTC session:', e);
      }
    }

    setCallUrl(null);
    setError(null);
    setIsLoading(true);
    setRtcSession(null);
    widgetIdRef.current = null;
    onClose();
  }, [onClose, rtcSession]);

  if (!isOpen) return null;

  // Error state - show centered modal
  if (error) {
    return (
      <Overlay open={true} backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <Box
            direction="Column"
            gap="400"
            style={{
              padding: '32px',
              background: 'var(--bg-surface-300)',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            alignItems="Center"
          >
            <Icon src={Icons.Warning} size="400" />
            <Text size="H4">Call Failed</Text>
            <Text size="T400" align="Center">
              {error}
            </Text>
            <Button variant="Primary" onClick={handleClose}>
              Close
            </Button>
          </Box>
        </OverlayCenter>
      </Overlay>
    );
  }

  // Loading state - show centered modal
  if (isLoading || !callUrl) {
    return (
      <Overlay open={true} backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <Box
            direction="Column"
            gap="400"
            style={{
              padding: '32px',
              background: 'var(--bg-surface-300)',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            alignItems="Center"
          >
            <Icon src={Icons.Play} size="400" />
            <Text size="H4">Starting call...</Text>
            <Button variant="Secondary" onClick={handleClose}>
              Cancel
            </Button>
          </Box>
        </OverlayCenter>
      </Overlay>
    );
  }

  // Call interface - fullscreen overlay
  return (
    <Overlay open={true} backdrop={<OverlayBackdrop />}>
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#000',
          zIndex: 9999,
        }}
      >
        {/* Header with close button */}
        <Box
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10000,
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '8px',
            padding: '4px',
          }}
        >
          <Button
            variant="Critical"
            size="300"
            onClick={handleClose}
            style={{
              background: 'rgba(255,59,48,0.9)',
              border: 'none',
              color: 'white',
            }}
          >
            <Icon src={Icons.Cross} size="100" />
            End Call
          </Button>
        </Box>

        {/* Call iframe */}
        <iframe
          ref={iframeRef}
          src={callUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#000',
          }}
          allow="camera; microphone; display-capture; autoplay; clipboard-write; hid"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
          title="Sayance Call"
        />
      </Box>
    </Overlay>
  );
}
