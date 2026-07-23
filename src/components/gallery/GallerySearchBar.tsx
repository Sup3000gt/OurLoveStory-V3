import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

interface GallerySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const SEARCH_DEBOUNCE_MS = 250;

export function GallerySearchBar({ value, onChange, onClear }: GallerySearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
  }, []);

  function handleChange(nextValue: string) {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => onChange(nextValue), SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    onClear();
    inputRef.current?.focus();
  }

  return (
    <div className="gallery-search">
      <label className="visually-hidden" htmlFor="gallery-search-input">
        {t('gallery.searchLabel')}
      </label>
      <input
        ref={inputRef}
        id="gallery-search-input"
        type="search"
        value={value}
        placeholder={t('gallery.searchPlaceholder')}
        aria-label={t('gallery.searchLabel')}
        onChange={(event) => handleChange(event.target.value)}
      />
      {value ? (
        <button className="gallery-clear-search" type="button" onClick={handleClear}>
          {t('gallery.clear')}
        </button>
      ) : null}
    </div>
  );
}
