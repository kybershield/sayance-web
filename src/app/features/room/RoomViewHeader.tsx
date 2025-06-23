import React, { MouseEventHandler, forwardRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Avatar,
  Text,
  Overlay,
  OverlayCenter,
  OverlayBackdrop,
  IconButton,
  Icon,
  Icons,
  Tooltip,
  TooltipProvider,
  Menu,
  MenuItem,
  toRem,
  config,
  Line,
  PopOut,
  RectCords,
  Badge,
  Spinner,
} from 'folds';
import { useNavigate } from 'react-router-dom';
import { JoinRule, Room } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';

import { useStateEvent } from '../../hooks/useStateEvent';
import { PageHeader } from '../../components/page';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { UseStateProvider } from '../../components/UseStateProvider';
import { RoomTopicViewer } from '../../components/room-topic-viewer';
import { StateEvent } from '../../../types/matrix/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoom } from '../../hooks/useRoom';
import { useSetSetting, useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { getHomeSearchPath, getSpaceSearchPath, withSearchParam } from '../../pages/pathUtils';
import { getCanonicalAliasOrRoomId, isRoomAlias, mxcUrlToHttp } from '../../utils/matrix';
import { _SearchPathSearchParams } from '../../pages/paths';
import * as css from './RoomViewHeader.css';
import { useRoomUnread } from '../../state/hooks/unread';
import { usePowerLevelsAPI, usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { markAsRead } from '../../../client/action/notifications';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { openInviteUser } from '../../../client/action/navigation';
import { copyToClipboard } from '../../utils/dom';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomAvatar, useRoomName, useRoomTopic } from '../../hooks/useRoomMeta';
import { mDirectAtom } from '../../state/mDirectList';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import { getViaServers } from '../../plugins/via-servers';
import { BackRouteHandler } from '../../components/BackRouteHandler';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomPinnedEvents } from '../../hooks/useRoomPinnedEvents';
import { RoomPinMenu } from './room-pin-menu';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import {
  getRoomNotificationMode,
  getRoomNotificationModeIcon,
  useRoomsNotificationPreferencesContext,
} from '../../hooks/useRoomsNotificationPreferences';
import { useCallState } from '../../pages/client/call/CallProvider';
import { partialMatrixIdToPhoneNumber } from '../../../util/functionsUtil';
import MenuIcon from '../../../../public/icons/menu-icon.svg';
import * as roomActions from '../../../client/action/room';
import { getDirectRoomPath } from '../../pages/pathUtils';

type RoomMenuProps = {
  room: Room;
  requestClose: () => void;
};
const RoomMenu = forwardRef<HTMLDivElement, RoomMenuProps>(({ room, requestClose }, ref) => {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const powerLevels = usePowerLevelsContext();
  const { getPowerLevel, canDoAction } = usePowerLevelsAPI(powerLevels);
  const canInvite = canDoAction('invite', getPowerLevel(mx.getUserId() ?? ''));
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const notificationMode = getRoomNotificationMode(notificationPreferences, room.roomId);

  const handleMarkAsRead = () => {
    markAsRead(mx, room.roomId, hideActivity);
    requestClose();
  };

  const handleInvite = () => {
    openInviteUser(room.roomId);
    requestClose();
  };

  const handleCopyLink = () => {
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
    const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
    copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
    requestClose();
  };

  const openSettings = useOpenRoomSettings();
  const parentSpace = useSpaceOptionally();
  const handleOpenSettings = () => {
    openSettings(room.roomId, parentSpace?.roomId);
    requestClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
        <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
          {(handleOpen, opened, changing) => (
            <MenuItem
              size="300"
              after={
                changing ? (
                  <Spinner size="100" variant="Secondary" />
                ) : (
                  <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                )
              }
              radii="300"
              aria-pressed={opened}
              onClick={handleOpen}
            >
              <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                Notifications
              </Text>
            </MenuItem>
          )}
        </RoomNotificationModeSwitcher>
      </Box>
      <Line variant="Surface" size="300" />
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleInvite}
          variant="Primary"
          fill="None"
          size="300"
          after={<Icon size="100" src={Icons.UserPlus} />}
          radii="300"
          disabled={!canInvite}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Invite
          </Text>
        </MenuItem>
        <MenuItem
          onClick={handleCopyLink}
          size="300"
          after={<Icon size="100" src={Icons.Link} />}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Copy Link
          </Text>
        </MenuItem>
        <MenuItem
          onClick={handleOpenSettings}
          size="300"
          after={<Icon size="100" src={Icons.Setting} />}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Room Settings
          </Text>
        </MenuItem>
      </Box>
      <Line variant="Surface" size="300" />
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <UseStateProvider initial={false}>
          {(promptLeave, setPromptLeave) => (
            <>
              <MenuItem
                onClick={() => setPromptLeave(true)}
                variant="Critical"
                fill="None"
                size="300"
                after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                radii="300"
                aria-pressed={promptLeave}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Leave Room
                </Text>
              </MenuItem>
              {promptLeave && (
                <LeaveRoomPrompt
                  roomId={room.roomId}
                  onDone={requestClose}
                  onCancel={() => setPromptLeave(false)}
                />
              )}
            </>
          )}
        </UseStateProvider>
      </Box>
    </Menu>
  );
});

export function RoomViewHeader() {
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const screenSize = useScreenSizeContext();
  const room = useRoom();
  const space = useSpaceOptionally();
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [pinMenuAnchor, setPinMenuAnchor] = useState<RectCords>();
  const [isStartingCall, setIsStartingCall] = useState(false);
  const mDirects = useAtomValue(mDirectAtom);

  const {
    isChatOpen,
    toggleChat,
    setActiveCallRoomId,
    setViewedCallRoomId,
    activeCallRoomId,
    isCallActive,
  } = useCallState();
  const pinnedEvents = useRoomPinnedEvents(room);
  const encryptionEvent = useStateEvent(room, StateEvent.RoomEncryption);
  const ecryptedRoom = !!encryptionEvent;
  const avatarMxc = useRoomAvatar(room, mDirects.has(room.roomId));
  const name = useRoomName(room);
  const topic = useRoomTopic(room);
  const avatarUrl = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const setPeopleDrawer = useSetSetting(settingsAtom, 'isPeopleDrawer');

  // I assume there is a global state so I don't have to run this check every time but for now we'll stub this in
  const isDirectMessage = () => {
    const mDirectsEvent = mx.getAccountData('m.direct' as any);
    if (mDirectsEvent?.event?.content === undefined) {
      return false;
    }
    const { roomId } = room;
    return (
      Object.values(mDirectsEvent?.event?.content).filter((e: any) => {
        if (e.indexOf(roomId) === 0) return true;
      }).length !== 0
    );
  };

  /**
   * Handles call initiation for direct messages
   *
   * This function implements the complete call flow:
   * 1. Validates that this is a direct message with another user
   * 2. Creates a new Matrix call room with MSC3417 call type
   * 3. Invites the other participant to the call room
   * 4. Sets up the call state management (viewed/active call room IDs)
   * 5. Navigates to the new call room where Element Call widget will load
   * 6. Provides visual feedback during the process
   *
   * The call room is created with:
   * - type: 'org.matrix.msc3417.call' for proper call room detection
   * - Same encryption setting as the original DM
   * - Descriptive name and topic
   * - Private visibility with invitation-only access
   */
  const handleCall: MouseEventHandler<HTMLButtonElement> = async (evt) => {
    evt.preventDefault();

    if (isStartingCall) return; // Prevent multiple calls

    try {
      setIsStartingCall(true);

      // If there's already an active call in this room, just navigate to it
      if (activeCallRoomId === room.roomId && isCallActive) {
        return;
      }

      // Check if this room is already a call room
      if (room.isCallRoom()) {
        setActiveCallRoomId(room.roomId);
        setViewedCallRoomId(room.roomId);
        return;
      }

      // Create a new call room for direct message
      if (isDirectMessage()) {
        // Get the other user in the DM
        const otherMembers = room
          .getJoinedMembers()
          .filter((member) => member.userId !== mx.getUserId());

        if (otherMembers.length === 0) {
          throw new Error('No other members found in direct message');
        }

        const otherUserId = otherMembers[0].userId;
        const roomName = name || otherUserId;

        // Create a call room with the same participants
        const result = await roomActions.createCallRoom(
          mx,
          otherUserId,
          roomName,
          !!encryptionEvent
        );

        if (result?.room_id) {
          // Set the new call room as viewed first (this triggers widget creation)
          setViewedCallRoomId(result.room_id);

          // Navigate to the call room
          navigate(getDirectRoomPath(result.room_id));

          // Small delay to allow navigation to complete before setting as active
          setTimeout(() => {
            setActiveCallRoomId(result.room_id);
          }, 100);
        } else {
          throw new Error('Failed to create call room - no room ID returned');
        }
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      // You could implement a toast notification system here
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Provide specific guidance for common permission errors
      if (errorMessage.includes('M_FORBIDDEN') || errorMessage.includes('permission')) {
        alert(
          `Failed to start call: Permission denied. This may be due to room settings or server configuration. Please try again or contact your administrator.\n\nDetails: ${errorMessage}`
        );
      } else if (
        errorMessage.includes('M_ROOM_IN_USE') ||
        errorMessage.includes('room') ||
        errorMessage.includes('create')
      ) {
        alert(
          `Failed to start call: Unable to create call room. Please try again.\n\nDetails: ${errorMessage}`
        );
      } else {
        alert(`Failed to start call: ${errorMessage}`);
      }
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleSearchClick = () => {
    const searchParams: _SearchPathSearchParams = {
      rooms: room.roomId,
    };
    const path = space
      ? getSpaceSearchPath(getCanonicalAliasOrRoomId(mx, space.roomId))
      : getHomeSearchPath();
    navigate(withSearchParam(path, searchParams));
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const handleOpenPinMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setPinMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PageHeader balance={screenSize === ScreenSize.Mobile}>
      <Box grow="Yes" gap="300">
        {screenSize === ScreenSize.Mobile && (
          <BackRouteHandler>
            {(onBack) => (
              <Box shrink="No" alignItems="Center">
                <IconButton onClick={onBack}>
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              </Box>
            )}
          </BackRouteHandler>
        )}
        <Box grow="Yes" alignItems="Center" gap="300">
          {screenSize !== ScreenSize.Mobile && (
            <Avatar size="300">
              <RoomAvatar
                roomId={room.roomId}
                src={avatarUrl}
                alt={name}
                renderFallback={() => (
                  <RoomIcon
                    size="200"
                    joinRule={room.getJoinRule() ?? JoinRule.Restricted}
                    filled
                  />
                )}
              />
            </Avatar>
          )}
          <Box direction="Column">
            <Text size={topic ? 'H5' : 'H3'} truncate>
              {partialMatrixIdToPhoneNumber(name)}
            </Text>
            {topic && (
              <UseStateProvider initial={false}>
                {(viewTopic, setViewTopic) => (
                  <>
                    <Overlay open={viewTopic} backdrop={<OverlayBackdrop />}>
                      <OverlayCenter>
                        <FocusTrap
                          focusTrapOptions={{
                            initialFocus: false,
                            clickOutsideDeactivates: true,
                            onDeactivate: () => setViewTopic(false),
                            escapeDeactivates: stopPropagation,
                          }}
                        >
                          <RoomTopicViewer
                            name={name}
                            topic={topic}
                            requestClose={() => setViewTopic(false)}
                          />
                        </FocusTrap>
                      </OverlayCenter>
                    </Overlay>
                    <Text
                      as="button"
                      type="button"
                      onClick={() => setViewTopic(true)}
                      className={css.HeaderTopic}
                      size="T200"
                      priority="300"
                      truncate
                    >
                      {topic}
                    </Text>
                  </>
                )}
              </UseStateProvider>
            )}
          </Box>
        </Box>

        <Box shrink="No">
          {isDirectMessage() && (
            <TooltipProvider
              position="Bottom"
              align="End"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>{isStartingCall ? 'Starting Call...' : 'Start a Call'}</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton
                  onClick={handleCall}
                  ref={triggerRef}
                  disabled={isStartingCall}
                  style={{
                    opacity: isStartingCall ? 0.6 : 1,
                    cursor: isStartingCall ? 'wait' : 'pointer',
                  }}
                >
                  <Icon size="400" src={Icons.Phone} />
                </IconButton>
              )}
            </TooltipProvider>
          )}

          {!ecryptedRoom && !room.isCallRoom() && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Search</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} onClick={handleSearchClick}>
                  <Icon size="400" src={Icons.Search} />
                </IconButton>
              )}
            </TooltipProvider>
          )}
          {!room.isCallRoom() && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Pinned Messages</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton
                  style={{ position: 'relative' }}
                  onClick={handleOpenPinMenu}
                  ref={triggerRef}
                  aria-pressed={!!pinMenuAnchor}
                >
                  {pinnedEvents.length > 0 && (
                    <Badge
                      style={{
                        position: 'absolute',
                        left: toRem(3),
                        top: toRem(3),
                      }}
                      variant="Secondary"
                      size="400"
                      fill="Solid"
                      radii="Pill"
                    >
                      <Text as="span" size="L400">
                        {pinnedEvents.length}
                      </Text>
                    </Badge>
                  )}
                  <Icon size="400" src={Icons.Pin} filled={!!pinMenuAnchor} />
                </IconButton>
              )}
            </TooltipProvider>
          )}
          {!room.isCallRoom() && (
            <PopOut
              anchor={pinMenuAnchor}
              position="Bottom"
              content={
                <FocusTrap
                  focusTrapOptions={{
                    initialFocus: false,
                    returnFocusOnDeactivate: false,
                    onDeactivate: () => setPinMenuAnchor(undefined),
                    clickOutsideDeactivates: true,
                    isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                    isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                    escapeDeactivates: stopPropagation,
                  }}
                >
                  <RoomPinMenu room={room} requestClose={() => setPinMenuAnchor(undefined)} />
                </FocusTrap>
              }
            />
          )}

          {!room.isCallRoom() && screenSize === ScreenSize.Desktop && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Members</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} onClick={() => setPeopleDrawer((drawer) => !drawer)}>
                  <Icon size="400" src={Icons.User} />
                </IconButton>
              )}
            </TooltipProvider>
          )}

          <TooltipProvider
            position="Bottom"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Options</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                onClick={handleOpenMenu}
                ref={triggerRef}
                aria-pressed={!!menuAnchor}
                style={{ borderRadius: '100%', width: toRem(35), height: toRem(35) }}
              >
                {/* <Icon size="400" src={Icons.VerticalDots} /> */}
                <img src={MenuIcon} alt="Menu" />
              </IconButton>
            )}
          </TooltipProvider>

          <PopOut
            anchor={pinMenuAnchor}
            position="Bottom"
            align="End"
            content={<RoomPinMenu room={room} requestClose={() => setPinMenuAnchor(undefined)} />}
          />

          <PopOut
            anchor={menuAnchor}
            position="Bottom"
            align="End"
            content={
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  returnFocusOnDeactivate: false,
                  onDeactivate: () => setMenuAnchor(undefined),
                  clickOutsideDeactivates: true,
                  isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                  isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                  escapeDeactivates: stopPropagation,
                }}
              >
                <RoomMenu room={room} requestClose={() => setMenuAnchor(undefined)} />
              </FocusTrap>
            }
          />
          {room.isCallRoom() && !isDirectMessage() && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Chat</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} onClick={toggleChat}>
                  <Icon size="400" src={Icons.Message} />
                </IconButton>
              )}
            </TooltipProvider>
          )}
        </Box>
      </Box>
    </PageHeader>
  );
}
