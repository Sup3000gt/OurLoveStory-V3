import {
  ImageOff,
} from 'lucide-react';

export interface SessionFilePlaceholderProps {
  filename: string;
  message: string;
}

export function SessionFilePlaceholder({
  filename,
  message,
}: SessionFilePlaceholderProps) {
  return (
    <div
      className="session-file-placeholder"
      aria-label={`${filename}: ${message}`}
    >
      <ImageOff size={26} />
      <strong>
        {filename}
      </strong>
      <span>
        {message}
      </span>
    </div>
  );
}