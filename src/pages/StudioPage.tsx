import { SignInButton, useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CloudUpload,
  Heart,
  ImagePlus,
  LockKeyhole,
  MapPin,
  Save,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MEMORY_CATEGORIES,
  type CreateMemoryRequest,
  type MemoryStatus,
  type Visibility,
} from '../../shared/contracts';
import { authorizeUploads, createMemory, uploadFileDirectly } from '../lib/api';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

interface MemoryDraft {
  title: string;
  location: string;
  date: string;
  category: (typeof MEMORY_CATEGORIES)[number];
  description: string;
  visibility: Visibility;
  featured: boolean;
}

interface SelectedMedia {
  id: string;
  file: File;
  previewUrl: string;
}

const initialDraft: MemoryDraft = {
  title: '',
  location: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'Travel',
  description: '',
  visibility: 'private',
  featured: false,
};

interface StudioPageProps {
  isOwner: boolean;
  ownerCheckLoading: boolean;
  ownerCheckError: Error | null;
}

export function StudioPage({ isOwner, ownerCheckLoading, ownerCheckError }: StudioPageProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<MemoryDraft>(initialDraft);
  const [files, setFiles] = useState<SelectedMedia[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<SelectedMedia[]>([]);

  useEffect(() => {
    fileRef.current = files;
  }, [files]);

  useEffect(() => () => {
    fileRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const cover = useMemo(
    () => files.find((item) => item.id === coverId) ?? files[0] ?? null,
    [coverId, files],
  );

  if (!isLoaded || ownerCheckLoading) {
    return <main className="login-required"><p>Checking owner access…</p></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>Owner access only</h1>
        <p>Sign in with one of the two owner accounts to upload or view private memories.</p>
        <SignInButton mode="modal"><button className="primary-button">Owner login</button></SignInButton>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>This account is not an owner.</h1>
        <p>{ownerCheckError?.message ?? 'Add this Clerk user ID to the D1 owners table only if it should have access.'}</p>
      </main>
    );
  }

  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    setError('');
    const nextFiles = Array.from(selected);
    try {
      validateSelectedFiles(nextFiles);
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      const next = nextFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setFiles(next);
      setCoverId(next[0]?.id ?? null);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'The selected files are invalid.');
    }
  }

  function removeFile(id: string) {
    const removed = files.find((item) => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    const next = files.filter((item) => item.id !== id);
    setFiles(next);
    if (coverId === id) setCoverId(next[0]?.id ?? null);
  }

  function resetForm() {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    setCoverId(null);
    setDraft(initialDraft);
    setError('');
    setProgress('');
  }

  async function saveMemory(status: MemoryStatus) {
    setError('');
    if (!draft.title.trim() || !draft.location.trim() || !draft.date) {
      setError('Title, location, and date are required.');
      return;
    }
    if (!cover || files.length === 0) {
      setError('Choose at least one photo or video.');
      return;
    }

    setBusy(true);
    try {
      setProgress('Preparing secure uploads…');
      const authorization = await authorizeUploads(files.map((item) => item.file), getToken);
      for (let index = 0; index < authorization.uploads.length; index += 1) {
        const upload = authorization.uploads[index];
        const selected = files[index];
        if (!upload || !selected) throw new Error('Upload authorization did not match the selected files.');
        setProgress(`Uploading ${index + 1} of ${files.length}: ${selected.file.name}`);
        await uploadFileDirectly(upload.uploadUrl, upload.headers, selected.file);
      }

      const coverIndex = files.findIndex((item) => item.id === cover.id);
      const coverUpload = authorization.uploads[coverIndex];
      if (!coverUpload) throw new Error('The cover file could not be matched to its upload.');
      const request: CreateMemoryRequest = {
        title: draft.title,
        location: draft.location,
        date: draft.date,
        category: draft.category,
        description: draft.description,
        visibility: draft.visibility,
        featured: draft.featured,
        status,
        coverObjectKey: coverUpload.objectKey,
        assets: authorization.uploads.map((upload, index) => ({
          objectKey: upload.objectKey,
          originalFilename: upload.originalFilename,
          mimeType: files[index]!.file.type,
          sizeBytes: upload.sizeBytes,
          mediaType: upload.mediaType,
          sortOrder: index,
        })),
      };

      setProgress(status === 'draft' ? 'Saving draft…' : 'Publishing memory…');
      const memory = await createMemory(request, getToken);
      await queryClient.invalidateQueries({ queryKey: ['memories'] });
      resetForm();
      navigate(status === 'published' ? `/memory/${memory.id}` : '/gallery');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The memory could not be saved.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void saveMemory('published');
  }

  return (
    <main className="studio-page">
      <header className="studio-intro">
        <p>OWNER STUDIO</p>
        <h1>Upload a New Memory</h1>
        <em>Preserve the little moments that mean everything.</em>
      </header>
      <form className="studio-layout" onSubmit={submit}>
        <section className="form-panel">
          <label className="field-label">1. Upload photos or videos</label>
          <label className="dropzone">
            <CloudUpload size={38} />
            <strong>Choose photos or videos</strong>
            <span>click to browse from your device</span>
            <small>JPEG, PNG, WebP, GIF, MP4, MOV or WebM · up to 20 files</small>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              onChange={(event) => selectFiles(event.target.files)}
              disabled={busy}
            />
          </label>

          {files.length > 0 ? (
            <div className="upload-strip upload-preview-strip">
              {files.map((item) => (
                <article className={`upload-preview ${coverId === item.id ? 'cover' : ''}`} key={item.id}>
                  <div className="upload-preview-media">
                    {item.file.type.startsWith('video/') ? (
                      <video src={item.previewUrl} muted playsInline />
                    ) : (
                      <img src={item.previewUrl} alt={item.file.name} />
                    )}
                  </div>
                  <button
                    className="cover-button"
                    type="button"
                    onClick={() => setCoverId(item.id)}
                    aria-label={`Use ${item.file.name} as cover`}
                  >
                    <Star size={13} fill={coverId === item.id ? 'currentColor' : 'none'} />
                    {coverId === item.id ? 'Cover' : 'Set cover'}
                  </button>
                  <button className="remove-file-button" type="button" onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`}>
                    <Trash2 size={14} />
                  </button>
                  <small>{item.file.name}<br />{formatBytes(item.file.size)}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="upload-empty-hint"><ImagePlus size={18} />Your selected media will appear here.</div>
          )}

          <div className="fields-grid">
            <label>
              <span>2. Title</span>
              <input required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <label>
              <span>3. Location</span>
              <div className="input-icon"><MapPin size={16} /><input required maxLength={160} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></div>
            </label>
            <label>
              <span>4. Date</span>
              <div className="input-icon"><CalendarDays size={16} /><input required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
            </label>
            <label>
              <span>5. Category</span>
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MemoryDraft['category'] })}>
                {MEMORY_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
          </div>

          <label className="full-field">
            <span>6. Short description / notes</span>
            <textarea maxLength={600} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <small>{draft.description.length}/600</small>
          </label>

          <fieldset className="visibility-field">
            <legend>7. Who can see this memory?</legend>
            <button type="button" className={draft.visibility === 'public' ? 'selected' : ''} onClick={() => setDraft({ ...draft, visibility: 'public' })}>
              Public <small>Anyone can view and download</small>
            </button>
            <button type="button" className={draft.visibility === 'private' ? 'selected' : ''} onClick={() => setDraft({ ...draft, visibility: 'private' })}>
              <LockKeyhole size={15} />Private <small>Only signed-in owners</small>
            </button>
          </fieldset>

          <label className="check-row">
            <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />
            <span><strong>Highlight this memory</strong><small>Featured memories may appear on the homepage.</small></span>
          </label>

          {draft.visibility === 'public' ? (
            <p className="privacy-warning">Public originals may contain camera metadata. Remove GPS metadata before uploading anything sensitive.</p>
          ) : null}
          {error ? <div className="form-message error" role="alert">{error}</div> : null}
          {progress ? <div className="form-message" aria-live="polite">{progress}</div> : null}

          <div className="form-actions">
            <button type="button" className="quiet-button" onClick={resetForm} disabled={busy}>Cancel</button>
            <button type="button" className="secondary-button" onClick={() => void saveMemory('draft')} disabled={busy}>
              <Save size={16} />Save Draft
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              <Send size={16} />Publish Memory <Heart size={15} />
            </button>
          </div>
        </section>

        <aside className="preview-panel">
          <div className="preview-heading"><h2>Preview</h2><p>This is how it will appear in your gallery. ♡</p></div>
          <article className="preview-card">
            <div className="preview-media">
              {cover ? (
                cover.file.type.startsWith('video/') ? <video src={cover.previewUrl} controls /> : <img src={cover.previewUrl} alt="Memory preview" />
              ) : (
                <div className="preview-placeholder"><ImagePlus size={42} /><span>Choose a cover photo or video</span></div>
              )}
              <span className={`visibility-badge ${draft.visibility}`}>
                {draft.visibility === 'private' ? <LockKeyhole size={12} /> : null}{draft.visibility}
              </span>
            </div>
            <div className="preview-copy">
              <h3>{draft.title || 'Untitled Memory'}</h3>
              <div>
                <span><MapPin size={14} />{draft.location || 'Location'}</span>
                <span><CalendarDays size={14} />{draft.date}</span>
              </div>
              <p>{draft.description || 'Add a few words about this memory.'}</p>
            </div>
          </article>
          <div className="preview-note">Take your time to add the perfect details.<br /><em>The best memories are the ones we never want to forget. ♡</em></div>
        </aside>
      </form>
    </main>
  );
}

function validateSelectedFiles(files: File[]) {
  if (files.length === 0) throw new Error('Choose at least one file.');
  if (files.length > 20) throw new Error('A memory can contain up to 20 files.');
  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error(`${file.name} uses an unsupported file type.`);
    const limit = file.type.startsWith('image/') ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > limit) {
      throw new Error(file.type.startsWith('image/') ? `${file.name} exceeds 50 MiB.` : `${file.name} exceeds 2 GiB.`);
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
