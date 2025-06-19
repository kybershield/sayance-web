import {
  WidgetDriver,
  Widget,
  WidgetKind,
  type Capability,
  type ISendEventDetails,
  type ISendDelayedEventDetails,
  type UpdateDelayedEventAction,
  type IRoomEvent,
  type ITurnServer,
  type IOpenIDUpdate,
  type SimpleObservable,
  OpenIDRequestState,
  type IReadEventRelationsResult,
  type ISearchUserDirectoryResult,
  type IGetMediaConfigResult,
  type IWidgetApiErrorResponseDataDetails,
  MatrixCapabilities,
  WidgetEventCapability,
  EventDirection,
} from 'matrix-widget-api';
import {
  MatrixClient,
  EventType,
  type IContent,
  type StateEvents,
  type TimelineEvents,
  Direction,
  THREAD_RELATION_TYPE,
  type SendDelayedEventResponse,
  ClientEvent,
  type ITurnServer as IClientTurnServer,
} from 'matrix-js-sdk';

export enum ElementWidgetCapabilities {
  /**
   * @deprecated Use MSC2931 instead.
   */
  CanChangeViewedRoom = 'io.element.view_room',
  /**
   * Ask Element to not give the option to move the widget into a separate tab.
   * This replaces RequiresClient in MatrixCapabilities.
   */
  RequiresClient = 'io.element.requires_client',
}

/**
 * SayanceWidgetDriver implements the WidgetDriver interface for sayance-web
 * Based on element-web's StopGapWidgetDriver but adapted for sayance-web's architecture
 */
export class SayanceWidgetDriver extends WidgetDriver {
  private allowedCapabilities: Set<Capability>;

  constructor(
    private matrixClient: MatrixClient,
    private roomId: string,
    private callType: string,
    allowedCapabilities?: Capability[]
  ) {
    super();

    // Base capabilities that are always allowed
    this.allowedCapabilities = new Set([
      MatrixCapabilities.Screenshots,
      MatrixCapabilities.AlwaysOnScreen,
      ElementWidgetCapabilities.RequiresClient,
      'org.matrix.msc3819.receive.to_device:org.matrix.call.sdp_stream_metadata_changed',
      'org.matrix.msc3819.send.to_device:m.call.replaces',
      'org.matrix.msc3819.receive.to_device:m.call.replaces',
      'org.matrix.msc4157.send.delayed_event',
      'org.matrix.msc4157.update_delayed_event',
    ]);

    // Add Element Call specific capabilities for virtual call widgets
    if (this.callType === 'video' || this.callType === 'voice') {
      this.allowedCapabilities.add(MatrixCapabilities.AlwaysOnScreen);
      this.allowedCapabilities.add(MatrixCapabilities.MSC3846TurnServers);
      this.allowedCapabilities.add(`org.matrix.msc2762.timeline:${roomId}`);
      this.allowedCapabilities.add(MatrixCapabilities.MSC4157SendDelayedEvent);
      this.allowedCapabilities.add(MatrixCapabilities.MSC4157UpdateDelayedEvent);
      this.allowedCapabilities.add(MatrixCapabilities.MSC2931Navigate);

      // State event capabilities
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomMember).raw
      );
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(EventDirection.Receive, 'org.matrix.msc3401.call').raw
      );
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomEncryption).raw
      );

      const clientUserId = this.matrixClient.getSafeUserId();
      // For the legacy membership type
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(
          EventDirection.Send,
          'org.matrix.msc3401.call.member',
          clientUserId
        ).raw
      );

      const clientDeviceId = this.matrixClient.getDeviceId();
      if (clientDeviceId !== null) {
        // For the session membership type compliant with MSC4143
        this.allowedCapabilities.add(
          WidgetEventCapability.forStateEvent(
            EventDirection.Send,
            'org.matrix.msc3401.call.member',
            `_${clientUserId}_${clientDeviceId}`
          ).raw
        );
        // Version with no leading underscore, for room versions whose auth rules allow it
        this.allowedCapabilities.add(
          WidgetEventCapability.forStateEvent(
            EventDirection.Send,
            'org.matrix.msc3401.call.member',
            `${clientUserId}_${clientDeviceId}`
          ).raw
        );
      }
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(
          EventDirection.Receive,
          'org.matrix.msc3401.call.member'
        ).raw
      );
      // for determining auth rules specific to the room version
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomCreate).raw
      );

      // Room events for Element Call
      const sendRecvRoomEvents = [
        'io.element.call.encryption_keys',
        'org.matrix.rageshake_request',
        EventType.Reaction,
        EventType.RoomRedaction,
        'io.element.call.reaction',
      ];
      for (const eventType of sendRecvRoomEvents) {
        this.allowedCapabilities.add(
          WidgetEventCapability.forRoomEvent(EventDirection.Send, eventType).raw
        );
        this.allowedCapabilities.add(
          WidgetEventCapability.forRoomEvent(EventDirection.Receive, eventType).raw
        );
      }

      // To-device events for Element Call
      const sendRecvToDevice = [
        EventType.CallInvite,
        EventType.CallCandidates,
        EventType.CallAnswer,
        EventType.CallHangup,
        EventType.CallReject,
        EventType.CallSelectAnswer,
        EventType.CallNegotiate,
        EventType.CallSDPStreamMetadataChanged,
        EventType.CallSDPStreamMetadataChangedPrefix,
        EventType.CallReplaces,
        EventType.CallEncryptionKeysPrefix,
      ];
      for (const eventType of sendRecvToDevice) {
        this.allowedCapabilities.add(
          WidgetEventCapability.forToDeviceEvent(EventDirection.Send, eventType).raw
        );
        this.allowedCapabilities.add(
          WidgetEventCapability.forToDeviceEvent(EventDirection.Receive, eventType).raw
        );
      }
    }

    // Add any additional allowed capabilities
    if (allowedCapabilities) {
      allowedCapabilities.forEach((cap) => this.allowedCapabilities.add(cap));
    }
  }

  public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    // For Element Call, auto-approve all our allowed capabilities
    const approved = new Set<Capability>();

    for (const capability of requested) {
      if (this.allowedCapabilities.has(capability)) {
        approved.add(capability);
      } else {
        console.warn('[SayanceWidgetDriver] Rejecting unknown capability:', capability);
      }
    }

    return approved;
  }

  public async sendEvent(
    eventType: string,
    content: IContent,
    stateKey: string | null = null,
    targetRoomId: string | null = null
  ): Promise<ISendEventDetails> {
    const roomId = targetRoomId || this.roomId;

    if (!roomId) throw new Error('Not in a room or not attached to a client');

    let r: { event_id: string } | null;
    if (stateKey !== null) {
      // state event
      r = await this.matrixClient.sendStateEvent(
        roomId,
        eventType as keyof StateEvents,
        content as StateEvents[keyof StateEvents],
        stateKey
      );
    } else if (eventType === EventType.RoomRedaction) {
      // special case: extract the `redacts` property and call redact
      r = await this.matrixClient.redactEvent(roomId, content['redacts']);
    } else {
      // message event
      r = await this.matrixClient.sendEvent(
        roomId,
        eventType as keyof TimelineEvents,
        content as TimelineEvents[keyof TimelineEvents]
      );
    }

    return { roomId, eventId: r.event_id };
  }

  public async sendDelayedEvent(
    delay: number | null,
    parentDelayId: string | null,
    eventType: string,
    content: IContent,
    stateKey: string | null = null,
    targetRoomId: string | null = null
  ): Promise<ISendDelayedEventDetails> {
    const roomId = targetRoomId || this.roomId;

    if (!roomId) throw new Error('Not in a room or not attached to a client');

    let delayOpts;
    if (delay !== null) {
      delayOpts = {
        delay,
        ...(parentDelayId !== null && { parent_delay_id: parentDelayId }),
      };
    } else if (parentDelayId !== null) {
      delayOpts = {
        parent_delay_id: parentDelayId,
      };
    } else {
      throw new Error('Must provide at least one of delay or parentDelayId');
    }

    let r: SendDelayedEventResponse | null;
    if (stateKey !== null) {
      // state event
      r = await (this.matrixClient as any)._unstable_sendDelayedStateEvent(
        roomId,
        delayOpts,
        eventType as keyof StateEvents,
        content as StateEvents[keyof StateEvents],
        stateKey
      );
    } else {
      // message event
      r = await (this.matrixClient as any)._unstable_sendDelayedEvent(
        roomId,
        delayOpts,
        null,
        eventType as keyof TimelineEvents,
        content as TimelineEvents[keyof TimelineEvents]
      );
    }

    if (!r) throw new Error('Failed to send delayed event');

    return {
      roomId,
      delayId: r.delay_id,
    };
  }

  public async updateDelayedEvent(
    delayId: string,
    action: UpdateDelayedEventAction
  ): Promise<void> {
    await (this.matrixClient as any)._unstable_updateDelayedEvent(delayId, action);
  }

  public async sendToDevice(
    eventType: string,
    encrypted: boolean,
    contentMap: { [userId: string]: { [deviceId: string]: object } }
  ): Promise<void> {
    if (encrypted) {
      const crypto = this.matrixClient.getCrypto();
      if (!crypto) throw new Error('E2EE not enabled');

      // attempt to re-batch these up into a single request
      const invertedContentMap: { [content: string]: { userId: string; deviceId: string }[] } = {};

      for (const userId of Object.keys(contentMap)) {
        const userContentMap = contentMap[userId];
        for (const deviceId of Object.keys(userContentMap)) {
          const content = userContentMap[deviceId];
          const stringifiedContent = JSON.stringify(content);
          invertedContentMap[stringifiedContent] = invertedContentMap[stringifiedContent] || [];
          invertedContentMap[stringifiedContent].push({ userId, deviceId });
        }
      }

      await Promise.all(
        Object.entries(invertedContentMap).map(async ([stringifiedContent, recipients]) => {
          const batch = await crypto.encryptToDeviceMessages(
            eventType,
            recipients,
            JSON.parse(stringifiedContent)
          );

          await this.matrixClient.queueToDevice(batch);
        })
      );
    } else {
      await this.matrixClient.queueToDevice({
        eventType,
        batch: Object.entries(contentMap).flatMap(([userId, userContentMap]) =>
          Object.entries(userContentMap).map(([deviceId, content]) => ({
            userId,
            deviceId,
            payload: content,
          }))
        ),
      });
    }
  }

  public async readRoomTimeline(
    roomId: string,
    eventType: string,
    msgtype: string | undefined,
    stateKey: string | undefined,
    limit: number,
    since: string | undefined
  ): Promise<IRoomEvent[]> {
    limit = limit > 0 ? Math.min(limit, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;

    const room = this.matrixClient.getRoom(roomId);
    if (room === null) return [];
    const results: any[] = [];
    const events = room.getLiveTimeline().getEvents(); // timelines are most recent last
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (results.length >= limit) break;
      if (since !== undefined && ev.getId() === since) break;

      if (ev.getType() !== eventType) continue;
      if (eventType === EventType.RoomMessage && msgtype && msgtype !== ev.getContent()['msgtype'])
        continue;
      if (stateKey !== undefined && ev.getStateKey() !== stateKey) continue;
      results.push(ev);
    }

    return results.map((e) => e.getEffectiveEvent() as IRoomEvent);
  }

  public async readRoomState(
    roomId: string,
    eventType: string,
    stateKey: string | undefined
  ): Promise<IRoomEvent[]> {
    const room = this.matrixClient.getRoom(roomId);
    if (room === null) return [];
    const state = room.getLiveTimeline().getState(Direction.Forward);
    if (state === undefined) return [];

    if (stateKey === undefined)
      return state.getStateEvents(eventType).map((e) => e.getEffectiveEvent() as IRoomEvent);
    const event = state.getStateEvents(eventType, stateKey);
    return event === null ? [] : [event.getEffectiveEvent() as IRoomEvent];
  }

  public async askOpenID(observer: SimpleObservable<IOpenIDUpdate>): Promise<void> {
    // For Element Call, auto-approve OpenID requests
    try {
      const token = await this.matrixClient.getOpenIdToken();
      observer.update({
        state: OpenIDRequestState.Allowed,
        token,
      });
    } catch (error) {
      observer.update({ state: OpenIDRequestState.Blocked });
    }
  }

  public async navigate(uri: string): Promise<void> {
    // In sayance-web, handle navigation - for now just log
  }

  public async *getTurnServers(): AsyncGenerator<ITurnServer> {
    if (!this.matrixClient.pollingTurnServers || !this.matrixClient.getTurnServers().length) return;

    let setTurnServer: (server: ITurnServer) => void;
    let setError: (error: Error) => void;

    const normalizeTurnServer = ({
      urls,
      username,
      credential,
    }: IClientTurnServer): ITurnServer => ({
      uris: urls,
      username,
      password: credential,
    });

    const onTurnServers = ([server]: IClientTurnServer[]): void =>
      setTurnServer(normalizeTurnServer(server));
    const onTurnServersError = (error: Error, fatal: boolean): void => {
      if (fatal) setError(error);
    };

    this.matrixClient.on(ClientEvent.TurnServers, onTurnServers);
    this.matrixClient.on(ClientEvent.TurnServersError, onTurnServersError);

    try {
      const initialTurnServer = this.matrixClient.getTurnServers()[0];
      yield normalizeTurnServer(initialTurnServer);

      // Repeatedly listen for new TURN servers until an error occurs or
      // the caller stops this generator
      while (true) {
        yield await new Promise<ITurnServer>((resolve, reject) => {
          setTurnServer = resolve;
          setError = reject;
        });
      }
    } finally {
      // The loop was broken - clean up
      this.matrixClient.off(ClientEvent.TurnServers, onTurnServers);
      this.matrixClient.off(ClientEvent.TurnServersError, onTurnServersError);
    }
  }

  public async readEventRelations(
    eventId: string,
    roomId?: string,
    relationType?: string,
    eventType?: string,
    from?: string,
    to?: string,
    limit?: number,
    direction?: 'f' | 'b'
  ): Promise<IReadEventRelationsResult> {
    const dir = direction as Direction;
    roomId = roomId ?? this.roomId;

    if (typeof roomId !== 'string') {
      throw new Error('Error while reading the current room');
    }

    const { events, nextBatch, prevBatch } = await this.matrixClient.relations(
      roomId,
      eventId,
      relationType ?? null,
      eventType ?? null,
      { from, to, limit, dir }
    );

    return {
      chunk: events.map((e) => e.getEffectiveEvent() as IRoomEvent),
      nextBatch: nextBatch ?? undefined,
      prevBatch: prevBatch ?? undefined,
    };
  }

  public async searchUserDirectory(
    searchTerm: string,
    limit?: number
  ): Promise<ISearchUserDirectoryResult> {
    const { limited, results } = await this.matrixClient.searchUserDirectory({
      term: searchTerm,
      limit,
    });

    return {
      limited,
      results: results.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      })),
    };
  }

  public async getMediaConfig(): Promise<IGetMediaConfigResult> {
    return await this.matrixClient.getMediaConfig();
  }

  public async uploadFile(file: XMLHttpRequestBodyInit): Promise<{ contentUri: string }> {
    const uploadResult = await this.matrixClient.uploadContent(file);
    return { contentUri: uploadResult.content_uri };
  }

  public async downloadFile(contentUri: string): Promise<{ file: XMLHttpRequestBodyInit }> {
    // For sayance-web, implement file download
    const response = await fetch(contentUri);
    const blob = await response.blob();
    return { file: blob };
  }

  public getKnownRooms(): string[] {
    return this.matrixClient.getVisibleRooms().map((r) => r.roomId);
  }

  public processError(error: unknown): IWidgetApiErrorResponseDataDetails | undefined {
    // Return undefined for now - this method is used for error processing
    // The actual error response format is handled by the Widget API itself
    return undefined;
  }
}
