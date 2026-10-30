# NetAtlas

面向 Quantumult X、Surge、Loon、Shadowrocket、Egern、Stash、Mihomo 和 sing-box 的原生配置与规则仓库。先选客户端，再取用主配置、具体服务分流或可选功能。

当前规范目录包含 **15 个规则集、5,077 条规则**。主配置将规则内联，可以从本地文件使用；可选脚本直链需要对应文件已经推送到公开提交。八种格式都做结构与语义检查；Mihomo、sing-box 有固定版本原生检查入口，其余六个应用仍需实际导入。执行证据见[验证记录](docs/validation.md)。

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
├── modules/           # 组合功能包或标注用途的配置片段
├── manifest.json      # 文件、来源与验证边界
└── README.md          # 使用方式
~~~

未实现的可选能力不生成占位文件。独立规则例如 clients/surge/rules/openai.list，不增加 ai、media 等公开类别层；category 只用于内部整理，路由默认值与先后顺序由 [routing.json](metadata/routing.json) 单独管理。

主配置不包含私人节点。Proxy 组以 REJECT 为首项，DIRECT 是明确可选项；添加自有节点、将其加入 Proxy 并主动选择后，再核对实际出站。图形应用可能保留旧选择，导入后应检查当前选项。LAN、China 等规则的明确 DIRECT 行为以路由清单为准。

QX 的 modules/geoip.conf 是合并到 [general] 的配置片段，不能作为重写订阅导入。GeoIP、Surge 面板和搜索重定向的路径、路由语义与验证限制见[可选功能说明](docs/features.md)。

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

原创部分采用 [MIT License](LICENSE)。规则数据的来源、固定提交、许可和可移植范围单独登记；不读取或发布用户节点、订阅、令牌及证书。
