/*
Copyright 2024 Sayance

SPDX-License-Identifier: AGPL-3.0-only
*/

export class WidgetType {
  public static readonly CALL = new WidgetType('m.call', 'm.call');
  public static readonly JITSI = new WidgetType('m.jitsi', 'jitsi');
  public static readonly CUSTOM = new WidgetType('m.custom', 'm.custom');

  public constructor(
    public readonly preferred: string,
    public readonly legacy: string,
  ) {}

  public matches(type: string): boolean {
    return type === this.preferred || type === this.legacy;
  }

  public static fromString(type: string): WidgetType {
    // First try and match it against something we're already aware of
    const known = Object.values(WidgetType).filter((v) => v instanceof WidgetType);
    const knownMatch = known.find((w) => w.matches(type));
    if (knownMatch) return knownMatch;

    // If that fails, invent a new widget type
    return new WidgetType(type, type);
  }
} 