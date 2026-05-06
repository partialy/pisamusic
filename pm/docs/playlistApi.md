KG
共用的搜索接口：
搜索
说明: 调用此接口 , 传入搜索关键词可以搜索该音乐 / mv / 歌单 / 歌词 / 专辑 / 歌手

必选参数：

keywords: 关键词

可选参数：

page : 页数

pagesize : 每页页数, 默认为 30

type: 搜索类型；默认为单曲，special：歌单，lyric：歌词，song：单曲，album：专辑，author：歌手，mv：mv
歌单搜索返回：
{
    "status": 1,
    "error_code": 0,
    "error_msg": "",
    "data": {
        "pagesize": 30,
        "page": 1,
        "from": 0,
        "size": 30,
        "total": 480,
        "correctiontype": 0,
        "correctionforce": 0,
        "correctiontip": "",
        "theme": {
            "valid": false
        },
        "lists": [
            {
                "grade": 0,
                "quality": 0,
                "quality_new": 0,
                "version": 0,
                "high_quality": 1,
                "isugc": 1,
                "ispublish": 1,
                "isvip": 0,
                "isperiodical": 0,
                "nper": 0,
                "iscustom": 0,
                "specialid": 5889449,
                "song_count": 29,
                "specialname": "鲸落万物生 | 用纯音乐治愈美好",
                "contain": "",
                "img": "http://c1.kgimg.com/v2/custom/4475150b26ff632e13d7ccf1567b9ca2.png",
                "intro": "",
                "grade_int": "0",
                "grade_float": "0",
                "publish_time": "2022-08-08 13:05:06",
                "collect_count": "0",
                "suid": "1985035132",
                "nickname": "Yolee",
                "srid": "0",
                "play_count": "14224",
                "total_play_count": "10838673",
                "gid": "collection_3_1985035132_46_0",
                "alg_path": "",
                "tag_str": "",
                "is_mutual": 0,
                "abtags": [],
                "trans_param": {
                    "iden": 0,
                    "special_tag": 0,
                    "trans_flag": 1
                }
            },
        ]
    }
}

WY也是共用cloudsearch搜索接口
搜索
说明 : 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户 , 关键词可以多个 , 以空格隔开 , 如 " 周杰伦 搁浅 "( 不需要登录 ), 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接

必选参数 : keywords : 关键词

可选参数 : limit : 返回数量 , 默认为 30 offset : 偏移数量，用于分页 , 如 : 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0

type: 搜索类型；默认为 1 即单曲 , 取值意义 : 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频, 1018:综合, 2000:声音(搜索声音返回字段格式会不一样)

搜索歌单返回：
{
    "result": {
        "searchQcReminder": null,
        "playlists": [
            {
                "id": 151235962,
                "name": "粤语经典老歌【超级好听】",
                "coverImgUrl": "http://p1.music.126.net/rYl-AMBuVCCtz01YaClAfA==/109951169901537385.jpg",
                "creator": {
                    "nickname": "招财进宝9118",
                    "userId": 90015502,
                    "userType": 4,
                    "avatarUrl": null,
                    "authStatus": 1,
                    "expertTags": null,
                    "experts": null
                },
                "subscribed": false,
                "trackCount": 80,
                "userId": 90015502,
                "playCount": 5678940,
                "bookCount": 26732,
                "specialType": 0,
                "officialTags": null,
                "action": null,
                "actionType": null,
                "recommendText": null,
                "score": null,
                "officialPlaylistTitle": null,
                "playlistType": "UGC",
                "description": "不经意听到很喜欢的粤语歌，却不知道歌名，来这里找找也许会有哦…不定时更新，谢谢你们的收藏",
                "highQuality": false
            },
         ],
        "playlistCount": 292
    },
    "code": 200
}