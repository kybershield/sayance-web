# Element Call Integration

This directory contains the Element Call integration for Sayance Web, providing voice and video calling functionality through embedded Element Call widgets.

## Overview

The Element Call integration consists of several key components:

### Components

- **`CallButtons.tsx`** - The UI components that render call buttons in chat rooms
- **`ElementCallWidget.tsx`** - The embedded iframe widget for Element Call
- **`RoomCallView.tsx`** - The main call view that shows the embedded call interface
- **`IncomingCallToast.tsx`** - Toast notification for incoming calls with ring sound
- **`index.ts`** - Exports for the call components

### Hooks

- **`useElementCall.ts`** - Main hook for Element Call functionality
- **`useCallState.ts`** - Hook for tracking ongoing call states
- **`useCallView.ts`** - Hook for managing call view state

### Types

- **`types/call.ts`** - TypeScript types for call-related functionality

### Utilities

- **`utils/elementCall.ts`** - Utility functions for Element Call integration

## Call Notification Flow

### 1. Starting a Call

When a user clicks the Element Call button:

1. `CallButtons.tsx` calls `useElementCall().startCall()`
2. `startCall()` creates an Element Call widget and sends a call notification event
3. The call notification event (`m.call.notify`) is sent to all room members
4. The Element Call widget opens for the caller

### 2. Receiving Call Notifications

When another user receives the call notification:

1. `CallNotificationToastManager` listens for `m.call.notify` events
2. If the event is recent (≤15 seconds) and not from the current user, a toast is shown
3. `IncomingCallToast` displays with:
   - Ring sound (if notifications sounds are enabled)
   - Room name and caller information
   - Join/Decline buttons
   - Auto-dismisses after 90 seconds

### 3. Joining the Call

When the user clicks "Join":

1. Ring sound stops
2. `useElementCall().startCall()` is called to create the Element Call widget
3. The toast dismisses
4. Element Call widget opens for the joining user

## Configuration

Element Call must be configured in your `config.json`:

```json
{
  "featuresEnabled": {
    "elementCallEnabled": true
  },
  "elementCall": {
    "url": "https://call.sayance.localhost",
    "participantLimit": 8,
    "brand": "Sayance Call"
  },
  "allowedWidgets": ["https://call.sayance.localhost"]
}
```

### Configuration Options

- **`featuresEnabled.elementCallEnabled`** - Enable/disable Element Call functionality
- **`elementCall.url`** - URL of your Element Call instance
- **`elementCall.participantLimit`** - Maximum number of participants (optional)
- **`elementCall.brand`** - Brand name for the call interface (optional)
- **`allowedWidgets`** - Array of allowed widget URLs for security

## Audio Files

The system uses the following audio files:

- **`ring.ogg`** - Ring tone for incoming calls (copied from element-web)
- **`notification.ogg`** - General notification sound
- **`invite.ogg`** - Invitation notification sound

## Key Features

### Notification Handling

- **Smart filtering**: Only shows notifications for recent events (≤15 seconds)
- **User filtering**: Doesn't show notifications for your own calls
- **Ring sound**: Plays ring.ogg for `notify_type: "ring"` events
- **Settings integration**: Respects user notification sound preferences
- **Auto-dismiss**: Toasts automatically dismiss after 90 seconds
- **Room-specific**: Only one toast per room (replaces previous toasts)

### Call Types

- **Voice calls**: Display phone icon and "Voice call started"
- **Video calls**: Display play icon and "Video call started"
- **Ring vs Notify**: 2-person rooms get "ring" type, larger rooms get "notify" type

### Toast UI

- **Slide-in animation**: Toast slides in from the right
- **Fixed positioning**: Top-right corner, high z-index
- **Beta badge**: Shows β to indicate Element Call is in beta
- **Responsive actions**: Join/Decline buttons with proper styling

## Usage

### Basic Usage - Call Buttons

Import and use the `CallButtons` component in your room interface:

```tsx
import { CallButtons } from '../components/call/CallButtons';

function RoomHeader({ room }) {
  return (
    <div>
      {/* other header content */}
      <CallButtons room={room} />
    </div>
  );
}
```

### Call View Integration

Use `RoomCallView` to show active calls:

```tsx
import { RoomCallView } from '../components/call/RoomCallView';

function RoomView({ room }) {
  return (
    <div>
      <RoomCallView room={room} />
      {/* other room content */}
    </div>
  );
}
```

### Notification Integration

The `CallNotificationToastManager` is automatically included in `ClientNonUIFeatures`:

```tsx
// Already included - no additional setup needed
export function ClientNonUIFeatures({ children }) {
  return (
    <>
      <SystemEmojiFeature />
      <FaviconUpdater />
      <InviteNotifications />
      <MessageNotifications />
      <CallNotificationToastManager /> {/* Handles incoming call notifications */}
      {children}
    </>
  );
}
```

## Development

### Testing Call Notifications

1. Set up two users in the same room
2. User A clicks the Element Call button
3. User B should receive a toast notification with ring sound
4. User B can click "Join" to join the call

### Debugging

- Check browser console for `[CallNotificationToastManager]` logs
- Verify Element Call URL is accessible and in `allowedWidgets`
- Check notification sound settings in user preferences
- Ensure `m.call.notify` events are being sent/received

## Architecture

The call notification system integrates with:

- **Matrix Events**: Listens for `m.call.notify` events
- **Settings System**: Respects user notification preferences
- **Audio System**: Uses existing notification sound infrastructure
- **Widget System**: Creates Element Call widgets for joining calls
- **Call State Management**: Tracks active calls to prevent duplicates

This provides a seamless experience where users are notified of incoming calls and can easily join them with a single click.

## Features

### Embedded Call Experience

- **Iframe Integration** - Element Call loads as an embedded iframe widget
- **Seamless UI** - Calls appear within the room interface, not as separate windows
- **Full Screen Support** - Call widgets can expand to full screen
- **Auto-cleanup** - Call state is automatically managed

### Call Types

- **Voice Calls** - Audio-only calls
- **Video Calls** - Audio and video calls
- **Beta Badge** - Shows beta indicator for Element Call

### Permissions

The system checks several permissions before allowing calls:

1. **Feature Flag** - Element Call must be enabled in configuration
2. **URL Allowlist** - Element Call URL must be in the allowed widgets list
3. **Room Permissions** - User must have sufficient power level to create widgets
4. **Room Members** - Room must have other members besides the caller

### Call State Management

The system tracks call states including:

- **Active calls** - Whether a call is currently in progress
- **Connection state** - Connected, disconnected, or disconnecting
- **Embedded widgets** - Automatic cleanup when calls end
- **Call type tracking** - Voice vs video call differentiation

## Security

### Widget Security

- Element Call URLs must be explicitly allowed in the `allowedWidgets` configuration
- Only HTTPS URLs are recommended for production use
- Widget permissions are checked against Matrix room power levels
- iframe sandbox restrictions for security

### Call Notifications

- Call start notifications are sent as Matrix events to inform other room members
- Notifications include participant limits and call metadata

## Architecture

### Component Hierarchy

```
RoomView
├── CallButtons (in room header)
└── RoomCallView (when call is active)
    └── ElementCallWidget
        └── iframe (Element Call)
```

### State Flow

1. **User clicks call button** → `CallButtons` → `useElementCall.startCall()`
2. **Call state updated** → `startEmbeddedCall()` updates global state
3. **UI responds** → `useCallView()` triggers `RoomCallView` to show
4. **Widget loads** → `ElementCallWidget` embeds Element Call iframe
5. **Call ends** → `endEmbeddedCall()` cleans up state

## Troubleshooting

### Common Issues

1. **"Element Call is not enabled"**

   - Check that `featuresEnabled.elementCallEnabled` is `true` in config.json

2. **"Element Call URL not configured"**

   - Ensure `elementCall.url` is set in config.json

3. **"Element Call URL not allowed"**

   - Add the Element Call URL to the `allowedWidgets` array

4. **"You do not have permission to start calls"**

   - Check room power levels - user needs permission to create widgets

5. **"No one else is in this room"**

   - Calls require at least 2 participants

6. **Widget loading errors**
   - Check browser console for iframe loading errors
   - Verify Element Call instance is accessible
   - Check CORS settings on Element Call server

### Debug Mode

Enable debug logging by opening browser developer tools and checking console output. The system logs:

- Call start events
- Widget loading status
- iframe communication events
- Error states

## Development

### Adding New Call Types

To add support for other call platforms (Jitsi, etc.):

1. Add the platform to `PlatformCallType` enum in `types/call.ts`
2. Update `getPlatformCallTypeProps` function
3. Add handling in the `startCall` callback in `useElementCall.ts`
4. Create platform-specific widget components if needed

### Customizing UI

The call interface can be customized by:

1. Modifying the `RoomCallView` component styles
2. Updating `ElementCallWidget` CSS modules
3. Adjusting call button components using the hooks
4. Creating custom call layouts

### Testing

Test the Element Call integration by:

1. Configuring a test Element Call instance
2. Creating test rooms with multiple users
3. Verifying embedded call widgets load correctly
4. Testing call state management
5. Checking iframe security and permissions

## Dependencies

- **matrix-js-sdk** - Matrix client functionality
- **folds** - UI component library
- **Element Call** - External calling application (embedded as iframe)

## Related Files

- `
