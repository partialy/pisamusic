export type LibraryIdentity = { userId: string; identityRevision: number };
export type UnassociatedPreview = { confirmationId: string; identityRevision: number; accountName: string; songs: number; favorites: number; playlists: number };
export type LibraryImportResult = { songs: number; favorites: number; playlists: { originalId: string; importedId: string }[] };
