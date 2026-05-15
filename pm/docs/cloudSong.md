WY
云盘
说明 : 登录后调用此接口 , 可获取云盘数据 , 获取的数据没有对应 url, 需要再调用一 次 /song/url 获取 url

可选参数 :

limit : 返回数量 , 默认为 30

offset : 偏移数量，用于分页 , 如 :( 页数 -1)*200, 其中 200 为 limit 的值 , 默认为 0

接口地址 : /user/cloud

调用例子 : /user/cloud

{
  "data": [
    {
      "privateCloud": {
        "id": 525520899575,
        "userId": 549090146,
        "songId": 2659288520,
        "md5": "4ffe7e4dc632e00cb97cb3a70706ffdd",
        "song": "白水寒-天真的橡皮",
        "artist": "DJ方杰",
        "album": "Download",
        "bitrate": 128,
        "fileName": "白水寒 - 天真的橡皮.mp3",
        "songDfsId": 0,
        "cover": 0,
        "lyric": 0,
        "cue": 0,
        "convertLyric": 0,
        "version": 61,
        "addTime": 1755439793612,
        "fileSize": 5149864,
        "status": 0,
        "originalAudioSongId": 2638578916,
        "lrcType": ""
      },
      "simpleSong": {
        "name": "倦",
        "mainTitle": null,
        "additionalTitle": null,
        "id": 2659288520,
        "pst": 0,
        "t": 0,
        "ar": [
          {
            "id": 95813335,
            "name": "安苒",
            "tns": [],
            "alias": []
          }
        ],
        "alia": [
          "DJ版"
        ],
        "pop": 95,
        "st": 0,
        "rt": "",
        "fee": 0,
        "v": 60,
        "crbt": null,
        "cf": "",
        "al": {
          "id": 257679389,
          "name": "抖音很火的（人生呐能不能放过我这一次）DJ版混音融合+一马当先",
          "picUrl": "http://p1.music.126.net/YU5qGpvJezACwCC98UuN9g==/109951170311140259.jpg",
          "tns": [],
          "pic_str": "109951170311140259",
          "pic": 109951170311140260
        },
        "dt": 321805,
        "h": {
          "br": 320000,
          "fid": 0,
          "size": 12874605,
          "vd": -98714,
          "sr": 48000
        },
        "m": {
          "br": 192000,
          "fid": 0,
          "size": 7724781,
          "vd": -96165,
          "sr": 48000
        },
        "l": {
          "br": 128000,
          "fid": 0,
          "size": 5149869,
          "vd": -94608,
          "sr": 48000
        },
        "sq": {
          "br": 1150849,
          "fid": 0,
          "size": 46299570,
          "vd": -98774,
          "sr": 48000
        },
        "hr": null,
        "a": null,
        "cd": "01",
        "no": 1,
        "rtUrl": null,
        "ftype": 0,
        "rtUrls": [],
        "djId": 0,
        "copyright": 0,
        "s_id": 2638578916,
        "mark": 128,
        "originCoverType": 2,
        "originSongSimpleData": {
          "songId": 2646283290,
          "name": "手植玫瑰",
          "artists": [
            {
              "id": 95813335,
              "name": "安苒"
            }
          ],
          "albumMeta": {
            "id": 253691477,
            "name": "手植玫瑰"
          }
        },
        "tagPicList": null,
        "resourceState": true,
        "version": 25,
        "songJumpInfo": null,
        "entertainmentTags": null,
        "awardTags": null,
        "displayTags": null,
        "markTags": [],
        "single": 0,
        "noCopyrightRcmd": null,
        "rtype": 0,
        "rurl": null,
        "mst": 9,
        "cp": 0,
        "mv": 0,
        "publishTime": 0,
        "videoInfo": {
          "moreThanOne": false,
          "video": null
        },
        "privilege": {
          "id": 2659288520,
          "fee": 0,
          "payed": 0,
          "realPayed": 0,
          "st": 0,
          "pl": 128000,
          "dl": 128000,
          "sp": 7,
          "cp": 1,
          "subp": 1,
          "cs": true,
          "maxbr": 999000,
          "fl": 999000,
          "pc": {
            "id": 525520899575,
            "userId": 549090146,
            "songId": 2659288520,
            "md5": "4ffe7e4dc632e00cb97cb3a70706ffdd",
            "song": "白水寒-天真的橡皮",
            "artist": "DJ方杰",
            "album": "Download",
            "bitrate": 128,
            "fileName": "白水寒 - 天真的橡皮.mp3",
            "songDfsId": 0,
            "cover": 0,
            "lyric": 0,
            "cue": 0,
            "convertLyric": 0,
            "version": 1,
            "addTime": 1755439793612,
            "fileSize": 5149864,
            "status": 0,
            "originalAudioSongId": 2638578916,
            "lrcType": ""
          },
          "toast": false,
          "flag": 2064521,
          "paidBigBang": false,
          "preSell": false,
          "playMaxbr": 999000,
          "downloadMaxbr": 999000,
          "maxBrLevel": "lossless",
          "playMaxBrLevel": "lossless",
          "downloadMaxBrLevel": "lossless",
          "plLevel": "standard",
          "dlLevel": "standard",
          "flLevel": "lossless",
          "rscl": null,
          "freeTrialPrivilege": {
            "resConsumable": false,
            "userConsumable": false,
            "listenType": null,
            "cannotListenReason": null,
            "playReason": null,
            "freeLimitTagType": null
          },
          "rightSource": 0,
          "chargeInfoList": [
            {
              "rate": 128000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 192000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 320000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 999000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 1
            }
          ],
          "code": 0,
          "message": null,
          "plLevels": null,
          "dlLevels": null,
          "ignoreCache": null
        }
      },
      "songName": "白水寒-天真的橡皮",
      "addTime": 1755439793612,
      "pcId": 525520899575,
      "album": "Download",
      "artist": "DJ方杰",
      "bitrate": 128,
      "songId": 2659288520,
      "cover": 0,
      "coverId": "0",
      "lyricId": "0",
      "matchType": "matched",
      "version": 61,
      "fileSize": 5149864,
      "fileName": "白水寒 - 天真的橡皮.mp3"
    },
    {
      "privateCloud": {
        "id": 524367212500,
        "userId": 549090146,
        "songId": 36308916,
        "md5": "f5029c865d8d5d4db605c9c5f681510e",
        "song": "Monody",
        "artist": "TheFatRat、Laura Brehm",
        "album": "Monody ",
        "bitrate": 130,
        "fileName": "TheFatRat、Laura Brehm - Monody.mp3",
        "songDfsId": 0,
        "cover": 109951169788108850,
        "lyric": 0,
        "cue": 0,
        "convertLyric": 0,
        "version": 411,
        "addTime": 1721141189056,
        "fileSize": 4712818,
        "status": 0,
        "originalAudioSongId": 1920100208,
        "lrcType": ""
      },
      "simpleSong": {
        "name": "Monody",
        "mainTitle": null,
        "additionalTitle": null,
        "id": 36308916,
        "pst": 0,
        "t": 0,
        "ar": [
          {
            "id": 1019952,
            "name": "TheFatRat",
            "tns": [],
            "alias": []
          },
          {
            "id": 207693,
            "name": "Laura Brehm",
            "tns": [],
            "alias": []
          }
        ],
        "alia": [],
        "pop": 100,
        "st": 0,
        "rt": null,
        "fee": 8,
        "v": 410,
        "crbt": null,
        "cf": "",
        "al": {
          "id": 3395235,
          "name": "Monody",
          "picUrl": "http://p1.music.126.net/NUW7whxYUJs_R1AoByKFiA==/109951169136754352.jpg",
          "tns": [],
          "pic_str": "109951169136754352",
          "pic": 109951169136754350
        },
        "dt": 290467,
        "h": {
          "br": 320000,
          "fid": 0,
          "size": 11621399,
          "vd": -76475,
          "sr": 44100
        },
        "m": {
          "br": 192000,
          "fid": 0,
          "size": 6972857,
          "vd": -73928,
          "sr": 44100
        },
        "l": {
          "br": 128000,
          "fid": 0,
          "size": 4648586,
          "vd": -72333,
          "sr": 44100
        },
        "sq": {
          "br": 1017633,
          "fid": 0,
          "size": 36948646,
          "vd": -76453,
          "sr": 44100
        },
        "hr": null,
        "a": null,
        "cd": "1",
        "no": 1,
        "rtUrl": null,
        "ftype": 0,
        "rtUrls": [],
        "djId": 0,
        "copyright": 1,
        "s_id": 1920100208,
        "mark": 17180139648,
        "originCoverType": 1,
        "originSongSimpleData": null,
        "tagPicList": null,
        "resourceState": true,
        "version": 375,
        "songJumpInfo": null,
        "entertainmentTags": null,
        "awardTags": null,
        "displayTags": null,
        "markTags": [],
        "single": 0,
        "noCopyrightRcmd": null,
        "rtype": 0,
        "rurl": null,
        "mst": 9,
        "cp": 743010,
        "mv": 0,
        "publishTime": 1449763200000,
        "videoInfo": {
          "moreThanOne": false,
          "video": null
        },
        "privilege": {
          "id": 36308916,
          "fee": 8,
          "payed": 1,
          "realPayed": 0,
          "st": 0,
          "pl": 130000,
          "dl": 130000,
          "sp": 7,
          "cp": 1,
          "subp": 1,
          "cs": true,
          "maxbr": 999000,
          "fl": 320000,
          "pc": {
            "id": 524367212500,
            "userId": 549090146,
            "songId": 36308916,
            "md5": "f5029c865d8d5d4db605c9c5f681510e",
            "song": "Monody",
            "artist": "TheFatRat、Laura Brehm",
            "album": "Monody ",
            "bitrate": 130,
            "fileName": "TheFatRat、Laura Brehm - Monody.mp3",
            "songDfsId": 0,
            "cover": 109951169788108850,
            "lyric": 0,
            "cue": 0,
            "convertLyric": 0,
            "version": 1,
            "addTime": 1721141189056,
            "fileSize": 4712818,
            "status": 0,
            "originalAudioSongId": 1920100208,
            "lrcType": ""
          },
          "toast": false,
          "flag": 2064397,
          "paidBigBang": false,
          "preSell": false,
          "playMaxbr": 999000,
          "downloadMaxbr": 999000,
          "maxBrLevel": "lossless",
          "playMaxBrLevel": "lossless",
          "downloadMaxBrLevel": "lossless",
          "plLevel": "standard",
          "dlLevel": "standard",
          "flLevel": "exhigh",
          "rscl": null,
          "freeTrialPrivilege": {
            "resConsumable": false,
            "userConsumable": false,
            "listenType": null,
            "cannotListenReason": null,
            "playReason": null,
            "freeLimitTagType": null
          },
          "rightSource": 0,
          "chargeInfoList": [
            {
              "rate": 128000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 192000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 320000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 0
            },
            {
              "rate": 999000,
              "chargeUrl": null,
              "chargeMessage": null,
              "chargeType": 1
            }
          ],
          "code": 0,
          "message": null,
          "plLevels": null,
          "dlLevels": null,
          "ignoreCache": null
        }
      },
      "songName": "Monody",
      "addTime": 1721141189056,
      "pcId": 524367212500,
      "album": "Monody ",
      "artist": "TheFatRat、Laura Brehm",
      "bitrate": 130,
      "songId": 36308916,
      "cover": 109951169788108850,
      "coverId": "109951169788108849",
      "lyricId": "0",
      "matchType": "matched",
      "version": 411,
      "fileSize": 4712818,
      "fileName": "TheFatRat、Laura Brehm - Monody.mp3"
    }
  ],
  "count": 297,
  "size": 1336834870,
  "cursor": null,
  "maxSize": 64424509440,
  "upgradeSign": 0,
  "hasMore": true,
  "code": 200,
  "message": null,
  "idVersions": null,
  "updateTime": 0
}