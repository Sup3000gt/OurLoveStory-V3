import { useEffect, useRef, useState } from 'react';
import { shareLink } from '../lib/share-link';

interface ShareLinkButtonProps {
  title: string;
  url: string;
  label: string;
  copiedLabel: string;
  fallbackLabel: string;
}

export function ShareLinkButton({
  title,
  url,
  label,
  copiedLabel,
  fallbackLabel,
}: ShareLinkButtonProps) {
  const [feedback, setFeedback] = useState('');
  const [showManualLink, setShowManualLink] = useState(false);
  const manualLinkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showManualLink) return;

    manualLinkRef.current?.focus();
    manualLinkRef.current?.select();
  }, [showManualLink]);

  async function handleShare() {
    const result = await shareLink({ title, url });

    if (result === 'copied') {
      setShowManualLink(false);
      setFeedback(copiedLabel);
      return;
    }

    if (result === 'manual') {
      setFeedback(fallbackLabel);
      setShowManualLink(true);
    }
  }

  return (
    <span className="share-link-control">
      <button className="share-link-button secondary-button" type="button" onClick={() => void handleShare()}>
        {label}
      </button>
      <span className="visually-hidden" aria-live="polite">{feedback}</span>
      {showManualLink ? (
        <label className="share-link-manual">
          <span>{fallbackLabel}</span>
          <input ref={manualLinkRef} type="text" value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
    </span>
  );
}
