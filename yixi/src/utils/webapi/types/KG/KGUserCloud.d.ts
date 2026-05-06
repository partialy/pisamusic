export interface KGUserCloudResponse {
    data: KGUserCloudData;
    status: number;
    error_code: number;
}
export interface KGUserCloudData {
    type_size: TypeSize;
    list: KGUserCloudItem[];
    used_size: number;
    availble_size: number;
    user_type: number;
    list_ver: number;
    list_count: number;
    max_size: number;
}
export interface KGUserCloudItem {
    size: number;
    hash: string;
    author_name: string;
    name: string;
    audio_id: number;
    bitrate: number;
    hash_std: string;
    kmr_album_audio_id: number;
    ext: EXT;
    kv_id: number;
    album_audio_id: number;
    add_time: number;
    timelen: number;
    authors?: Author[];
    mvtype?: number;
    mvtrack?: string;
    mvid?: string;
    album_info?: AlbumInfo;
    mvhash?: string;
}
interface AlbumInfo {
    album_name: string;
    publish_date: Date;
    album_id: number;
    sizable_cover: string;
    category: number;
    is_publish: number;
}
interface Author {
    sizable_avatar: string;
    is_publish: number;
    author_name: string;
    author_id: number;
}
declare enum EXT {
    FLAC = "flac",
    Mp3 = "mp3"
}
interface TypeSize {
    type_2: number;
    type_4: number;
    type_1: number;
    type_3: number;
    type_0: number;
}
export interface KGUserCloudUrlResponse {
    status: number;
    error_code: number;
    data: UrlData;
}
interface UrlData {
    fileSize: string;
    url: string;
    extName: string;
    backup_url: string;
    hash: string;
}
export {};
