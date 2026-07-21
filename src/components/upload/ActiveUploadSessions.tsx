import {
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  UploadSessionSummary,
} from '../../../shared/contracts';

export interface ActiveUploadSessionsProps {
  sessions: UploadSessionSummary[];
  busySessionId: string | null;
  untitledLabel: string;
  uploadingLabel: string;
  reviewLabel: string;
  resumeLabel: string;
  openReviewLabel: string;
  abandonLabel: string;
  progressLabel(
    progress: string,
  ): string;
  onOpen(
    session: UploadSessionSummary,
  ): void;
  onAbandon(
    session: UploadSessionSummary,
  ): void;
}

export function ActiveUploadSessions({
  sessions,
  busySessionId,
  untitledLabel,
  uploadingLabel,
  reviewLabel,
  resumeLabel,
  openReviewLabel,
  abandonLabel,
  progressLabel,
  onOpen,
  onAbandon,
}: ActiveUploadSessionsProps) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section
      className="active-upload-sessions"
      aria-label={resumeLabel}
    >
      {sessions.map((session) => {
        const action =
          sessionRecoveryAction(
            session,
          );

        const progress =
          sessionRecoveryProgress(
            session,
          );

        const busy =
          busySessionId === session.id;

        return (
          <article
            className="active-upload-session-card"
            key={session.id}
          >
            <div>
              <strong>
                {session.title
                  ?? untitledLabel}
              </strong>

              <span>
                {session.status
                  === 'review'
                  ? reviewLabel
                  : uploadingLabel}
              </span>

              <small>
                {progressLabel(
                  progress,
                )}
              </small>
            </div>

            <div className="active-upload-session-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  onOpen(session)
                }
              >
                <RotateCcw size={15} />
                {action === 'review'
                  ? openReviewLabel
                  : resumeLabel}
              </button>

              <button
                type="button"
                className="asset-delete-button"
                disabled={busy}
                onClick={() =>
                  onAbandon(session)
                }
              >
                <Trash2 size={15} />
                {abandonLabel}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function sessionRecoveryAction(
  session: UploadSessionSummary,
): 'resume' | 'review' {
  return session.status === 'review'
    ? 'review'
    : 'resume';
}

export function sessionRecoveryProgress(
  session: UploadSessionSummary,
): string {
  return (
    `${session.completedFileCount}`
    + `/${session.expectedFileCount}`
  );
}