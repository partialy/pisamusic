/** 听歌等级的分钟闭区间规则。 */
export type ListeningLevelRule = {
  /** 从 1 开始连续编号的等级。 */
  level: number;
  /** 区间包含的起始累计听歌分钟。 */
  minMinutes: number;
  /** 区间包含的结束累计听歌分钟；最后一级为 null 表示无上限。 */
  maxMinutes: number | null;
};

/** 后台维护的完整听歌等级配置。 */
export type ListeningLevelConfig = {
  /** 乐观并发控制版本号。 */
  version: number;
  /** 按等级升序排列的连续规则。 */
  rules: ListeningLevelRule[];
  /** 服务端最近更新时间戳（毫秒）。 */
  updatedAt: number;
};
