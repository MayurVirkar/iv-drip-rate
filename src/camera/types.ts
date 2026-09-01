export type CameraState =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'paused'
  | 'error'
  | 'unsupported';

export type CameraErrorKind =
  | 'permission-denied'
  | 'no-device'
  | 'in-use'
  | 'insecure-context'
  | 'unsupported'
  | 'stream-ended'
  | 'unknown';

export interface CameraError {
  kind: CameraErrorKind;
  message: string;
}
