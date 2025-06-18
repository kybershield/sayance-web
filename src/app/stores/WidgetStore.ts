/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { IWidgetData, Widget } from 'matrix-widget-api';
import { AsyncStore, UPDATE_EVENT } from './AsyncStore';

export interface IApp {
  id: string;
  roomId: string | null;
  name: string;
  type: string;
  url: string;
  creatorUserId: string;
  waitForIframeLoad: boolean;
  data?: IWidgetData;
}

export interface IWidget {
  id: string;
  name: string;
  type: string;
  url: string;
  data?: IWidgetData;
  creatorUserId: string;
  waitForIframeLoad?: boolean;
}

export function isAppWidget(widget: IWidget | IApp): widget is IApp {
  return 'roomId' in widget;
}

export class WidgetStore extends AsyncStore<{}> {
  private roomWidgets = new Map<string, Widget[]>();
  private virtualWidgets = new Map<string, Widget[]>();

  public getApps(roomId: string): IApp[] {
    const roomApps = this.roomWidgets.get(roomId) || [];
    const virtualApps = this.virtualWidgets.get(roomId) || [];
    return [...roomApps, ...virtualApps];
  }

  public addVirtualWidget(widget: IWidget, roomId: string): IApp {
    const app: IApp = {
      ...widget,
      roomId,
      waitForIframeLoad: widget.waitForIframeLoad ?? true,
    };

    const existingWidgets = this.virtualWidgets.get(roomId) || [];
    this.virtualWidgets.set(roomId, [...existingWidgets, app]);

    return app;
  }

  public removeVirtualWidget(widgetId: string, roomId: string): void {
    const existingWidgets = this.virtualWidgets.get(roomId) || [];
    const filteredWidgets = existingWidgets.filter(w => w.id !== widgetId);
    
    if (filteredWidgets.length === 0) {
      this.virtualWidgets.delete(roomId);
    } else {
      this.virtualWidgets.set(roomId, filteredWidgets);
    }

    this.emit(UPDATE_EVENT, roomId);
  }

  public getWidget(widgetId: string, roomId: string): Widget | null {
    const apps = this.getApps(roomId);
    return apps.find(app => app.id === widgetId) || null;
  }

  public get(widgetId: string, roomId: string): IApp | null {
    return this.getWidget(widgetId, roomId);
  }

  public static get instance(): WidgetStore {
    return super.instance;
  }
} 