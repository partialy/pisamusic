###kg接口文档
======获取歌单详情========
说明: 调用此接口 , 可获取歌单详细信息

必选参数：

ids: 歌单中的 global_collection_id，可以传多个，用逗号分隔

接口地址： /playlist/detail

调用例子： /playlist/detail?ids=collection_3_1863870844_4_0 /playlist/detail?ids=collection_3_1863870844_4_0,collection_3_2093906551_8_0
响应：
{
    "data": [
        {
            "tags": "校园,运动,宅家",
            "status": 1,
            "create_user_pic": "http://imge.kugou.com/kugouicon/165/20250528/20250528135601127035.jpg",
            "is_pri": 0,
            "pub_new": 1,
            "is_drop": 0,
            "list_create_userid": 1863870844,
            "is_publish": 1,
            "musiclib_tags": [
                {
                    "tag_id": 67,
                    "parent_id": 5,
                    "tag_name": "校园"
                },
                {
                    "tag_id": 69,
                    "parent_id": 5,
                    "tag_name": "运动"
                },
                {
                    "tag_id": 1106,
                    "parent_id": 5,
                    "tag_name": "宅家"
                }
            ],
            "pub_type": 2,
            "is_featured": 0,
            "publish_date": "2022-12-23",
            "collect_total": 0,
            "list_ver": 217,
            "intro": "我的歌曲集就都是0.8x慢速歌曲",
            "type": 0,
            "list_create_listid": 4,
            "specialid": 6353754,
            "radio_id": 0,
            "source": 1,
            "trans_param": {
                "iden": 0
            },
            "sound": {
                "id": "A12",
                "type": 1,
                "args": ""
            },
            "listid": 4,
            "is_def": 0,
            "parent_global_collection_id": "collection_3_1863870844_4_0",
            "sound_quality": "",
            "per_count": 0,
            "plist": [],
            "kq_talent": 0,
            "create_time": 1670578702,
            "is_per": 0,
            "is_edit": 1,
            "update_time": 1762317785,
            "code": 1,
            "count": 47,
            "sort": 2,
            "is_mine": 0,
            "musiclib_id": 0,
            "per_num": 0,
            "create_user_gender": 1,
            "number": 0,
            "pic": "http://c1.kgimg.com/custom/{size}/20221223/20221223101844795550.jpg",
            "list_create_username": "ntan",
            "name": "「0.8x」慢速歌曲",
            "is_custom_pic": 1,
            "global_collection_id": "collection_3_1863870844_4_0",
            "heat": 0,
            "list_create_gid": "collection_3_1863870844_4_0"
        }
    ],
    "status": 1,
    "error_code": 0
}


======获取歌单所有歌曲=====
说明 : 调用此接口，传入对应的歌单 global_collection_id，即可获得对应的所有歌曲

必选参数：

id: 歌单中的 global_collection_id

可选参数：

page : 页数

pagesize : 每页页数, 默认为 30

接口地址： /playlist/track/all

调用例子： /playlist/track/all?id=collection_3_1863870844_4_0
响应：
{
    "data": {
        "pagesize": 30,
        "count": 41,
        "info": [
            {
                "hash": "6B5DCE5832B0CC91F3CB90FECF2B5B02",
                "size": 2949933,
                "name": "涵の心事. - 先说谎的人 (0.8X)",
                "album_id": "58271602",
                "mvhash": "",
                "extname": "mp3",
                "remark": "涵の心事.",
                "relate_goods": [
                    {
                        "size": 2949933,
                        "hash": "6B5DCE5832B0CC91F3CB90FECF2B5B02",
                        "level": 2,
                        "privilege": 0,
                        "bitrate": 128
                    },
                    {
                        "size": 7375109,
                        "hash": "D9FC694DC63DAFE1746FFC1D2814A23A",
                        "level": 4,
                        "privilege": 0,
                        "bitrate": 320
                    },
                    {
                        "size": 18783924,
                        "hash": "1192580407AB7BEF03A5AC6C3436D814",
                        "level": 5,
                        "privilege": 0,
                        "bitrate": 815
                    }
                ],
                "download": [
                    {
                        "status": 0,
                        "hash": "6B5DCE5832B0CC91F3CB90FECF2B5B02",
                        "fail_process": 0,
                        "pay_type": 0
                    }
                ],
                "timelen": 184344,
                "medistype": "audio",
                "albuminfo": {
                    "name": "涵の心事.",
                    "id": 58271602,
                    "publish": 1
                },
                "bitrate": 128,
                "cover": "http://imge.kugou.com/stdmusic/{size}/20220606/20220606174747878564.jpg",
                "mixsongid": 417327542,
                "singerinfo": [
                    {
                        "id": 8893172,
                        "publish": 1,
                        "name": "涵の心事.",
                        "avatar": "http://singerimg.kugou.com/uploadpic/softhead/{size}/20240527/20240527085334860155.jpg",
                        "type": 1
                    }
                ]
            },
        ],
        "userid": 1863870844,
        "page": 1,
    },
    "status": 1,
    "error_code": 0
}