# Element Call Integration

This directory contains the Element Call integration for Sayance Web, providing voice and video calling functionality through embedded Element Call widgets.

## Overview

The Element Call integration consists of several key components:

### Components

- **`CallButtons.tsx`** - The UI components that render call buttons in chat rooms
- **`ElementCallWidget.tsx`** - The embedded iframe widget for Element Call
- **`RoomCallView.tsx`** - The main call view that shows the embedded call interface
- **`index.ts`** - Exports for the call components

### Hooks

- **`useElementCall.ts`** - Main hook for Element Call functionality
- **`useCallState.ts`** - Hook for tracking ongoing call states
- **`useCallView.ts`** - Hook for managing call view state

### Types

- **`types/call.ts`** - TypeScript types for call-related functionality

### Utilities

- **`utils/elementCall.ts`** - Utility functions for Element Call integration

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

## Usage

### Basic Usage - Call Buttons

Import and use the `CallButtons` component in your room interface:

```tsx
import { CallButtons } from '../components/call/CallButtons';

function RoomHeader({ room }) {
  return (
    <div>
      {/* Other header content */}
      <CallButtons
        room={room}
        onElementCallStart={(roomId) => {
          console.log('Call started in room:', roomId);
        }}
      />
    </div>
  );
}
```

### Room Call View - Embedded Widget

Use the `RoomCallView` component to show embedded calls:

```tsx
import { RoomCallView } from '../components/call';

function RoomView({ room }) {
  return (
    <div>
      {/* Room content */}
      <RoomCallView room={room} />
    </div>
  );
}
```

### Advanced Usage - Custom Implementation

You can also use the hooks directly for custom implementations:

```tsx
import { useElementCall, useCallView } from '../hooks/useElementCall';
import { CallType, PlatformCallType } from '../types/call';

function CustomCallComponent({ room }) {
  const { canStartCall, disabledReason, startCall } = useElementCall(room);
  const { shouldShowCallView, callType, closeCall } = useCallView(room);

  const handleVideoCall = () => {
    if (canStartCall) {
      startCall(CallType.Video, PlatformCallType.ElementCall);
    }
  };

  return (
    <div>
      <button
        onClick={handleVideoCall}
        disabled={!canStartCall}
        title={disabledReason || 'Start video call'}
      >
        Start Call
      </button>

      {shouldShowCallView && (
        <div style={{ height: '400px' }}>
          <ElementCallWidget room={room} callType={callType!} onClose={closeCall} />
        </div>
      )}
    </div>
  );
}
```

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

- `src/app/hooks/useClientConfig.ts` - Configuration management
- `src/app/hooks/useMatrixClient.ts` - Matrix client access
- `config.json` - Application configuration
