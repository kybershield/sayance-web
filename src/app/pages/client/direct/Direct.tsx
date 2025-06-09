import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  Avatar,
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import FocusTrap from 'focus-trap-react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { factoryRoomIdByActivity } from '../../../utils/sort';
import {
  NavButton,
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
} from '../../../components/nav';
import { getDirectRoomPath } from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { useDirectRooms } from './useDirectRooms';
import { openInviteUser } from '../../../../client/action/navigation';
import { PageNav, PageNavContent, PageNavHeader } from '../../../components/page';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../../client/action/notifications';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { VideoCall } from '../../../components/video-call/VideoCall';
import { useRoomCall } from '../../../hooks/useRoomCall';

type DirectMenuProps = {
  requestClose: () => void;
};
const DirectMenu = forwardRef<HTMLDivElement, DirectMenuProps>(({ requestClose }, ref) => {
  const mx = useMatrixClient();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const orphanRooms = useDirectRooms();
  const unread = useRoomsUnread(orphanRooms, roomToUnreadAtom);

  const handleMarkAsRead = () => {
    if (!unread) return;
    orphanRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
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
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function DirectHeader() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes">
            <Text size="H4" truncate>
              Direct Messages
            </Text>
          </Box>
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
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
            <DirectMenu requestClose={() => setMenuAnchor(undefined)} />
          </FocusTrap>
        }
      />
    </>
  );
}

function DirectEmpty() {
  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Mention} />}
        title={
          <Text size="H5" align="Center">
            No Direct Messages
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            You do not have any direct messages yet.
          </Text>
        }
        options={
          <Button variant="Secondary" size="300" onClick={() => openInviteUser()}>
            <Text size="B300" truncate>
              Direct Message
            </Text>
          </Button>
        }
      />
    </NavEmptyCenter>
  );
}

// Enhanced Direct Room Item with Call Buttons
interface DirectRoomItemProps {
  room: any;
  selected: boolean;
  linkPath: string;
  notificationMode: any;
  onStartVideoCall: () => void;
  onStartVoiceCall: () => void;
}

function DirectRoomItem({
  room,
  selected,
  linkPath,
  notificationMode,
  onStartVideoCall,
  onStartVoiceCall,
}: DirectRoomItemProps) {
  // const [isHovered, setIsHovered] = useState(false);
  const callInfo = useRoomCall(room);

  return (
    <Box
      // onMouseEnter={() => setIsHovered(true)}
      // onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative' }}
    >
      <RoomNavItem
        room={room}
        selected={selected}
        showAvatar
        direct
        linkPath={linkPath}
        notificationMode={notificationMode}
      />

      {/* Call Status Indicator */}
      {callInfo.isCallActive && (
        <Box
          style={{
            position: 'absolute',
            right: '8px',
            top: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            // background: 'var(--accent-brand)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: '500',
          }}
        >
          <Icon src={Icons.Play} size="50" />
          <Text as="span" size="T200" style={{ color: 'white' }}>
            {callInfo.participantCount}
          </Text>
          {callInfo.canJoinCall && (
            <IconButton
              size="300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStartVideoCall();
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                minWidth: 'auto',
                padding: '2px',
              }}
              aria-label="Join call"
            >
              <Icon src={Icons.ArrowGoRight} size="50" />
            </IconButton>
          )}
        </Box>
      )}

      {/* Hover Call Buttons (only show if no active call) */}
      {/* {isHovered && !callInfo.isCallActive && (
        <Box
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: '4px',
            // background: 'var(--color-background-solid)',
            padding: '4px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <IconButton
            size="300"
            variant="Background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartVoiceCall();
            }}
            aria-label="Start voice call"
          >
            <Icon src={Icons.Phone} size="100" />
          </IconButton>
          <IconButton
            size="300"
            variant="Background"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartVideoCall();
            }}
            aria-label="Start video call"
          >
            <Icon src={Icons.Play} size="100" />
          </IconButton>
        </Box>
      )} */}
    </Box>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('direct', 'direct');
export function Direct() {
  const mx = useMatrixClient();
  useNavToActivePathMapper('direct');
  const scrollRef = useRef<HTMLDivElement>(null);
  const directs = useDirectRooms();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const [activeCall, setActiveCall] = useState<string | null>(null);

  const selectedRoomId = useSelectedRoom();
  const noRoomToDisplay = directs.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());

  const sortedDirects = useMemo(() => {
    const items = Array.from(directs).sort(factoryRoomIdByActivity(mx));
    if (closedCategories.has(DEFAULT_CATEGORY_ID)) {
      return items.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return items;
  }, [mx, directs, closedCategories, roomToUnread, selectedRoomId]);

  const virtualizer = useVirtualizer({
    count: sortedDirects.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10,
  });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  const handleStartVideoCall = (roomId: string) => {
    setActiveCall(roomId);
  };

  const handleStartVoiceCall = (roomId: string) => {
    // For now, voice calls use the same interface but with audio-only
    setActiveCall(roomId);
  };

  const handleCloseCall = () => {
    setActiveCall(null);
  };

  return (
    <PageNav>
      {/* <DirectHeader /> */}
      {noRoomToDisplay ? (
        <DirectEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            <NavCategory>
              <NavItem radii="400">
                <NavButton onClick={() => openInviteUser()}>
                  <NavItemContent>
                    <Box as="span" grow="Yes" alignItems="Center" gap="200">
                      <Avatar size="200" radii="400">
                        <Icon src={Icons.Plus} size="100" />
                      </Avatar>
                      <Box as="span" grow="Yes">
                        <Text as="span" size="Inherit" truncate>
                          Create Chat
                        </Text>
                      </Box>
                    </Box>
                  </NavItemContent>
                </NavButton>
              </NavItem>
            </NavCategory>
            <NavCategory>
              <NavCategoryHeader>
                <RoomNavCategoryButton
                  closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                  data-category-id={DEFAULT_CATEGORY_ID}
                  onClick={handleCategoryClick}
                >
                  Chats
                </RoomNavCategoryButton>
              </NavCategoryHeader>
              <div
                style={{
                  position: 'relative',
                  height: virtualizer.getTotalSize(),
                }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const roomId = sortedDirects[vItem.index];
                  const room = mx.getRoom(roomId);
                  if (!room) return null;
                  const selected = selectedRoomId === roomId;

                  return (
                    <VirtualTile
                      virtualItem={vItem}
                      key={vItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <DirectRoomItem
                        room={room}
                        selected={selected}
                        linkPath={getDirectRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                        notificationMode={getRoomNotificationMode(
                          notificationPreferences,
                          room.roomId
                        )}
                        onStartVideoCall={() => handleStartVideoCall(roomId)}
                        onStartVoiceCall={() => handleStartVoiceCall(roomId)}
                      />
                    </VirtualTile>
                  );
                })}
              </div>
            </NavCategory>
          </Box>
        </PageNavContent>
      )}

      {/* Video Call Modal */}
      {activeCall && (
        <VideoCall roomId={activeCall} isOpen={!!activeCall} onClose={handleCloseCall} />
      )}
    </PageNav>
  );
}
