# ScriptHub 可选集成

这是官方小型安装包的适配版本，远程 JavaScript 未复制进 NetAtlas。安装包使用 GPL-3.0-only，远程脚本保留上游 GPL-3.0-only 及其组成部分的许可；本目录不使用仓库根 MIT 许可。完整许可见 [LICENSE](LICENSE)。

默认主配置不加载它。用户导入并启用对应 modules/ 资源后，请求脚本才会工作。HTTPS 访问需要用户已有且信任的 CA；本目录不附带证书，不修改 TLS 校验设置。原生应用导入和运行尚未测试。

安装入口：QX 的 .snippet 作为重写资源导入；Surge 的 .sgmodule、Shadowrocket 的 .module、Egern 的 .yaml、Loon 的 .plugin、Stash 的 .stoverride 按各应用的模块/插件/覆写入口安装。它们不是完整主配置。Loon ScriptHub 使用官方新脚本 DSL，要求 3.5.1(983)+。

官方说明：https://github.com/Script-Hub-Org/Script-Hub/wiki

固定官方源码：https://github.com/Script-Hub-Org/Script-Hub/tree/502cf03f7db2e077d96c07c2cb151a8f0b152a80

## 权限与行为

- 存储：Reads and writes converter preferences and user-supplied local text.
- 用户来源：Fetches user-supplied rule/module/script URLs for conversion; not a proxy subscription manager.
- 网络：Fetches source URLs and optional icon/auxiliary resources; the QX root route opens the upstream Vercel frontend.
- 用户脚本/eval：上游支持用户选择或提供的脚本。需按其实际权限评估。
- 上传：No upload or scheduled task is configured by this installer.
- MITM 仅覆盖：script.hub。

不会安装定时任务。

## 固定版本与验证范围

metadata/integrations.json 登记了每个改版安装包、原始安装包、完整许可的 SHA-256，以及直接执行脚本的 URL、GET 200、字节数、SHA-256、静态入口标记和 node --check 结果。没有执行外部脚本，也没有用用户订阅或真实应用存储测试。

固定范围只包括安装包直接配置的 JavaScript。QX 仅安装两个解析器和官方 Vercel 前端跳转，不具有其他客户端的 /convert、/edit、/reload 请求脚本入口。解析器产生的资源可能继续引用上游 main 辅助脚本；这些资源由用户另行选择安装，未被这份入口固定声明覆盖。用户输入的远程 URL、脚本以及 Vercel 前端不属于封闭依赖锁定。

## 修改

转换选择条件只读取唯一字面 /_end_/ 后的外层查询。恰好一个小写 type 参数必须有完整的受支持值；其他未编码 ASCII 参数可任意排序，值中的 %26/%3D 仍属于值。内嵌来源 URL 的普通 ?type= 不参与选择。重复 type、编码参数名/选择值、值后缀、额外裸问号，以及重复 /_end_/ 或嵌套 file/_start_/ 路径会被拒绝。固定上游脚本读取第一个分隔符，因此不会以“最后一个分隔符”猜测嵌套路由。实际设备正则运行仍未测试。

见 [NOTICE.md](NOTICE.md)。upstream/ 保存官方安装包文本快照；installers/ 是已修改并经哈希登记的包。文本归档追加了一个换行，登记哈希覆盖实际保存的字节。完整改版源码还包括 ../../../../tools/lib/integrations.mjs。

不支持在 Mihomo/sing-box 内运行这些 HTTP 请求脚本。可按 Sub-Store 官方服务器方案独立部署并向其导出相应格式；这不构成内核内置 JavaScript 支持。

