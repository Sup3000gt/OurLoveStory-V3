import { useEffect, useRef, useState } from 'react';
import { MAX_MEMORY_SEARCH_LENGTH } from '../../../shared/memory-discovery';
import { useTranslation } from '../../i18n/useTranslation';

interface GallerySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function GallerySearchBar({ value, onChange, onClear }: GallerySearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  const lastCommittedValueRef = useRef(value);
  const [draftValue, setDraftValue] = useState(value);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (value === lastCommittedValueRef.current) return;
    lastCommittedValueRef.current = value;
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    setDraftValue(value);
  }, [value]);

  useEffect(() => () => {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
  }, []);

  function handleChange(nextValue: string) {
    setDraftValue(nextValue);
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => onChangeRef.current(nextValue), SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
    setDraftValue('');
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
        value={draftValue}
        maxLength={MAX_MEMORY_SEARCH_LENGTH}
        placeholder={t('gallery.searchPlaceholder')}
        aria-label={t('gallery.searchLabel')}
        onChange={(event) => handleChange(event.target.value)}
      />
      {draftValue ? (
        <button className="gallery-clear-search" type="button" onClick={handleClear}>
          {t('gallery.clear')}
        </button>
      ) : null}
    </div>
  );
}
