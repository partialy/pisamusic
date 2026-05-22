歌单 ( 网友精选碟 )
说明 : 调用此接口 , 可获取网友精选碟歌单

可选参数 : order: 可选值为 'new' 和 'hot', 分别对应最新和最热 , 默认为 'hot'

cat: tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部",可从歌单分类接口获取(/playlist/catlist)

limit: 取出歌单数量 , 默认为 50

offset: 偏移数量 , 用于分页 , 如 :( 评论页数 -1)*50, 其中 50 为 limit 的值

接口地址 : /top/playlist

调用例子 : /top/playlist?limit=10&order=hot

返回：
{
  "playlists": [
    {
      "name": "春日小清新 | “观我旧往，同我仰春”",
      "id": 17900094873,
      "trackNumberUpdateTime": 1779076846835,
      "status": 0,
      "userId": 312608589,
      "createTime": 1776221589216,
      "updateTime": 1779076846835,
      "subscribedCount": 53,
      "trackCount": 62,
      "cloudTrackCount": 0,
      "coverImgUrl": "http://p2.music.126.net/ADiF5fHIf1cGd4tzESSI3g==/109951173130690662.jpg",
      "iconImgUrl": null,
      "coverImgId": 109951173130690660,
      "description": "风掠过檐角的铃，摇落一冬的尘。\n\n我站在解冻的河岸，看去年的枯草里，拱出星星点点的绿。旧年的遗憾还蜷在心底，像未拆的信，字里行间都是辗转的晨昏。可春风偏是执拗的，拂过发梢时，捎来远山的青，檐下的燕，还有枝头含苞的粉白。\n\n观我旧往，是跌跌撞撞的脚印，是雨打风吹的印痕；同我仰春，是抬眼望见的光，是掌心攥住的温。春事未决又何妨？且把过往埋进春泥，等一朵花开，等一阵风来，等前路漫漫，都漫进春的晕染里。",
      "tags": [
        "轻音乐",
        "感动",
        "思念"
      ],
      "playCount": 9751,
      "trackUpdateTime": 1779076846977,
      "specialType": 0,
      "totalDuration": 0,
      "creator": {
        "defaultAvatar": false,
        "province": 350000,
        "authStatus": 1,
        "followed": false,
        "avatarUrl": "http://p1.music.126.net/MDErMLW4-M7nvCt85xoWCQ==/109951173130943072.jpg",
        "accountStatus": 0,
        "gender": 1,
        "city": 350800,
        "birthday": 1022774400000,
        "userId": 312608589,
        "userType": 4,
        "nickname": "心语馆",
        "signature": "祝我们好在春天",
        "description": "",
        "detailDescription": "",
        "avatarImgId": 109951173130943070,
        "backgroundImgId": 18902803904772116,
        "backgroundUrl": "http://p1.music.126.net/gy1zhVmVr8KRmFYOe_4QQQ==/18902803904772116.jpg",
        "authority": 0,
        "mutual": false,
        "expertTags": null,
        "experts": null,
        "djStatus": 10,
        "vipType": 11,
        "remarkName": null,
        "authenticationTypes": 72,
        "avatarDetail": {
          "userType": 4,
          "identityLevel": 1,
          "identityIconUrl": "https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4874132307/4499/f228/d867/da64b9725e125943ad4e14e4c72d0884.png"
        },
        "avatarImgIdStr": "109951173130943072",
        "backgroundImgIdStr": "18902803904772116",
        "anchor": false
      },
      "tracks": null,
      "subscribers": [
        {
          "defaultAvatar": false,
          "province": 1000000,
          "authStatus": 0,
          "followed": false,
          "avatarUrl": "http://p1.music.126.net/DAq8a-ezGTpOA_LJcx9pCA==/109951163392854146.jpg",
          "accountStatus": 0,
          "gender": 2,
          "city": 1002900,
          "birthday": 821286000000,
          "userId": 263425948,
          "userType": 0,
          "nickname": "Sschmyo",
          "signature": "",
          "description": "",
          "detailDescription": "",
          "avatarImgId": 109951163392854140,
          "backgroundImgId": 109951163392850320,
          "backgroundUrl": "http://p1.music.126.net/hzpmY9tzZZIAx9i40_s-Hg==/109951163392850321.jpg",
          "authority": 0,
          "mutual": false,
          "expertTags": null,
          "experts": null,
          "djStatus": 0,
          "vipType": 0,
          "remarkName": null,
          "authenticationTypes": 0,
          "avatarDetail": null,
          "avatarImgIdStr": "109951163392854146",
          "backgroundImgIdStr": "109951163392850321",
          "anchor": false
        }
      ],
      "subscribed": false,
      "commentThreadId": "A_PL_0_17900094873",
      "newImported": false,
      "adType": 0,
      "highQuality": false,
      "privacy": 0,
      "ordered": false,
      "anonimous": false,
      "coverStatus": 3,
      "recommendInfo": null,
      "socialPlaylistCover": null,
      "recommendText": null,
      "coverText": null,
      "relateResType": null,
      "relateResId": null,
      "tsSongCount": 0,
      "algType": null,
      "playlistType": "UGC",
      "uiPlaylistType": "UGC",
      "originalCoverId": 0,
      "backgroundImageId": 0,
      "backgroundImageUrl": null,
      "topTrackIds": null,
      "promptedMgcInfo": null,
      "title": null,
      "subTitle": null,
      "backgroundText": null,
      "shareCount": 0,
      "coverImgId_str": "109951173130690662",
      "alg": "alg_sq_offline",
      "commentCount": 0
    },
      ],
  "total": 498,
  "code": 200,
  "more": true,
  "cat": "全部"
}