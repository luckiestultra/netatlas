# ScriptHub 修改及来源声明

版权和作者：小白脸, xream, keywos, ckyb；NetAtlas 配置修改 © 2026 NetAtlas contributors。

本适配安装包按 GPL-3.0-only 发布，完整条款见 LICENSE；无任何担保。通用渲染器 tools/lib/integrations.mjs 使用 MIT，不能据此把安装包或远程脚本视作 MIT。

固定上游源：https://github.com/Script-Hub-Org/Script-Hub/tree/502cf03f7db2e077d96c07c2cb151a8f0b152a80

修改日期：2026-10-31。

- Pin every configured JavaScript entry point to the registered immutable upstream/release commit.
- Remove cosmetic icons, unrelated fixed-PROXY routing rules and Loon cartoon-icon selection UI; retain notification, body-limit and HTTP-timeout settings.
- Narrow MITM/force-engine hostnames to script.hub; repair the QX root hostname dot escape.
- Declare Loon 3.5.1(983)+ for the retained official Script v2 syntax, following the current vendor manual.
- Replace broad type-substring selectors in all six installers with exact outer-query selectors after one literal /_end_/ boundary. Preserve arbitrary ordering of ordinary ASCII query keys; reject duplicate type keys, encoded selector aliases, value suffixes and nested route delimiters.
- Remove the case-insensitive flag from the Loon file-conversion selectors so the wrapper matches the upstream parser's lowercase type values; other official request routes retain their existing behavior.

The pinned Rewrite-Parser.js and rule-parser.js both split the request at the first literal /_end_/ and parse the first subsequent query string. Source URLs may contain ordinary ?type= values without selecting the wrong handler. Multiple literal /_end_/ boundaries or a nested file/_start_/ substring are unsupported and rejected rather than routed using a different delimiter than the executed parser. Parameter names must be unencoded ASCII; parameter values may contain percent-encoded separators. This is serialized-resource regex verification, not native-device execution.

保留原始作者和官方接口顺序。原始安装包在 upstream/，改版在 installers/。Shadowrocket 的 BoxJS 使用官方文档明确指定的 Surge 模块；Sub-Store 使用官方文档指定的 Surge-Noability 模块。无 CA、无自动同步、无远程脚本 bundle 再分发。

每个输出包均附本目录、完整许可和完整上游源码链接。NetAtlas 的 metadata/integrations.json 记录配置与远程依赖完整性；实际宿主导入仍待用户应用内验证。

