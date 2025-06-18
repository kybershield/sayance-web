/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { type IWidgetApiRequest } from 'matrix-widget-api';

export enum ElementWidgetActions {
  // All of these actions are currently specific to Jitsi and Element Call
  JoinCall = 'io.element.join',
  HangupCall = 'im.vector.hangup',
  Close = 'io.element.close',
  CallParticipants = 'io.element.participants',
  StartLiveStream = 'im.vector.start_live_stream',

  // Actions for switching layouts
  TileLayout = 'io.element.tile_layout',
  SpotlightLayout = 'io.element.spotlight_layout',

  OpenIntegrationManager = 'integration_manager_open',
  ViewRoom = 'io.element.view_room',

  // Device mute control
  DeviceMute = 'io.element.device_mute',
}

export interface IHangupCallApiRequest extends IWidgetApiRequest {
  data: {
    errorMessage?: string;
  };
}

export interface IViewRoomApiRequest extends IWidgetApiRequest {
  data: {
    room_id: string;
  };
} 