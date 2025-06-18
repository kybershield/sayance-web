import { Room, MatrixClient, EventType } from 'matrix-js-sdk';
import { ElementCallConfig } from '../hooks/useClientConfig';
import { CallType } from '../types/call';

export interface WidgetData {
  skipLobby?: boolean;
  returnToLobby?: boolean;
  perParticipantE2EE?: boolean;
  [key: string]: any;
}

export interface Widget {
  id: string;
  type: string;
  url: string;
  name: string;
  roomId: string;
  data?: WidgetData;
  creatorUserId: string;
  waitForIframeLoad?: boolean;
}

/**
 * Generate Element Call widget URL with proper parameters
 * Follows element-web's pattern: try local widget wrapper first, fallback to configured URL
 */
export function generateElementCallWidgetUrl(
  client: MatrixClient,
  roomId: string,
  config: ElementCallConfig,
  options: {
    skipLobby?: boolean;
    returnToLobby?: boolean;
    action?: 'join' | 'start';
  } = {},
  widgetId: string
): string {
  const baseUrl = window.location.href;

  // First try the local widget wrapper (like element-web)
  let url = new URL('./widgets/element-call/index.html#', baseUrl);

  // If Element Call URL is configured, use that instead
  // if (config.url) {
  //   try {
  //     url = new URL(config.url);
  //   } catch {
  //     // If URL parsing fails, treat it as relative
  //     url = new URL(config.url, window.location.origin);
  //   }
  // }

  // Build parameters for Element Call (using template variables like element-web)
  const params = new URLSearchParams({
    embed: 'true', // We're embedding EC within another application
    returnToLobby: options.returnToLobby ? 'true' : 'false', // Returns to the lobby when the call ends
    hideHeader: 'true', // Hide the header since our room header is enough
    userId: client.getUserId()!,
    deviceId: client.getDeviceId()!,
    roomId: roomId,
    baseUrl: client.baseUrl,
    lang: navigator.language.replace('_', '-'),
    fontScale: '1', // TODO: Get from app font settings
    theme: 'light', // TODO: Get from app theme
    widgetId: widgetId,
    parentUrl: window.location.href,
    intent: options?.action === 'join' ? 'join_existing' : 'start_call',
  });

  // Add room encryption info
  const room = client.getRoom(roomId);
  if (room?.hasEncryptionStateEvent()) {
    params.append('perParticipantE2EE', 'true');
  } else {
    params.append('perParticipantE2EE', 'false');
  }

  // Set the hash with parameters (replace %24 with $ for template variables)
  const replacedUrl = params.toString().replace(/%24/g, '$');
  url.hash = `#?${replacedUrl}`;

  return url.toString().replace('#', '');
}

/**
 * Create Element Call widget data
 */
export function createElementCallWidgetData(
  client: MatrixClient,
  roomId: string,
  options: {
    skipLobby?: boolean;
    returnToLobby?: boolean;
    action?: 'join' | 'start';
  } = {}
): WidgetData {
  const room = client.getRoom(roomId);

  return {
    skipLobby: options.skipLobby ?? false,
    returnToLobby: options.returnToLobby ?? false,
    perParticipantE2EE: room?.hasEncryptionStateEvent() ?? false,
    action: options.action ?? 'start',
  };
}

/**
 * Generate a secure random string for widget IDs
 */
export function generateWidgetId(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateCallId(): string {
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a URL is allowed for widgets
 */
export function isWidgetUrlAllowed(url: string, allowedWidgets: string[] = []): boolean {
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;

    return allowedWidgets.some((allowed) => {
      try {
        const allowedObj = new URL(allowed);
        return allowedObj.origin === origin;
      } catch {
        return allowed === origin;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Send Matrix room call notification event
 */
export async function sendCallNotification(
  client: MatrixClient,
  roomId: string,
  call_id: string
): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;

  const memberCount = room.getJoinedMemberCount();

  // Send call notification event
  try {
    await client.sendEvent(roomId, EventType.CallNotify, {
      application: 'm.call',
      'm.mentions': { user_ids: [], room: true },
      notify_type: memberCount === 2 ? 'ring' : 'notify',
      call_id: '',
    });
  } catch (error) {
    console.warn('Failed to send call notification:', error);
  }
}

/**
 * Create Element Call widget - following element-web's pattern
 */
export function createElementCallWidget(
  client: MatrixClient,
  roomId: string,
  config: ElementCallConfig,
  options: {
    skipLobby?: boolean;
    returnToLobby?: boolean;
    action?: 'join' | 'start';
  } = {}
): Widget {
  const widgetId = generateWidgetId();
  const widgetUrl = generateElementCallWidgetUrl(client, roomId, config, options, widgetId);
  const widgetData = createElementCallWidgetData(client, roomId, options);

  return {
    id: widgetId,
    type: 'io.element.call', // Element Call widget type
    url: widgetUrl,
    name: 'Element Call',
    roomId: roomId,
    creatorUserId: client.getUserId()!,
    data: widgetData,
    waitForIframeLoad: false,
  };
}
