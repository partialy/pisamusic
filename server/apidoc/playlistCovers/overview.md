# 用户歌单封面资源

三个接口均要求用户 JWT（Authorization Bearer），沿用全局加密通信与 `{code,msg,data}` 响应，身份只取 JWT。资源仅用于 `user_playlist`，不新增同步入口。

## POST /api/playlist-covers/upload-token

请求：

```json
{"playlistId":"本账号歌单itemKey","editGeneration":"edit_42","fileName":"cover.webp","fileSize":12345,"mimeType":"image/webp"}
```

- playlistId 为 1～256 字符；editGeneration 为 1～128 字符的字母数字/下划线/连字符稳定标识，首字符必须是字母数字，由客户端在每次编辑/取消/切换图片时生成新代次。
- JPG/JPEG、PNG、WebP，扩展名与 MIME 必须一致；1B～5MiB。文件名最多255字符。禁止控制字符。
- 返回 `{provider,uploadToken,uploadUrl,key,bucket,domain,cdnDomain,downloadUrl,expiresAt,uploadId,userId,playlistId,editGeneration}`。token约一小时有效，限定服务端生成的唯一对象Key，insertOnly、5MiB内实际声明大小限制和detectMime图片白名单；客户端按 key/token 直传七牛。downloadUrl 此时尚未可引用。
- 返回token前，在用户锁事务中登记 pending file_records 和上传/资源生命周期行。允许先上传再由sync创建尚不存在的歌单；本接口不创建/改写权威歌单，不按客户端playlistId跨账号读取任何数据。

## POST /api/playlist-covers/complete

请求仅包含 `{ "uploadId":"上传会话ID", "editGeneration":"edit_42" }`。不得依赖客户端提供bucket/key/URL/MIME/尺寸；服务端从JWT归属会话与file_records取对象。

服务端重新stat核对真实大小/MIME，访问配置域名的受控key `?imageInfo`，禁止重定向；七牛解码后的实际格式必须与会话MIME一致，宽高均为正整数、单边≤8192、总像素≤3200万。再在用户锁+资源锁事务内复核归属/代次/有效期/状态，将对象与资源原子变为uploaded/ready。并发或重试complete对ready幂等，不复活deleting/deleted资源。

返回：

```json
{"resourceId":"资源UUID","userId":"JWT账号ID","playlistId":"原上传歌单itemKey","uploadId":"上传会话ID","editGeneration":"edit_42","url":"稳定公共URL","width":1024,"height":1024}
```

仅生成可引用资源，**不提前改歌单**。客户端须检查账号、playlistId和编辑代次仍匹配，再将 `{coverResource:{resourceId},cover:原稳定URL,coverPreset:null}` 与歌单/outbox在本地同事务提交。图片可在同账号多个歌单复用；playlistId返回原始上传上下文，不限制同账号后续复用。

## GET /api/playlist-covers/:resourceId

仅账号本人可查询ready/对象uploaded资源，返回与complete一致的DTO；其他账号、pending、删除中、已删和不存在统一400，不泄露资源归属。响应private/no-store；公共图片URL本身是公开图片，不是账号隐私访问接口。

## 同步与失败

`POST /api/sync/changes` 在同一用户事务内对最终LWW胜出项校验资源归属、ready、对象uploaded，并将cover设置为数据库内权威稳定URL。客户端只能传`coverResource:{resourceId}`或null；额外bucket/key字段由既有payload策略400拒绝。coverResource与非null coverPreset互斥，切换必须显式清除旧来源。

缺字段保留；null明确解除；父歌单delete释放引用。多歌单共享资源最后一个引用解除后重新开始七天宽限期；同批操作最终结果、no-op、items/log/ref变更在同一事务，失败全部回滚，不分配半批成功版本。无可引用资源返回400（SyncValidationError），客户端应从原账号本地副本重传；鉴权401，真实存储/服务异常500。不将不可用资源伪装为上传成功。相同no-op仍验证资源，LWW落败项不建立引用。

## 生命周期、后台删除与账号删除

- `playlist_cover_resources` 同时存上传会话（独立uploadId/编辑代次/失效时间）及资源状态，`playlist_cover_refs`保存账号+歌单共享引用；唯一物理对象账本仍为file_records（usageType=playlist-cover）。
- pending从创建计时、ready从完成计时、最后引用解除从解除计时；未引用至少七天且上传凭证已过期才可认领回收。引用时unreferenced_at置null。
- 复用既有syncCleanup每日门禁/维护排空，每轮最多100项；资源锁内复核引用后转deleting，阻止complete/新增引用，七牛物理删除成功后保留资源/文件逻辑删除记录。612视为幂等成功；失败保存last_error和五分钟lease，后续轮次重试；进程退出也可续删。候选按上次认领时间轮转，避免持续失败资源阻塞后续资源。
- Admin文件删除同样经过引用及七天保护，不能强制清空引用提前删共享对象。文件列表可按playlist-cover用途及pending/ uploaded/deleted/all筛选，referencedBy显示当前歌单引用。
- Admin删除用户在用户锁事务中即时删除歌单引用、撤销会话/资源owner_user_id、清除文件owner_user_id与展示引用，然后硬删除用户；JWT/complete/sync立即不可再使用该身份。资源、uploadId、对象Key及file_records账本不受用户FK级联删除，七天后依同一队列回收物理对象，失败继续保账重试。

## Schema / 复制恢复

Schema v5增加上述两表；SQLite真实appDb启动与baseline、runner和MySQL5.7 descriptors均包含。MySQL从已应用v4进入v5逐DDL登记意图、校验已有对象/字段索引默认值/外键，失败保留failed账本并阻断业务，符合本任务账本的中断可续迁。SQLite创建后校验结构再标记v5，未知冲突阻断。全量复制自动按外键顺序包含新表及默认值；历史v1～v4允许缺少封面表，复制为零行，新v5备份缺表禁止恢复。Schema账本不复制，七牛物理对象不随数据库复制。
