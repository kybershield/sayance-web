# Sayance Web Call Implementation

This document describes the implementation of video and voice calling functionality in the Sayance web application, based on Element Web's architecture but adapted for the Sayance infrastructure.

## 🏗️ Architecture Overview

The Sayance call implementation supports two types of calls:

1. **Legacy Calls** - Direct peer-to-peer WebRTC calls (for 1-on-1 conversations)
2. **Element Call** - Group calls using MatrixRTC and LiveKit SFU backend (for group conversations)

### Components Structure

```
sayance-web/src/app/
├── hooks/
│   ├── useCallState.ts          # Main call state management
│   └── useRoomCall.ts           # Room-specific call information
├── components/call/
│   ├── CallButtons.tsx          # Call initiation buttons for room headers
│   ├── CallManager.tsx          # Central call orchestration component
│   ├── LegacyCallView.tsx       # UI for 1-on-1 video/voice calls
│   ├── IncomingCallToast.tsx    # Notification for incoming calls
│   └── index.ts                 # Component exports
└── components/video-call/
    └── VideoCall.tsx            # Element Call widget integration (existing)
```

## 🎯 Key Features

### ✅ Implemented Features

1. **Call Button Logic**

   - Automatically shows appropriate call buttons based on room member count
   - Legacy call buttons (voice/video) for 1-on-1 rooms
   - Element Call buttons for group rooms
   - Call state awareness (disable buttons during active calls)

2. **Legacy Call Support**

   - Voice calls with mute/unmute functionality
   - Video calls with camera on/off controls
   - Picture-in-picture local video view
   - Responsive UI for mobile and desktop

3. **Element Call Integration**

   - Integrates with existing VideoCall component
   - Supports MatrixRTC group calling
   - LiveKit SFU backend for scalable calls

4. **Call State Management**
   - Global call state across the application
   - Incoming call detection and handling
   - Call connection state tracking
   - Proper cleanup and error handling

### 🚧 Partial Implementation

1. **Incoming Call Notifications**

   - Basic incoming call toast UI
   - Browser notification support
   - Audio ringtone (placeholder)

2. **Call Event Handling**
   - Basic Matrix call event structure
   - Simplified event handling (needs full Matrix.js SDK integration)

## 📁 Component Details

### useCallState Hook

Central hook for managing call state across the application:

```typescript
const {
  activeCall, // Current active call information
  incomingCall, // Incoming call information
  canPlaceCall, // Whether user can start a call
  placeCall, // Function to initiate calls
  answerCall, // Function to answer incoming calls
  hangupCall, // Function to end calls
  toggleMute, // Toggle microphone mute
  toggleVideo, // Toggle video on/off
} = useCallState();
```

### CallButtons Component

Smart call buttons that automatically adapt based on room context:

```typescript
<CallButtons room={room} onElementCallStart={(roomId) => setElementCallRoom(roomId)} />
```

### CallManager Component

Central orchestrator for all call types:

```typescript
<CallManager
  elementCallRoomId={elementCallRoomId}
  onElementCallClose={() => setElementCallRoomId(null)}
/>
```

## 🔧 Integration Guide

### 1. Add Call Manager to Main App

In your main application component (e.g., `ClientRoot.tsx`):

```typescript
import { CallManager } from './components/call';

export function ClientRoot() {
  return (
    <>
      {/* Your existing app components */}
      <YourExistingComponents />

      {/* Add the call manager at the root level */}
      <CallManager />
    </>
  );
}
```

### 2. Add Call Buttons to Room Headers

In room header components (already integrated in `RoomViewHeader.tsx`):

```typescript
import { CallButtons } from './components/call';

// In your room header component:
<CallButtons room={room} onElementCallStart={handleElementCallStart} />;
```

### 3. Integration with Existing VideoCall Component

The implementation reuses your existing `VideoCall` component for Element Call functionality:

```typescript
// Element Call widget integration
{
  elementCallRoomId && (
    <VideoCall
      roomId={elementCallRoomId}
      isOpen={!!elementCallRoomId}
      onClose={onElementCallClose}
    />
  );
}
```

## 🐳 Docker Configuration

Your existing docker setup in `sayance-server/docker/docker-compose.sayance-full.yml` already includes the necessary services:

- **LiveKit SFU**: WebRTC selective forwarding unit for group calls
- **Auth Service**: JWT authentication for LiveKit
- **Redis**: Backend for LiveKit
- **Synapse**: Matrix homeserver with MatrixRTC support

The configuration supports:

- Voice and video calling
- Screen sharing
- Multiple participants
- End-to-end encryption

## 🚀 Usage Examples

### Starting a Voice Call

```typescript
// 1-on-1 voice call (automatic legacy call)
const { placeCall } = useCallState();
await placeCall(roomId, CallType.Voice);
```

### Starting a Video Call

```typescript
// 1-on-1 video call (automatic legacy call)
const { placeCall } = useCallState();
await placeCall(roomId, CallType.Video);

// Group video call (Element Call)
setElementCallRoomId(roomId);
```

### Handling Incoming Calls

```typescript
const { incomingCall, answerCall, hangupCall } = useCallState();

// Answer call
if (incomingCall) {
  await answerCall(incomingCall.roomId);
}

// Reject call
if (incomingCall) {
  await hangupCall(incomingCall.roomId);
}
```

## 🎨 UI/UX Features

### Responsive Design

- Mobile-friendly call interfaces
- Adaptive button layouts
- Touch-optimized controls

### Visual Feedback

- Call state indicators in room headers
- Active call badges with participant count
- Mute/unmute visual states
- Connection status indicators

### Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader friendly

## 🔒 Security Considerations

### WebRTC Security

- Uses Matrix's TURN/STUN servers
- End-to-end encryption for 1-on-1 calls
- Per-participant encryption for group calls

### Authentication

- Matrix user authentication required
- Room membership verification
- Permission-based call initiation

## 🐛 Known Limitations

1. **Simplified Event Handling**: Current implementation uses placeholder event handling. Full Matrix.js SDK call events need to be properly integrated.

2. **Basic Audio Management**: Ringtones and audio routing need enhancement.

3. **Missing Features**:
   - Call transfer
   - Call hold functionality
   - Advanced call statistics
   - Call recording

## 🛠️ Development Notes

### Testing Calls

1. Start your Docker environment:

   ```bash
   cd sayance-server/docker
   ./deploy-sayance.sh
   ```

2. Access the application at `https://sayance.localhost`

3. Create or join a room and test call functionality

### Debugging

- Check browser console for call-related logs
- Monitor Docker logs for LiveKit and auth service
- Use browser DevTools to inspect WebRTC connections

### Further Development

To fully implement calling:

1. **Complete Matrix.js SDK Integration**: Replace placeholder event handling with proper Matrix call events
2. **Audio Enhancement**: Add ringtones, audio routing, and better audio controls
3. **Advanced Features**: Implement call transfer, hold, and statistics
4. **Mobile App Integration**: Ensure compatibility with your React Native app

## 📚 References

- [Element Web Call Implementation](https://github.com/vector-im/element-web)
- [Matrix.js SDK Call Documentation](https://github.com/matrix-org/matrix-js-sdk)
- [LiveKit Documentation](https://docs.livekit.io/)
- [MatrixRTC Specification](https://github.com/matrix-org/matrix-spec-proposals/pull/3401)
