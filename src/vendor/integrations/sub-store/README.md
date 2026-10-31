# Sub-Store 可选集成

这是官方小型安装包的适配版本，远程 JavaScript 未复制进 NetAtlas。安装包使用 AGPL-3.0-only，远程脚本保留上游 AGPL-3.0-only 及其组成部分的许可；本目录不使用仓库根 MIT 许可。完整许可见 [LICENSE](LICENSE)。

默认主配置不加载它。用户导入并启用对应 modules/ 资源后，请求脚本才会工作。HTTPS 访问需要用户已有且信任的 CA；本目录不附带证书，不修改 TLS 校验设置。原生应用导入和运行尚未测试。

安装入口：QX 的 .snippet 作为重写资源导入；Surge 的 .sgmodule、Shadowrocket 的 .module、Egern 的 .yaml、Loon 的 .plugin、Stash 的 .stoverride 按各应用的模块/插件/覆写入口安装。它们不是完整主配置。Loon ScriptHub 使用官方新脚本 DSL，要求 3.5.1(983)+。

官方说明：https://github.com/sub-store-org/Sub-Store/blob/352f01b7091c99f4e219c44e4ec96f3288059843/config/README.md

固定官方源码：https://github.com/sub-store-org/Sub-Store/tree/352f01b7091c99f4e219c44e4ec96f3288059843

## 权限与行为

- 存储：Reads and writes subscriptions, files, settings, caches and user-configured service credentials.
- 用户来源：Fetches, combines, stores, transforms and serves user-configured proxy subscription URLs.
- 网络：Fetches subscription sources and user-selected script/resources; manual sync can upload configured artifacts to a private Gist.
- 用户脚本/eval：上游支持用户选择或提供的脚本。需按其实际权限评估。
- 上传：Manual sync/API only after user configuration; all upstream cron/schedule hooks are removed.
- MITM 仅覆盖：sub.store。

没有 cron/schedule 触发器。手动同步 API 仍可在用户配置后上传订阅/文件；不应将“无定时任务”理解为禁止手动上传。官方声明 sub.store 并非其持有域名，若重写没有生效可能将请求发送到公网；参照官方 README 配置本地域名映射并检查 CORS。此包装不改现有 DNS。

## 固定版本与验证范围

metadata/integrations.json 登记了每个改版安装包、原始安装包、完整许可的 SHA-256，以及直接执行脚本的 URL、GET 200、字节数、SHA-256、静态入口标记和 node --check 结果。没有执行外部脚本，也没有用用户订阅或真实应用存储测试。

固定范围只包括安装包直接配置的 JavaScript。源码 tag 2.44.2 为 c1018115a7eee4cdcb9042cce5e94afda41e48ba；发布分支快照 d26e713e38901e02565a6505c1ae5cb8bb8a1a22 含 2.44.2 两个请求 bundle。登记版本对应关系，不宣称未冻结依赖的上游构建可复现。用户输入的远程 URL、脚本以及 Vercel 前端不属于封闭依赖锁定。

## 修改

见 [NOTICE.md](NOTICE.md)。upstream/ 保存官方安装包文本快照；installers/ 是已修改并经哈希登记的包。文本归档追加了一个换行，登记哈希覆盖实际保存的字节。完整改版源码还包括 ../../../../tools/lib/integrations.mjs。

不支持在 Mihomo/sing-box 内运行这些 HTTP 请求脚本。可按 Sub-Store 官方服务器方案独立部署并向其导出相应格式；这不构成内核内置 JavaScript 支持。

