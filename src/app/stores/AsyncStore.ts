/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

import { TypedEventEmitter } from 'matrix-js-sdk/src/matrix';

export const UPDATE_EVENT = 'update';

export abstract class AsyncStore<T extends object> extends TypedEventEmitter<
  string,
  Record<string, any>
> {
  private static _instances = new Map<typeof AsyncStore, AsyncStore<any>>();

  protected constructor() {
    super();
  }

  public static get instance(): any {
    const constructor = this as typeof AsyncStore;
    if (!AsyncStore._instances.has(constructor)) {
      AsyncStore._instances.set(constructor, new (constructor as any)());
    }
    return AsyncStore._instances.get(constructor);
  }

  public emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  protected async onReady(): Promise<void> {
    // Default implementation - subclasses can override
  }

  protected async onNotReady(): Promise<void> {
    // Default implementation - subclasses can override
  }
} 