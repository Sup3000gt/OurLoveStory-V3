export type UploadLogStage =
  | 'session.create'
  | 'session.read'
  | 'duplicate.check'
  | 'resume.match'
  | 'authorize'
  | 'r2.verify'
  | 'record.uploaded'
  | 'record.failed'
  | 'review'
  | 'confirm'
  | 'abandon';

export interface UploadLogEvent {
  level: 'info' | 'warn' | 'error';
  requestId: string;
  stage: UploadLogStage;
  ownerId?: string;
  memoryId?: string | null;
  sessionId?: string;
  sessionFileId?: string;
  attempt?: number;
  status?: number;
  durationMs?: number;
  errorCode?: string;
  itemCount?: number;
}

export function logUploadEvent(
  event: UploadLogEvent,
): void {
  console.log(JSON.stringify({
    event: 'photo_upload',
    ...event,
  }));
}