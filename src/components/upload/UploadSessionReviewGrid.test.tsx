import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ReviewDraft } from '../../lib/upload-session-review';
import {
  canMoveReviewFile,
  dragDirection,
  UploadSessionReviewGrid,
} from './UploadSessionReviewGrid';

const roots: Array<{
  root: ReturnType<typeof createRoot>;
  container: HTMLDivElement;
}> = [];

afterEach(() => {
  for (const { root, container } of roots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.restoreAllMocks();
});

const draft: ReviewDraft = {
  sessionId: 'session-a',
  proposedCoverSessionFileId: 'file-a',
  files: [{
    id: 'file-a',
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    serverStatus: 'uploaded',
    duplicate: false,
    targetVisibility: 'private',
    allowDuplicate: false,
    skipped: false,
    reviewSortOrder: 0,
  }],
};

const labels = {
  missingPreview: 'No preview',
  unavailablePreview: 'Preview unavailable',
  retryPreview: 'Retry',
  public: 'Public',
  private: 'Private',
  duplicateSkipped: 'Duplicate',
  stillAdd: 'Still add',
  remove: 'Remove',
  include: 'Include',
  setCover: 'Set cover',
  cover: 'Cover',
  moveUp: 'Move up',
  moveDown: 'Move down',
};

function renderGrid(previewUrl: string) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(
    <UploadSessionReviewGrid
      draft={draft}
      previewBySessionFileId={new Map([['file-a', previewUrl]])}
      busy={false}
      labels={labels}
      onVisibility={() => undefined}
      onKeepDuplicate={() => undefined}
      onSkipped={() => undefined}
      onCover={() => undefined}
      onMove={() => undefined}
    />,
  ));
  return container;
}

describe('Review grid helpers', () => {
  it('prevents moving the first included item up', () => {
    expect(
      canMoveReviewFile(
        0,
        3,
        'up',
      ),
    ).toBe(false);
  });

  it('allows moving the first included item down', () => {
    expect(
      canMoveReviewFile(
        0,
        3,
        'down',
      ),
    ).toBe(true);
  });

  it('maps drag indices to a movement direction', () => {
    expect(
      dragDirection(2, 0),
    ).toBe('up');

    expect(
      dragDirection(0, 2),
    ).toBe('down');

    expect(
      dragDirection(1, 1),
    ).toBeNull();
  });
});

describe('UploadSessionReviewGrid thumbnail recovery', () => {
  it('shows Retry when a thumbnail errors and changes only the retry query', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const container = renderGrid('/api/thumbnail?size=small');

    act(() => container.querySelector('img')?.dispatchEvent(new Event('error')));

    expect(container.textContent).toContain('Preview unavailable');
    expect(container.textContent).toContain('Retry');

    act(() => container.querySelector('button')?.click());

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/api/thumbnail?size=small&retry=123',
    );
  });
});

describe('UploadSessionReviewGrid order controls', () => {
  it('keeps move controls in one equal-width column', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/styles/feature-upgrades.css'),
      'utf8',
    );

    expect(styles).toMatch(
      /\.review-order-actions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
    );
    expect(styles).toMatch(
      /\.review-order-actions button\s*\{[\s\S]*?width:\s*100%;[\s\S]*?justify-content:\s*center;/,
    );
  });
});

describe('UploadSessionReviewGrid card controls', () => {
  it('keeps visibility, cover, and remove actions aligned', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/styles/feature-upgrades.css'),
      'utf8',
    );

    expect(styles).toMatch(
      /\.review-card-controls\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*1fr;/,
    );
    expect(styles).toMatch(
      /\.review-visibility-actions\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(styles).toMatch(
      /\.review-card-controls > \.cover-button,[\s\S]*?\.review-card-controls > \.asset-delete-button,[\s\S]*?\.review-card-controls > \.secondary-button\s*\{[\s\S]*?width:\s*100%;/,
    );
  });
});
