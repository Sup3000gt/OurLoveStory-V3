export function formatMemoryDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`));
}

export function canViewMemory(visibility: 'public' | 'private', isSignedIn: boolean): boolean {
  return visibility === 'public' || isSignedIn;
}
