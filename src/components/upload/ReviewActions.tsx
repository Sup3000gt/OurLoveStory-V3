import {
  Check,
  Save,
  Trash2,
} from 'lucide-react';

export interface ReviewActionsProps {
  busy: boolean;
  confirmDisabled: boolean;
  saveLabel: string;
  confirmLabel: string;
  abandonLabel: string;
  onSave(): void;
  onConfirm(): void;
  onAbandon(): void;
}

export function ReviewActions({
  busy,
  confirmDisabled,
  saveLabel,
  confirmLabel,
  abandonLabel,
  onSave,
  onConfirm,
  onAbandon,
}: ReviewActionsProps) {
  return (
    <div className="review-actions">
      <button
        type="button"
        className="asset-delete-button"
        disabled={busy}
        onClick={onAbandon}
      >
        <Trash2 size={16} />
        {abandonLabel}
      </button>

      <button
        type="button"
        className="secondary-button"
        disabled={busy}
        onClick={onSave}
      >
        <Save size={16} />
        {saveLabel}
      </button>

      <button
        type="button"
        className="primary-button"
        disabled={
          busy
          || confirmDisabled
        }
        onClick={onConfirm}
      >
        <Check size={16} />
        {confirmLabel}
      </button>
    </div>
  );
}