import {
  type FormEvent,
  useState,
} from 'react';
import {
  MEMORY_CATEGORIES,
  type Memory,
  type UpdateMemoryRequest,
} from '../../shared/contracts';
import {
  categoryTranslationKeys,
} from '../i18n/translations';
import {
  useTranslation,
} from '../i18n/useTranslation';

export interface MemoryEditFormProps {
  memory: Memory;
  busy: boolean;
  error: string;
  onCancel(): void;
  onSave(
    input: UpdateMemoryRequest,
  ): Promise<void>;
}

export function MemoryEditForm({
  memory,
  busy,
  error,
  onCancel,
  onSave,
}: MemoryEditFormProps) {
  const { t } = useTranslation();
  const [
    draft,
    setDraft,
  ] = useState({
    title: memory.title,
    location: memory.location,
    date: memory.date,
    category: memory.category,
    description:
      memory.description,
    featured: memory.featured,
    status: memory.status,
  });

  async function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    await onSave({
      title: draft.title.trim(),
      location:
        draft.location.trim(),
      date: draft.date,
      category: draft.category,
      description:
        draft.description.trim(),
      featured: draft.featured,
      status: draft.status,
    });
  }

  return (
    <form
      className="memory-edit-form"
      onSubmit={(event) =>
        void submit(event)
      }
    >
      <div className="memory-edit-grid">
        <label>
          <span>
            {t('detail.editTitle')}
          </span>
          <input
            name="title"
            value={draft.title}
            maxLength={120}
            required
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                title:
                  event.target.value,
              })
            }
          />
        </label>

        <label>
          <span>
            {t(
              'detail.editLocation',
            )}
          </span>
          <input
            name="location"
            value={draft.location}
            maxLength={160}
            required
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                location:
                  event.target.value,
              })
            }
          />
        </label>

        <label>
          <span>
            {t('detail.editDate')}
          </span>
          <input
            name="date"
            type="date"
            value={draft.date}
            required
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                date:
                  event.target.value,
              })
            }
          />
        </label>

        <label>
          <span>
            {t(
              'detail.editCategory',
            )}
          </span>
          <select
            name="category"
            value={draft.category}
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                category:
                  MEMORY_CATEGORIES
                    .find(
                      (category) =>
                        category
                        === event.target.value,
                    )
                  ?? draft.category,
              })
            }
          >
            {MEMORY_CATEGORIES.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {t(
                    categoryTranslationKeys[
                      category
                    ],
                  )}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>
            {t(
              'detail.editStatus',
            )}
          </span>
          <select
            name="status"
            value={draft.status}
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                status:
                  event.target.value
                    === 'draft'
                    ? 'draft'
                    : 'published',
              })
            }
          >
            <option value="published">
              {t(
                'detail.editPublished',
              )}
            </option>
            <option value="draft">
              {t(
                'detail.editDraft',
              )}
            </option>
          </select>
        </label>

        <label className="memory-edit-featured">
          <input
            name="featured"
            type="checkbox"
            checked={draft.featured}
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                featured:
                  event.target.checked,
              })
            }
          />
          <span>
            {t(
              'detail.editFeatured',
            )}
          </span>
        </label>

        <label className="memory-edit-description">
          <span>
            {t(
              'detail.editDescription',
            )}
          </span>
          <textarea
            name="description"
            value={draft.description}
            maxLength={600}
            rows={4}
            disabled={busy}
            onChange={(event) =>
              setDraft({
                ...draft,
                description:
                  event.target.value,
              })
            }
          />
        </label>
      </div>

      {error ? (
        <p
          className="memory-edit-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="memory-edit-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={onCancel}
        >
          {t('detail.editCancel')}
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={busy}
        >
          {busy
            ? t(
                'detail.editSaving',
              )
            : t(
                'detail.editSave',
              )}
        </button>
      </div>
    </form>
  );
}
