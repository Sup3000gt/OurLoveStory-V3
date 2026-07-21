export interface SessionProgressBannerProps {
  completed: number;
  total: number;
  message: string;
  error: string;
}

export function SessionProgressBanner({
  completed,
  total,
  message,
  error,
}: SessionProgressBannerProps) {
  return (
    <div className="session-progress-stack">
      <div
        className="session-progress-banner"
        aria-live="polite"
      >
        <strong>
          {completed}/{total}
        </strong>
        <span>
          {message}
        </span>
      </div>

      {error ? (
        <p
          className="form-message error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}