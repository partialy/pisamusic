const listeners = new Set<() => void>();
let revision = -1;
window.electronAPI.onAccountIdentityChanged(next => {
  if (next <= revision) return;
  revision = next;
  listeners.forEach(listener => listener());
});
const ready = window.electronAPI.getLibraryIdentity().then(identity => {
  if (identity.identityRevision > revision) revision = identity.identityRevision;
});
export async function captureLibraryRevision() { await ready; return revision; }
export function isCurrentLibraryRevision(value: number) { return revision === value; }
export function onLibraryIdentityChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
