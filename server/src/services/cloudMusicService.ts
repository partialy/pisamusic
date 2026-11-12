/**
 * 网盘音乐业务服务层（向后兼容门面）
 * 完整实现已按职责拆分至 src/services/cloudMusic/ 目录：
 * - types.ts: 数据传输对象及入参类型定义
 * - cloudMusicShared.ts: 共享实体转换、存储桶获取与底层资产确认引擎
 * - cloudMusicPublicService.ts: 公开检索、播放链接与歌词/封面重定向
 * - cloudMusicUserService.ts: 用户投稿、提审与历史记录工作流
 * - cloudMusicAdminService.ts: 管理端免下载确认、直接入库、审核决策与清理维护
 */
export * from "./cloudMusic";
