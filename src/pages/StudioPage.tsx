import { CalendarDays, CloudUpload, Heart, ImagePlus, LockKeyhole, MapPin, Save, Send, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

export interface MemoryDraft {
  title: string; location: string; date: string; category: string; description: string;
  visibility: 'public' | 'private'; featured: boolean;
}

export function StudioPage({ isSignedIn }: { isSignedIn: boolean }) {
  const [draft, setDraft] = useState<MemoryDraft>({ title: 'Trip to Paris', location: 'Paris, France', date: '2024-06-02', category: 'Travel', description: 'An unforgettable evening by the Eiffel Tower.', visibility: 'private', featured: true });
  const [files, setFiles] = useState<File[]>([]);
  const preview = useMemo(() => files[0] ? URL.createObjectURL(files[0]) : '/media/paris.jpg', [files]);

  if (!isSignedIn) return <main className="login-required"><LockKeyhole size={40}/><h1>Owner access only</h1><p>Sign in with one of the two owner accounts to upload or view private memories.</p></main>;

  function submit(event: FormEvent) { event.preventDefault(); alert('UI complete. Connect Clerk, R2 and D1 using README_SETUP.md to publish this memory.'); }

  return (
    <main className="studio-page">
      <header className="studio-intro"><p>OWNER STUDIO</p><h1>Upload a New Memory</h1><em>Preserve the little moments that mean everything.</em></header>
      <form className="studio-layout" onSubmit={submit}>
        <section className="form-panel">
          <label className="field-label">1. Upload photos or videos</label>
          <label className="dropzone">
            <CloudUpload size={38}/><strong>Drag and drop photos or videos here</strong><span>or click to browse</span><small>JPG, PNG, WEBP, HEIC, MP4 or MOV</small>
            <input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles(Array.from(e.target.files ?? []))}/>
          </label>
          <div className="upload-strip">
            {files.length === 0 ? <><img src="/media/paris.jpg" alt="Example upload"/><img src="/media/coffee.jpg" alt="Example upload"/></> : files.map((file, index) => <div className="file-chip" key={`${file.name}-${index}`}><ImagePlus size={20}/><span>{file.name}</span><button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))}><X size={14}/></button></div>)}
          </div>
          <div className="fields-grid">
            <label><span>2. Title</span><input value={draft.title} onChange={(e) => setDraft({...draft, title: e.target.value})}/></label>
            <label><span>3. Location</span><div className="input-icon"><MapPin size={16}/><input value={draft.location} onChange={(e) => setDraft({...draft, location: e.target.value})}/></div></label>
            <label><span>4. Date</span><div className="input-icon"><CalendarDays size={16}/><input type="date" value={draft.date} onChange={(e) => setDraft({...draft, date: e.target.value})}/></div></label>
            <label><span>5. Category</span><select value={draft.category} onChange={(e) => setDraft({...draft, category: e.target.value})}><option>Travel</option><option>Daily Life</option><option>Homemade Food</option><option>Dining Out</option><option>Special Moments</option></select></label>
          </div>
          <label className="full-field"><span>6. Short description / notes</span><textarea maxLength={300} value={draft.description} onChange={(e) => setDraft({...draft, description: e.target.value})}/><small>{draft.description.length}/300</small></label>
          <fieldset className="visibility-field"><legend>7. Who can see this memory?</legend><button type="button" className={draft.visibility === 'public' ? 'selected' : ''} onClick={() => setDraft({...draft, visibility: 'public'})}>Public <small>Anyone can view and download</small></button><button type="button" className={draft.visibility === 'private' ? 'selected' : ''} onClick={() => setDraft({...draft, visibility: 'private'})}><LockKeyhole size={15}/>Private <small>Only signed-in owners</small></button></fieldset>
          <label className="check-row"><input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({...draft, featured: e.target.checked})}/><span><strong>Highlight this memory</strong><small>Featured memories may appear on the homepage.</small></span></label>
          <div className="form-actions"><button type="button" className="quiet-button">Cancel</button><button type="button" className="secondary-button"><Save size={16}/>Save Draft</button><button type="submit" className="primary-button"><Send size={16}/>Publish Memory <Heart size={15}/></button></div>
        </section>
        <aside className="preview-panel">
          <div className="preview-heading"><h2>Preview</h2><p>This is how it will appear in your gallery. ♡</p></div>
          <article className="preview-card"><div className="preview-media">{files[0]?.type.startsWith('video/') ? <video src={preview} controls/> : <img src={preview} alt="Memory preview"/>}<span className={`visibility-badge ${draft.visibility}`}>{draft.visibility === 'private' ? <LockKeyhole size={12}/> : null}{draft.visibility}</span></div><div className="preview-copy"><h3>{draft.title || 'Untitled Memory'}</h3><div><span><MapPin size={14}/>{draft.location || 'Location'}</span><span><CalendarDays size={14}/>{draft.date}</span></div><p>{draft.description}</p></div></article>
          <div className="preview-note">Take your time to add the perfect details.<br/><em>The best memories are the ones we never want to forget. ♡</em></div>
        </aside>
      </form>
    </main>
  );
}
