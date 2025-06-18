/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { logger } from 'matrix-js-sdk/src/logger';
import { type MatrixRTCSession, MatrixRTCSessionManagerEvents } from 'matrix-js-sdk/src/matrixrtc';
import type { Room, MatrixClient } from 'matrix-js-sdk/src/matrix';
import { AsyncStore, UPDATE_EVENT } from './AsyncStore';
import { Call, CallEvent, ConnectionState } from '../models/Call';
import { WidgetStore } from './WidgetStore';

export enum CallStoreEvent {
  // Signals a change in the call associated with a given room
  Call = 'call',
  // Signals a change in the active calls
  ConnectedCalls = 'connected_calls',
}

interface CallEventListenerMap {
  [CallEvent.ConnectionState]: (state: ConnectionState) => void;
  [CallEvent.Destroy]: () => void;
}

export class CallStore extends AsyncStore<{}> {
  private calls = new Map<string, Call>();
  private callListeners = new Map<Call, Map<string, (...args: any[]) => void>>();
  private _connectedCalls = new Set<Call>();
  private matrixClient: MatrixClient | null = null;

  public get connectedCalls(): Set<Call> {
    return this._connectedCalls;
  }

  public initialize(client: MatrixClient): void {
    if (this.matrixClient) return; // Already initialized
    
    this.matrixClient = client;
    
    // Initialize all existing rooms
    for (const room of client.getRooms()) {
      this.updateRoom(room);
    }
    
    // Listen for widget changes
    WidgetStore.instance.on(UPDATE_EVENT, this.onWidgets);
    
    // Listen for RTC session changes
    if (client.matrixRTC) {
      client.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionStarted, this.onRTCSessionStart);
    }
  }

  public getCall(roomId: string): Call | null {
    return this.calls.get(roomId) ?? null;
  }

  public updateRoom(room: Room): void {
    const roomId = room.roomId;
    const call = Call.get(room);
    const existingCall = this.calls.get(roomId);

    if (call && existingCall !== call) {
      this.setCall(roomId, call);
    } else if (!call && existingCall) {
      this.setCall(roomId, null);
    }
  }

  private setCall(roomId: string, call: Call | null): void {
    const existingCall = this.calls.get(roomId);
    if (existingCall === call) return;

    if (existingCall) {
      const listeners = this.callListeners.get(existingCall);
      if (listeners) {
        for (const [event, listener] of listeners) {
          existingCall.off(event as any, listener);
        }
      }
      this.callListeners.delete(existingCall);
      this.calls.delete(roomId);
    }

    if (call) {
      const listeners = new Map<string, (...args: any[]) => void>();
      
      const onConnectionState = (state: ConnectionState): void => {
        if (state === ConnectionState.Connected) {
          this._connectedCalls.add(call);
        } else {
          this._connectedCalls.delete(call);
        }
        this.emit(CallStoreEvent.ConnectedCalls);
      };

      const onDestroy = (): void => {
        this.setCall(roomId, null);
      };

      listeners.set(CallEvent.ConnectionState, onConnectionState);
      listeners.set(CallEvent.Destroy, onDestroy);

      for (const [event, listener] of listeners) {
        call.on(event as any, listener);
      }

      this.callListeners.set(call, listeners);
      this.calls.set(roomId, call);

      // Initialize connected state
      if (call.connectionState === ConnectionState.Connected) {
        this._connectedCalls.add(call);
      }
    }

    this.emit(CallStoreEvent.Call, roomId, call);
  }

  private onWidgets = (roomId: string | null): void => {
    if (!this.matrixClient) return;
    
    if (roomId === null) {
      // Widget store is initializing, update all rooms
      for (const room of this.matrixClient.getRooms()) {
        this.updateRoom(room);
      }
    } else {
      const room = this.matrixClient.getRoom(roomId);
      if (room) {
        this.updateRoom(room);
      }
    }
  };

  private onRTCSessionStart = (roomId: string, session: MatrixRTCSession): void => {
    const room = session.room;
    if (room) {
      this.updateRoom(room);
    }
  };

  public async clean(): Promise<void> {
    // Clean up any existing calls
    for (const call of this.calls.values()) {
      await call.clean();
    }
  }

  public static get instance(): CallStore {
    return super.instance;
  }
} 