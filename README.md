# NetAtlas

面向 Quantumult X、Surge、Loon、Shadowrocket、Egern、Stash、Mihomo 和 sing-box 的原生配置与规则仓库。先选客户端，再取用主配置、具体服务分流或可选功能。

主配置面向客户端直接导入：保留 DNS、节点/订阅入口、中文业务策略、自动选择与六地区测速，独立订阅本客户端的 **114 份规则资源（29,103 条）**。不需要先安装 Node.js。节点与订阅由你自己提供，具体接入字段见各客户端 README。

QX 默认使用 App 内置 proxy，Shadowrocket 使用首页 PROXY；其余客户端在导入后添加原生节点/订阅并选择实际节点。地区组按节点名称筛选，只有存在匹配节点时才选择，不保证空组回退。QX 主配置已接入出口定位；重写、MITM 和证书不自动启用。

规则资源按具体应用或服务平铺；AI、苹果、谷歌、微软、开发、通讯、游戏、媒体及最终兜底可独立选择出口。另有可选 anti-AD **100,682 条**和 global **6,985 条**；合计 **117 套、136,894 条**规范数据。完整内联版本与私有 CLI 保留为高级选项。六 GUI 可选功能现含 47 项快速搜索、59 项网站重定向、独立 BiliIntl 参数资源，以及 BoxJS、ScriptHub、Sub-Store 安装包。QX/Loon 另有外部资源解析器片段；Surge 有原创正文替换工具。入口与实质差异见[逐项覆盖清单](docs/coverage.md)。
## 使用入口

| 客户端 | 主配置 | 目录 |
|---|---|---|
| Quantumult X | [default.conf](clients/quantumultX/profiles/default.conf) | [quantumultX](clients/quantumultX/) |
| Surge | [default.conf](clients/surge/profiles/default.conf) | [surge](clients/surge/) |
| Loon | [default.conf](clients/loon/profiles/default.conf) | [loon](clients/loon/) |
| Shadowrocket | [default.conf](clients/shadowrocket/profiles/default.conf) | [shadowrocket](clients/shadowrocket/) |
| Egern | [default.yaml](clients/egern/profiles/default.yaml) | [egern](clients/egern/) |
| Stash | [default.yaml](clients/stash/profiles/default.yaml) | [stash](clients/stash/) |
| Mihomo | [default.yaml](clients/mihomo/profiles/default.yaml) | [mihomo](clients/mihomo/) |
| sing-box | [default.json](clients/singBox/profiles/default.json) | [singBox](clients/singBox/) |

每个客户端目录按用途排列：

~~~text
clients/<client>/
├── profiles/          # 主配置
├── rules/             # 按具体应用或服务 ID 平铺的分流规则
├── rewrites/          # 纯重写资源
├── scripts/           # 明确适配的 JavaScript
├── modules/           # 原生功能安装包
├── fragments/         # 需要手工合并的配置片段
├── manifest.json      # 文件、来源与验证边界
└── README.md          # 使用方式
~~~

未实现的可选能力不生成占位文件。独立规则例如 clients/surge/rules/openai.list，不增加 ai、media 等公开类别层；category 只用于内部整理，路由默认值与先后顺序由 [routing.json](metadata/routing.json) 单独管理。

## 在客户端接入

1. 从上表选择自己的软件，导入其 `profiles/default.*` 的 Raw 地址。
2. 按客户端 README 添加自己的原生节点或订阅；各软件语法不同，不能通用混用。
3. 选择实际节点，确认业务策略和地区组，再启用这份独立配置。

[逐客户端接入说明](docs/profile-setup.md)列出 QX 资源、Surge policy-path、Loon 远程代理、Shadowrocket 首页订阅、Egern urls、Stash/Mihomo providers 及 sing-box 原生 outbounds 的具体方式。sing-box 核心没有机场订阅 provider，不伪造支持；可以使用支持订阅合并的前端或可选本地工具。

规则刷新由客户端执行；升级主配置与刷新规则分开。首次下载依赖能访问本仓库 Raw 地址。需要不依赖远程规则的版本时，使用同目录的 `profiles/standalone.*`；它内联同一套数据，更新时替换整个文件。高级私有转换说明也在接入文档。

本仓库不读取或修改你现用的 QX、节点、系统代理和证书。Mihomo、sing-box 用固定内核验证真实远程资源、DNS、节点与路由；其他六个客户端只有资料/结构/引用验证，未声称原生 GUI 实测。[验证记录](docs/validation.md)。

重写在各软件的 rewrites/，原生安装包在 modules/，手工合并片段在 fragments/。QX 主配置已有 GeoIP，geoip.conf 片段供其他既有配置接入使用。功能安装、权限和分开许可见[功能说明](docs/features.md)。

## 本地维护

要求 Node.js 24.x。

~~~sh
npm ci
npm test
npm run build
npm run validate
npm run test:native
~~~

~~~sh
npm run build -- --check             # 比较生成结果，不写入
npm run validate -- --client singBox # 筛选一个客户端的校验
npm run sync -- --latest --dry-run   # 检查候选上游，不更新源文件
npm run sync -- --repository anti-ad --latest --dry-run # 只移动指定来源的候选版本，仍验证全目录
npm run test:live                    # 单独联网检查 GeoIP；不打印真实出口 IP
~~~

构建全量生成八种客户端；不提供 --client 构建开关。生成文件由规范源、路由清单和明确的客户端适配器维护，不手工编辑 clients/。CI 执行离线测试、构建一致性、校验和 Linux 原生内核检查；上游更新工作流只由手动触发产生 review artifact，不自动提交或发布。

## 文档

- [能力与验证范围](docs/capabilities.md)
- [架构与目录](docs/architecture.md)
- [客户端格式与官方依据](docs/client-formats.md)
- [可选功能](docs/features.md)
- [来源审计](docs/upstream-audit.md)与[第三方声明](THIRD_PARTY_NOTICES.md)
- 规格：[规则](docs/specs/rules.md)、[配置](docs/specs/profiles.md)、[功能](docs/specs/features.md)、[构建](docs/specs/build.md)

本仓库包含多种许可：原创通用代码采用 [MIT License](LICENSE)；部分规则数据、HTTPS-upgrade 与扩展 Redirect 代码和生成资源采用 [GPL-2.0-only](src/features/https-upgrade/LICENSE)。BoxJS/ScriptHub 包为 GPL-3.0-only，Sub-Store 包为 AGPL-3.0-only；脚本仍从上游固定入口获取，QX 解析器只提供外部安装说明。第三方数据按各条登记保留许可，不能把整个仓库一概视为 MIT。详见[第三方声明](THIRD_PARTY_NOTICES.md)。不读取或发布用户节点、订阅、令牌及证书。
