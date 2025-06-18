/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { ClientWidgetApi } from 'matrix-widget-api';
import { AsyncStore } from './AsyncStore';

export enum WidgetMessagingStoreEvent {
  StoreMessaging = 'store_messaging',
  StopMessaging = 'stop_messaging',
}

export class WidgetMessagingStore extends AsyncStore<{}> {
  private messagingByUid = new Map<string, ClientWidgetApi>();

  public storeMessaging(uid: string, widgetApi: ClientWidgetApi): void {
    this.stopMessagingByUid(uid);
    this.messagingByUid.set(uid, widgetApi);
    this.emit(WidgetMessagingStoreEvent.StoreMessaging, uid, widgetApi);
  }

  public stopMessagingByUid(uid: string): void {
    const widgetApi = this.messagingByUid.get(uid);
    if (widgetApi) {
      try {
        widgetApi.stop();
      } catch (e) {
        // Ignore
      }
      this.messagingByUid.delete(uid);
      this.emit(WidgetMessagingStoreEvent.StopMessaging, uid);
    }
  }

  public getMessagingForUid(uid: string): ClientWidgetApi | null {
    return this.messagingByUid.get(uid) || null;
  }

  public static get instance(): WidgetMessagingStore {
    return super.instance;
  }
} 