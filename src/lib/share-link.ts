export interface ShareLinkInput {
  title: string;
  url: string;
}

export type ShareLinkResult = 'shared' | 'copied' | 'manual';

export async function shareLink(input: ShareLinkInput): Promise<ShareLinkResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: input.title,
        text: input.title,
        url: input.url,
      });
      return 'shared';
    } catch {
      return 'manual';
    }
  }

  if (typeof navigator.clipboard?.writeText !== 'function') return 'manual';

  try {
    await navigator.clipboard.writeText(input.url);
    return 'copied';
  } catch {
    return 'manual';
  }
}
