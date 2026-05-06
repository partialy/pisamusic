（这些接口都要用带cookie的请求方法）
kg
获取用户歌单
说明：登录后调用此接口，可以获取用户的所有创建以及收藏的歌单

可选参数：

page：页数

pagesize : 每页页数, 默认为 30

接口地址： /user/playlist

调用例子： /user/playlist
响应：
{
    "data": {
        "info": [
            {

                "create_user_pic": "http://imge.kugou.com/kugouicon/165/20230320/20230320135622599546.jpg",
                "list_create_userid": 760768723,
                "m_count": 49,
                "create_time": 1454659546,
                "update_time": 1774324600,
                "list_create_gid": "collection_3_760768723_1_0",
                "global_collection_id": "collection_3_760768723_1_0",
                "pic": "http://c1.kgimg.com/stdmusic/{size}/20190305/20190305222811426703.jpg",
                "list_create_username": "忆昔",
                "is_featured": 0,
                "is_custom_pic": 0,
                "listid": 1,
                "name": "默认收藏",
                "count": 49
            },
		],
        "userid": 760768723,
        "album_count": 0,
        "list_count": 27,
        "collect_count": 18
    },
    "status": 1,
    "error_code": 0
}

wy
第一步
获取账号信息
说明 : 登录后调用此接口 ,可获取用户账号信息

接口地址 : /user/account

调用例子 : /user/account
响应：
{
    "code": 200,
    "account": {
        "id": 549090146,
        "userName": "1_********203",
        "type": 1,
        "status": 0,
        "whitelistAuthority": 0,
        "createTime": 1500866824678,
        "tokenVersion": 2,
        "ban": 0,
        "baoyueVersion": -2,
        "donateVersion": 0,
        "vipType": 11,
        "anonimousUser": false,
        "paidFee": true
    },
    "profile": {
        "userId": 549090146,
        "userType": 0,
        "nickname": "i_忆昔",
        "avatarImgId": 109951163991514980,
        "avatarUrl": "https://p2.music.126.net/hbfQzjkNa-IJMrzAxbc5dg==/109951163991514971.jpg",
        "backgroundImgId": 109951164242149420,
        "backgroundUrl": "https://p2.music.126.net/Iv-RnUXTn8C64Drw08jyLQ==/109951164242149418.jpg",
        "signature": "",
        "createTime": 1500866912509,
        "userName": "1_********203",
        "accountType": 1,
        "shortUserName": "********203",
        "birthday": 1411747200000,
        "authority": 0,
        "gender": 1,
        "accountStatus": 0,
        "province": 360000,
        "city": 360800,
        "authStatus": 0,
        "description": null,
        "detailDescription": null,
        "defaultAvatar": false,
        "expertTags": null,
        "experts": null,
        "djStatus": 0,
        "locationStatus": 30,
        "vipType": 110,
        "followed": false,
        "mutual": false,
        "authenticated": false,
        "lastLoginTime": 1774958800814,
        "lastLoginIP": "39.144.78.112",
        "remarkName": null,
        "viptypeVersion": 1751203809756,
        "authenticationTypes": 0,
        "avatarDetail": null,
        "anchor": false
    }
}

第二步
获取用户歌单
说明 : 登录后调用此接口 , 传入用户 id, 可以获取用户歌单

必选参数 : uid : 用户 id，来自上一个接口

可选参数 :

limit : 返回数量 , 默认为 30

offset : 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0

接口地址 : /user/playlist

调用例子 : /user/playlist?uid=32953014
响应：
{
    "more": false,
    "playlist": [
        {
            "creator": {
                "defaultAvatar": false,
                "province": 440000,
                "authStatus": 0,
                "followed": false,
                "avatarUrl": "http://p1.music.126.net/ZN_BmYYBfuXtphZaGRCkbg==/109951169598555174.jpg",
                "accountStatus": 0,
                "gender": 1,
                "city": 440300,
                "birthday": 0,
                "userId": 32953014,
                "userType": 0,
                "nickname": "binaryify",
                "signature": "emmm",
                "description": "",
                "detailDescription": "",
                "avatarImgId": 109951169598555170,
                "backgroundImgId": 109951163792144620,
                "backgroundUrl": "http://p1.music.126.net/WLTBvNL_l9ZKlslFwaCM9Q==/109951163792144631.jpg",
                "authority": 0,
                "mutual": false,
                "expertTags": null,
                "experts": null,
                "djStatus": 10,
                "vipType": 11,
                "remarkName": null,
                "authenticationTypes": 0,
                "avatarDetail": null,
                "avatarImgIdStr": "109951169598555174",
                "anchor": false,
                "backgroundImgIdStr": "109951163792144631",
                "avatarImgId_str": "109951169598555174"
            },
            "trackCount": 1259,
            "updateTime": 1774882216091,
            "commentThreadId": "A_PL_0_24381616",
            "coverImgUrl": "http://p1.music.126.net/bOzv41ZWVGMcIf70kiXieA==/109951172158752658.jpg",
            "createTime": 1407747901072,
            "trackNumberUpdateTime": 1773810951846,
            "playCount": 22527,
            "description": "描述",
            "tags": [
                "欧美"
            ],
            "name": "binaryify喜欢的音乐",
            "id": 24381616,
            "coverImgId_str": "109951172158752658"
        },
    ],
    "code": 200
}