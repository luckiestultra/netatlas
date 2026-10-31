# Sub-Store 修改及来源声明

版权和作者：Peng-YM and Sub-Store contributors；NetAtlas 配置修改 © 2026 NetAtlas contributors。

本适配安装包按 AGPL-3.0-only 发布，完整条款见 LICENSE；无任何担保。通用渲染器 tools/lib/integrations.mjs 使用 MIT，不能据此把安装包或远程脚本视作 MIT。

固定上游源：https://github.com/sub-store-org/Sub-Store/tree/352f01b7091c99f4e219c44e4ec96f3288059843

修改日期：2026-10-31。

- Pin every configured JavaScript entry point to the registered immutable upstream/release commit.
- Remove cosmetic icons and unrelated fixed-PROXY routing rules.
- Remove all cron/schedule hooks and their unused arguments/providers; keep manual sync APIs.
- Use the official no-ability package for Surge and Shadowrocket; no automatic policy-test ability is added.
- Keep the official Egern request handlers and CORS argument; remove schedule parameters; set timeout to the documented 600-second maximum.
- Require a hostname boundary on the catch-all sub.store request handler.

保留原始作者和官方接口顺序。原始安装包在 upstream/，改版在 installers/。Shadowrocket 的 BoxJS 使用官方文档明确指定的 Surge 模块；Sub-Store 使用官方文档指定的 Surge-Noability 模块。无 CA、无自动同步、无远程脚本 bundle 再分发。

每个输出包均附本目录、完整许可和完整上游源码链接。NetAtlas 的 metadata/integrations.json 记录配置与远程依赖完整性；实际宿主导入仍待用户应用内验证。

