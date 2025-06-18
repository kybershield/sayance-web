/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import {
  TypedEventEmitter,
  RoomEvent,
  EventType,
  type MatrixClient,
  type Room,
  type RoomMember,
} from 'matrix-js-sdk';

import { type Membership } from 'matrix-js-sdk/src/types';
import { logger } from 'matrix-js-sdk/src/logger';
import { randomString } from 'matrix-js-sdk/src/randomstring';
import { CallType } from 'matrix-js-sdk/src/webrtc/call';
import { NamespacedValue } from 'matrix-js-sdk/src/NamespacedValue';
import { type IWidgetApiRequest, type ClientWidgetApi, type IWidgetData } from 'matrix-widget-api';
import {
  MatrixRTCSession,
  MatrixRTCSessionEvent,
  type CallMembership,
  MatrixRTCSessionManagerEvents,
  type ICallNotifyContent,
} from 'matrix-js-sdk/src/matrixrtc';

import type EventEmitter from 'events';
import type { IApp } from '../stores/WidgetStore';
import { WidgetType } from '../utils/WidgetType';
import { ElementWidgetActions } from '../stores/ElementWidgetActions';
import { WidgetStore } from '../stores/WidgetStore'; 
import { WidgetMessagingStore, WidgetMessagingStoreEvent } from '../stores/WidgetMessagingStore';
import { CallStore } from '../stores/CallStore';
import { UPDATE_EVENT } from '../stores/AsyncStore';

const waitForEvent = async (
  emitter: EventEmitter,
  event: string,
  pred: (...args: any[]) => boolean = () => true,
  customTimeout?: number | false,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutMs = customTimeout === false ? undefined : customTimeout ?? 30000;
    let timeoutId: NodeJS.Timeout | undefined;

    const listener = (...args: any[]) => {
      if (pred(...args)) {
        if (timeoutId) clearTimeout(timeoutId);
        emitter.off(event, listener);
        resolve();
      }
    };

    emitter.on(event, listener);

    if (timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        emitter.off(event, listener);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);
    }
  });
};

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connected = 'connected',
  Disconnecting = 'disconnecting',
}

export const isConnected = (state: ConnectionState): boolean =>
  state === ConnectionState.Connected || state === ConnectionState.Disconnecting;

export enum CallEvent {
  ConnectionState = 'connection_state',
  Participants = 'participants',
  Close = 'close',
  Destroy = 'destroy',
}

interface CallEventHandlerMap {
  [CallEvent.ConnectionState]: (state: ConnectionState, prevState: ConnectionState) => void;
  [CallEvent.Participants]: (
    participants: Map<RoomMember, Set<string>>,
    prevParticipants: Map<RoomMember, Set<string>>,
  ) => void;
  [CallEvent.Close]: () => void;
  [CallEvent.Destroy]: () => void;
}

/**
 * A group call accessed through a widget.
 */
export abstract class Call extends TypedEventEmitter<CallEvent, CallEventHandlerMap> {
  protected readonly widgetUid: string;
  protected readonly room: Room;

  /**
   * The time after which device member state should be considered expired.
   */
  public abstract readonly STUCK_DEVICE_TIMEOUT_MS: number;

  private _messaging: ClientWidgetApi | null = null;
  /**
   * The widget's messaging, or null if disconnected.
   */
  protected get messaging(): ClientWidgetApi | null {
    return this._messaging;
  }
  private set messaging(value: ClientWidgetApi | null) {
    this._messaging = value;
  }

  public get roomId(): string {
    return this.widget.roomId!;
  }

  private _connectionState = ConnectionState.Disconnected;
  public get connectionState(): ConnectionState {
    return this._connectionState;
  }
  protected set connectionState(value: ConnectionState) {
    const prevValue = this._connectionState;
    this._connectionState = value;
    this.emit(CallEvent.ConnectionState, value, prevValue);
  }

  public get connected(): boolean {
    return isConnected(this.connectionState);
  }

  private _participants = new Map<RoomMember, Set<string>>();
  /**
   * The participants in the call.
   */
  public get participants(): Map<RoomMember, Set<string>> {
    return this._participants;
  }
  protected set participants(value: Map<RoomMember, Set<string>>) {
    const prevValue = this._participants;
    this._participants = value;
    this.emit(CallEvent.Participants, value, prevValue);
  }

  private _presented = false;
  /**
   * Whether the call is currently being presented (shown in the UI).
   */
  public get presented(): boolean {
    return this._presented;
  }
  public set presented(value: boolean) {
    this._presented = value;
  }

  protected constructor(
    /**
     * The widget used to access this call.
     */
    public readonly widget: IApp,
    protected readonly client: MatrixClient,
  ) {
    super();
    this.widgetUid = WidgetUtils.getWidgetUid(this.widget);
    this.room = this.client.getRoom(this.roomId)!;
    WidgetMessagingStore.instance.on(WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
  }

  public static get(room: Room): Call | null {
    return ElementCall.get(room);
  }

  /**
   * Performs a routine check of the call's associated room state, cleaning up
   * any data left over from an unclean disconnection.
   */
  public abstract clean(): Promise<void>;

  /**
   * Contacts the widget to connect to the call or prompt the user to connect to the call.
   */
  protected abstract performConnection(
    audioInput: MediaDeviceInfo | null,
    videoInput: MediaDeviceInfo | null,
  ): Promise<void>;

  /**
   * Contacts the widget to disconnect from the call.
   */
  protected abstract performDisconnection(): Promise<void>;

  /**
   * Starts the communication between the widget and the call.
   */
  public async start(): Promise<void> {
    const messagingStore = WidgetMessagingStore.instance;
    this.messaging = messagingStore.getMessagingForUid(this.widgetUid) ?? null;
    if (!this.messaging) {
      // The widget might still be initializing, so wait for it.
      try {
        await waitForEvent(
          messagingStore,
          WidgetMessagingStoreEvent.StoreMessaging,
          (uid: string, widgetApi: ClientWidgetApi) => {
            if (uid === this.widgetUid) {
              this.messaging = widgetApi;
              return true;
            }
            return false;
          },
        );
      } catch (e) {
        throw new Error(`Failed to bind call widget in room ${this.roomId}: ${e}`);
      }
    }
    await this.performConnection(null, null);

    this.room.on(RoomEvent.MyMembership, this.onMyMembership);
    window.addEventListener('beforeunload', this.beforeUnload);
    this.connectionState = ConnectionState.Connected;
  }

  /**
   * Disconnects the user from the call.
   */
  public async disconnect(): Promise<void> {
    this.connectionState = ConnectionState.Disconnecting;
    await this.performDisconnection();
    this.setDisconnected();
  }

  public setDisconnected(): void {
    this.connectionState = ConnectionState.Disconnected;
    this.room.off(RoomEvent.MyMembership, this.onMyMembership);
    window.removeEventListener('beforeunload', this.beforeUnload);
  }

  /**
   * Stops further communication with the widget and tells the UI to close.
   */
  protected close(): void {
    this.messaging = null;
    this.emit(CallEvent.Close);
  }

  public destroy(): void {
    this.setDisconnected();
    WidgetMessagingStore.instance.off(WidgetMessagingStoreEvent.StopMessaging, this.onStopMessaging);
    this.emit(CallEvent.Destroy);
  }

  private readonly onMyMembership = async (_room: Room, membership: Membership): Promise<void> => {
    if (membership !== 'join') this.setDisconnected();
  };

  private readonly onStopMessaging = (uid: string): void => {
    if (uid === this.widgetUid) {
      this.messaging = null;
      this.setDisconnected();
    }
  };

  private beforeUnload = (): void => {
    this.setDisconnected();
  };
}

/**
 * A group call using MSC3401 and Element Call as a backend.
 */
export class ElementCall extends Call {
  public static readonly CALL_EVENT_TYPE = new NamespacedValue(null, EventType.GroupCallPrefix);
  public static readonly MEMBER_EVENT_TYPE = new NamespacedValue(null, EventType.GroupCallMemberPrefix);
  public readonly STUCK_DEVICE_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

  private terminationTimer?: number;

  public get presented(): boolean {
    return super.presented;
  }
  public set presented(value: boolean) {
    super.presented = value;
    this.checkDestroy();
  }

  private static generateWidgetUrl(client: MatrixClient, roomId: string, widgetId: string): URL {
    // Use embedded Element Call assets instead of external server
    const baseUrl = window.location.href;
    let url = new URL("./widgets/element-call/index.html#", baseUrl); // this strips hash fragment from baseUrl
    
    // Allow override via environment variable for development
    // const elementCallUrl = import.meta.env.VITE_SAYANCE_CALL_SERVER;
    // if (elementCallUrl) url = new URL(elementCallUrl);
    

    // Splice together the Element Call URL for this call
    const params = new URLSearchParams({
      embed: 'true', // We're embedding EC within another application  
      // Template variables are used, so that this can be configured using the widget data.
      skipLobby: '$skipLobby', // Skip the lobby in case we show a lobby component of our own.
      returnToLobby: '$returnToLobby', // Returns to the lobby (instead of blank screen) when the call ends.
      perParticipantE2EE: '$perParticipantE2EE',
      hideHeader: 'true', // Hide the header since our room header is enough
      userId: client.getUserId()!,
      deviceId: client.getDeviceId()!,
      widgetId,
      parentUrl: window.location.href.split("#", 2)[0],
      roomId: roomId,
      baseUrl: client.baseUrl,
      lang: 'en',
      theme: '$org.matrix.msc2873.client_theme',
    });

    const replacedUrl = params.toString().replace(/%24/g, '$');
    url.hash = `#?${replacedUrl}`;
    
    console.log('🔗 Generated Element Call URL:', url.toString());
    console.log('📋 Parameters:', Object.fromEntries(params));
    
    return url;
  }

  // Creates a new widget if there isn't any widget of type Call in this room.
  private static createOrGetCallWidget(
    roomId: string,
    client: MatrixClient,
    skipLobby: boolean | undefined,
    returnToLobby: boolean | undefined,
  ): IApp {
    const ecWidget = WidgetStore.instance.getApps(roomId).find((app: IApp) => WidgetType.CALL.matches(app.type));
    if (ecWidget) {
      // Always update the widget data
      const overwrites: IWidgetData = {};
      if (skipLobby !== undefined) {
        overwrites.skipLobby = skipLobby;
      }
      if (returnToLobby !== undefined) {
        overwrites.returnToLobby = returnToLobby;
      }
      ecWidget.data = ElementCall.getWidgetData(client, roomId, ecWidget?.data ?? {}, overwrites);
      return ecWidget;
    }
    const widgetId = randomString(24)
    const url = ElementCall.generateWidgetUrl(client, roomId, widgetId);

    // To use Element Call without touching room state, we create a virtual widget
    const createdWidget = WidgetStore.instance.addVirtualWidget(
      {
        id: widgetId, // So that it's globally unique
        creatorUserId: client.getUserId()!,
        name: 'Element Call',
        type: WidgetType.CALL.preferred,
        url: url.toString(),
        waitForIframeLoad: false,
        data: ElementCall.getWidgetData(
          client,
          roomId,
          {},
          {
            skipLobby: skipLobby ?? false,
            returnToLobby: returnToLobby ?? false,
          },
        ),
      },
      roomId,
    );

    WidgetStore.instance.emit(UPDATE_EVENT, null);
    return createdWidget;
  }

  private static getWidgetData(
    client: MatrixClient,
    roomId: string,
    currentData: IWidgetData,
    overwriteData: IWidgetData,
  ): IWidgetData {
    let perParticipantE2EE = false;
    const room = client.getRoom(roomId);
    if (room?.hasEncryptionStateEvent()) {
      perParticipantE2EE = true;
    }
    return {
      ...currentData,
      ...overwriteData,
      perParticipantE2EE,
    };
  }

  private constructor(
    public session: MatrixRTCSession,
    widget: IApp,
    client: MatrixClient,
  ) {
    super(widget, client);

    this.session.on(MatrixRTCSessionEvent.MembershipsChanged, this.onMembershipChanged);
    this.client.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, this.checkDestroy);
    this.updateParticipants();
  }

  public static get(room: Room): ElementCall | null {
    const apps = WidgetStore.instance.getApps(room.roomId);
    const hasEcWidget = apps.some((app: IApp) => WidgetType.CALL.matches(app.type));
    const session = room.client.matrixRTC.getRoomSession(room);

    // A call is present if we have a widget or there is a running session
    if (hasEcWidget || session.memberships.length !== 0) {
      const availableOrCreatedWidget = ElementCall.createOrGetCallWidget(
        room.roomId,
        room.client,
        undefined,
        false,
      );
      return new ElementCall(session, availableOrCreatedWidget, room.client);
    }

    return null;
  }

  public static create(room: Room, skipLobby = false): void {
    ElementCall.createOrGetCallWidget(room.roomId, room.client, skipLobby, false);
    
    // Force immediate update of CallStore for this room
    CallStore.instance.updateRoom(room);
  }

  protected async sendCallNotify(): Promise<void> {
    const room = this.room;
    const memberCount = room.getJoinedMemberCount();
    
    // Send call notification
    const content: ICallNotifyContent = {
      application: 'm.call',
      'm.mentions': { user_ids: [], room: true },
      notify_type: memberCount === 2 ? 'ring' : 'notify',
      call_id: '',
    };

    await room.client.sendEvent(room.roomId, EventType.CallNotify, content);
  }

  protected async performConnection(
    audioInput: MediaDeviceInfo | null,
    videoInput: MediaDeviceInfo | null,
  ): Promise<void> {
    this.messaging!.on(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
    this.messaging!.once(`action:${ElementWidgetActions.Close}`, this.onClose);
    this.messaging!.on(`action:${ElementWidgetActions.DeviceMute}`, this.onDeviceMute);

    const session = this.client.matrixRTC.getActiveRoomSession(this.room);
    if (session) {
      await waitForEvent(
        session,
        MatrixRTCSessionEvent.MembershipsChanged,
        (_, newMemberships: CallMembership[]) =>
          newMemberships.some((m) => m.sender === this.client.getUserId()),
        false,
      );
    } else {
      await waitForEvent(
        this.client.matrixRTC,
        MatrixRTCSessionManagerEvents.SessionStarted,
        (roomId: string, session: MatrixRTCSession) =>
          this.session.callId === session.callId && roomId === this.roomId,
        false,
      );
    }
    this.sendCallNotify();
  }

  protected async performDisconnection(): Promise<void> {
    try {
      await this.messaging!.transport.send(ElementWidgetActions.HangupCall, {});
      await waitForEvent(
        this.session,
        MatrixRTCSessionEvent.MembershipsChanged,
        (_, newMemberships: CallMembership[]) =>
          !newMemberships.some((m) => m.sender === this.client.getUserId()),
      );
    } catch (e) {
      throw new Error(`Failed to hangup call in room ${this.roomId}: ${e}`);
    }
  }

  public setDisconnected(): void {
    this.messaging!.off(`action:${ElementWidgetActions.HangupCall}`, this.onHangup);
    this.messaging!.off(`action:${ElementWidgetActions.DeviceMute}`, this.onDeviceMute);
    super.setDisconnected();
  }

  public destroy(): void {
    WidgetStore.instance.removeVirtualWidget(this.widget.id, this.widget.roomId);
    this.session.off(MatrixRTCSessionEvent.MembershipsChanged, this.onMembershipChanged);
    this.client.matrixRTC.off(MatrixRTCSessionManagerEvents.SessionEnded, this.checkDestroy);

    clearTimeout(this.terminationTimer);
    this.terminationTimer = undefined;

    super.destroy();
  }

  private checkDestroy = (): void => {
    // A call ceases to exist as soon as all participants leave and also the
    // user isn't looking at it
    if (this.session.memberships.length === 0 && !this.presented) this.destroy();
  };

  private readonly onMembershipChanged = (): void => this.updateParticipants();

  private updateParticipants(): void {
    const participants = new Map<RoomMember, Set<string>>();

    for (const m of this.session.memberships) {
      if (!m.sender) continue;
      const member = this.room.getMember(m.sender);
      if (member) {
        if (participants.has(member)) {
          participants.get(member)?.add(m.deviceId);
        } else {
          participants.set(member, new Set([m.deviceId]));
        }
      }
    }

    this.participants = participants;
  }

  private readonly onDeviceMute = (ev: CustomEvent<IWidgetApiRequest>): void => {
    ev.preventDefault();
    this.messaging!.transport.reply(ev.detail, {}); // ack
  };

  private readonly onHangup = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
    ev.preventDefault();
    this.messaging!.transport.reply(ev.detail, {}); // ack
    this.setDisconnected();
  };

  private readonly onClose = async (ev: CustomEvent<IWidgetApiRequest>): Promise<void> => {
    ev.preventDefault();
    this.messaging!.transport.reply(ev.detail, {}); // ack
    this.close();
  };

  public clean(): Promise<void> {
    return Promise.resolve();
  }
}

// Utility functions
class WidgetUtils {
  static getWidgetUid(widget: IApp): string {
    return `${widget.id}_${widget.roomId || 'account'}`;
  }
} 