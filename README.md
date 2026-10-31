# NetAtlas

面向 Quantumult X、Surge、Loon、Shadowrocket、Egern、Stash、Mihomo 和 sing-box 的原生配置与规则仓库。先选客户端，再取用主配置、具体服务分流或可选功能。

八客户端完整配置已接入原生节点、订阅、DNS 与服务/国内分流。默认内联 **40 组、23,476 条规则**；另有可选 anti-AD **100,682 条**，合计 **41 组、124,158 条**。私有输入中的节点与来源会自动接到 Proxy，不需要手工补每个策略组。

公开配置不含私人节点，未填写时拒绝代理流量。按[三步接入说明](docs/profile-setup.md)生成自己的配置，再在客户端导入并确认实际选择。生成仅写仓库的 private/，不修改现用 QX 或其他应用。Mihomo、sing-box 做固定内核、真实订阅更新、四 DNS 角色和路由测试；其余六客户端以官方与高星完整配置交叉核对和独立接入测试验证，未冒称 GUI 实测。[验证记录](docs/validation.md)。

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

## 接入自己的节点或订阅

~~~sh
mkdir -p private
cp clients/quantumultX/profiles/input.example.json private/quantumultX.json
# 填入自己的 nodes 或 subscriptions；其他客户端替换 ID 和扩展名。
npm run profile -- --client quantumultX --input private/quantumultX.json --output private/quantumultX.conf
~~~

随后导入生成文件并确认 Proxy 的实际节点。原生 URL 来源加载后需在应用中选中节点；sing-box/Shadowrocket 的支持格式在本地展开，重跑命令刷新，不上传第三方转换站。私有文件权限 0600，失败保留旧成品，输入/输出和秘密保护见[完整接入说明](docs/profile-setup.md)。节点本身由使用者提供。

分流按 LAN/拦截 → 具体服务 → 宽泛父服务 → CN 域名及 IPv4/IPv6 → final Proxy；CN 数据使用固定许可来源并明确表达式边界。DNS 分别维护节点引导、国内直连、代理远端和 LAN 解析，保留客户端差异。

QX 的 fragments/geoip.conf 是合并到 [general] 的配置片段，不能作为重写订阅导入。GeoIP、Surge 面板和搜索重定向的路径、路由语义与验证限制见[可选功能说明](docs/features.md)。

可选 anti-AD 为八客户端提供独立规则及原生安装包或手工合并片段，无脚本、MITM 和跨模块存储 API。HTTPS-upgrade 为六个图形客户端提供 6 个同主机 HTTP→HTTPS 跳转，保留路径和查询；Loon 需要 3.5.1(978) 以上，Shadowrocket 使用手工合并片段。它不是 HSTS，也不承诺 302 保留非 GET 方法。

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

本仓库包含多种许可：原创通用代码采用 [MIT License](LICENSE)；HTTPS-upgrade 功能代码和生成资源采用 [GPL-2.0-only](src/features/https-upgrade/LICENSE)。第三方数据按其来源声明保留许可及 credits，不能把整个仓库内容一概视为 MIT。详见[第三方声明](THIRD_PARTY_NOTICES.md)。不读取或发布用户节点、订阅、令牌及证书。
