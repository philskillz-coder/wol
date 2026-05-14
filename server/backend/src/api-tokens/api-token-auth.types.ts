export interface ValidatedApiToken {
  userId: string;
  /** Present and non-empty: token may only use these device IDs. Omitted: all devices. */
  apiTokenDeviceScope?: string[];
}
