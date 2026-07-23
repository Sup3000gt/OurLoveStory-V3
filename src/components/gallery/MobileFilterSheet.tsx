import { useEffect, useRef, useState } from 'react';
import type { MemoryFacets } from '../../../shared/memory-discovery';
import { useTranslation } from '../../i18n/useTranslation';
import {
  emptyGalleryFilterState,
  hasActiveGalleryFilters,
  normalizeGalleryFilterState,
  type GalleryFilterState,
} from '../../lib/gallery-filters';
import { GalleryFilters } from './GalleryFilters';

interface MobileFilterSheetProps {
  state: GalleryFilterState;
  facets: MemoryFacets | undefined;
  onApply: (next: GalleryFilterState) => void;
}

function activeFilterCount(state: GalleryFilterState) {
  return [state.query, state.category !== 'All', state.year, state.month !== null]
    .filter(Boolean)
    .length;
}

export function MobileFilterSheet({ state, facets, onApply }: MobileFilterSheetProps) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<GalleryFilterState>(state);
  const count = hasActiveGalleryFilters(state) ? activeFilterCount(state) : 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      dialog.querySelector<HTMLElement>('button, select')?.focus();
      return;
    }

    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function open() {
    setDraft({ ...state });
    setIsOpen(true);
  }

  function apply() {
    onApply(normalizeGalleryFilterState(draft));
    close();
  }

  return (
    <div className="gallery-mobile-filters">
      <button ref={triggerRef} className="secondary-button" type="button" onClick={open}>
        {t('gallery.filters', { count })}
      </button>
      <dialog
        ref={dialogRef}
        className="gallery-filter-dialog"
        aria-modal="true"
        aria-labelledby="gallery-filter-dialog-title"
        aria-describedby="gallery-filter-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="gallery-filter-dialog-copy">
          <h2 id="gallery-filter-dialog-title">{t('gallery.filtersTitle')}</h2>
          <p id="gallery-filter-dialog-description">{t('gallery.filterDescription')}</p>
        </div>
        <GalleryFilters
          state={draft}
          facets={facets}
          onChange={setDraft}
          onClear={() => setDraft(emptyGalleryFilterState)}
        />
        <div className="gallery-filter-dialog-actions">
          <button className="secondary-button" type="button" onClick={close}>
            {t('gallery.cancel')}
          </button>
          <button className="primary-button" type="button" onClick={apply}>
            {t('gallery.applyFilters')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
