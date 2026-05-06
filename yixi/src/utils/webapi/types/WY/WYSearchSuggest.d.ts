export interface WYSearchSuggestResponse {
    result: WYSearchSuggestResult;
    code: number;
}
export interface WYSearchSuggestResult {
    albums: WYSearchSuggestAlbum[];
    artists: WYSearchSuggestArtist[];
    songs: WYSearchSuggestSong[];
    playlists: WYSearchSuggestPlaylist[];
    order: string[];
}
export interface WYSearchSuggestAlbum {
    id: number;
    name: string;
    artist: WYSearchSuggestArtist;
    publishTime: number;
    size: number;
    copyrightId: number;
    status: number;
    picId: number;
    mark: number;
}
export interface WYSearchSuggestArtist {
    id: number;
    name: string;
    picUrl: null | string;
    alias: string[];
    albumSize: number;
    picId: number;
    fansGroup: null;
    img1v1Url: string;
    img1v1: number;
    trans: null;
    alia?: string[];
    accountId?: number;
}
export interface WYSearchSuggestPlaylist {
    id: number;
    name: string;
    coverImgUrl: string;
    creator: null;
    subscribed: boolean;
    trackCount: number;
    userId: number;
    playCount: number;
    bookCount: number;
    specialType: number;
    officialTags: null;
    action: null;
    actionType: null;
    recommendText: null;
    score: null;
    officialPlaylistTitle: null;
    playlistType: string;
    description: string;
    highQuality: boolean;
}
export interface WYSearchSuggestSong {
    id: number;
    name: string;
    artists: WYSearchSuggestArtist[];
    album: WYSearchSuggestAlbum;
    duration: number;
    copyrightId: number;
    status: number;
    alias: any[];
    rtype: number;
    ftype: number;
    mvid: number;
    fee: number;
    rUrl: null;
    mark: number;
    transNames?: string[];
}
