/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { MatrixClient } from 'matrix-js-sdk/src/matrix';
import { MatrixRTCSessionManagerEvents } from 'matrix-js-sdk/src/matrixrtc';
import { CallStore } from '../stores/CallStore';

/**
 * Initialize the call system with the Matrix client.
 * This should be called after the Matrix client is ready.
 */
export function initializeCallSystem(matrixClient: MatrixClient): void {
  // Initialize the call store with the matrix client
  CallStore.instance.initialize(matrixClient);

  // Clean up any existing calls when client disconnects
  matrixClient.on('syncStateChange' as any, (state: string) => {
    if (state === 'ERROR' || state === 'STOPPED') {
      CallStore.instance.clean().catch(console.error);
    }
  });

  console.log('Call system initialized');
}

/**
 * Clean up the call system
 */
export function cleanupCallSystem(): void {
  CallStore.instance.clean().catch(console.error);
  console.log('Call system cleaned up');
} 