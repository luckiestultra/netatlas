# 架构与目录

用户从客户端目录取用文件，维护者从规范源修改数据。这样可以同时保留单一规则来源与客户端原生行为。

~~~text
netatlas/
├── clients/<client>/                 # 构建生成的公开内容
│   ├── profiles/
│   ├── rules/<service-id>.*
│   ├── rewrites/
│   ├── scripts/
│   ├── modules/
│   └── fragments/
├── src/
│   ├── rules/<category>/<id>.json     # 规范匹配事实
│   └── features/<feature>/           # 纯解析与明确的原生适配器
├── metadata/
│   ├── routing.json                 # 固定策略、规则顺序
│   ├── managed-policies.json        # 主配置业务名称、地区筛选与选择层
│   ├── clients.json                 # 格式、版本与官方来源
│   ├── features.json                # 可选功能、路径、验证范围
│   ├── upstreams.json               # 数据来源、许可与校验值
│   └── native-tools.json            # 固定二进制版本与 SHA-256
├── tools/
│   ├── lib/managed-profiles.mjs      # App 主配置与远程资源
│   ├── lib/profiles.mjs              # 高级内联配置渲染器
│   ├── lib/exporters.mjs             # 规则格式导出
│   ├── lib/features.mjs              # 功能产物组合
│   ├── build.mjs
│   ├── validate.mjs
│   ├── sync.mjs
│   ├── native.mjs
│   └── live.mjs
├── tests/{rules,profiles,scripts}/
├── docs/specs/{rules,profiles,features,build}.md
└── .github/workflows/
~~~

上图表示实现边界；只有存在真实产物时才生成相应可选目录。主配置由 managed-profiles.mjs 与客户端适配器维护，完整内联配置由 profiles.mjs 维护，没有另外一套 src/profiles/ 副本。

## 数据流

~~~mermaid
flowchart LR
  R[规范规则] --> P[原生配置和规则适配器]
  M[路由与能力清单] --> P
  F[纯功能核心和客户端适配器] --> B[统一构建]
  P --> B
  B --> C[clients 下的发布产物]
  C --> V[语义、结构及可用原生检查]
~~~

规则源只描述精确域名、域名后缀、域名关键词、IPv4 CIDR 和 IPv6 CIDR。category 是内部标签，公开 rules/ 按具体应用或服务 ID 平铺。固定策略与优先级由 routing.json 决定；主配置的业务组、地区筛选和服务映射由 managed-policies.json 维护。新增未映射服务归入国外网站，可单独登记业务策略，不为八个客户端复制规则事实。

`routing.excludedFromDefault` 指定只单独发布的可选大规则集。当前 anti-ad 有 100,682 条，不进入默认 40 组主配置；仍为八客户端生成独立规则与安装包/合并片段。清单分别记录默认与可选数量，不能把所有可下载规则误认为全部默认生效。

DNS、策略组、最终策略、规则执行阶段和 MITM 要求保留客户端差异。Egern、Mihomo、sing-box 的 YAML/JSON 结构分别适配；文件后缀相同也不隐含兼容。

## 如何扩展

- 新增应用分流：在 metadata/upstreams.json 登记稳定服务 ID、来源与许可，按规范写入 src/rules/<标签>/<服务ID>.json；外部来源通过 sync 获取。只有默认策略或优先级需要例外时才调整 routing.json。构建会为八个客户端生成同名规则；需要单独业务策略时登记 managed-policies.json。高级内联版保留同名服务选择组。
- 新增重写或脚本：在 src/features/<功能ID>/ 保存原生适配与测试，在 metadata/features.json 登记支持范围，再由 tools/lib/features.mjs 输出到对应客户端。不把尚未验证的宿主 API 当作通用接口。
- 新增客户端：在 metadata/clients.json 登记 ID、格式与来源，增加原生配置和规则适配、结构验证与语义测试。客户端能力差异明确保留。

扩展后运行 npm test、npm run build、npm run check；涉及原生配置时另跑对应内核或应用验证。发布目录不作为维护源。

## 功能与发布路径

scripts/ 保存已适配的 JS，rewrites/ 保存纯重写，modules/ 保存原生功能安装包，fragments/ 保存需要手工合并的配置片段。一个功能可以共享纯解析函数，但客户端宿主 API、请求路由和完成契约分别测试。QX General 合并片段不是重写订阅。

第三方功能须保留固定原文、许可证、修改说明与源 SHA；根 SPDX 不代替依赖闭包审查。HTTPS-upgrade 投影同时核对登记主机集合、唯一性、原文行和源/目标主机，规范化后的源路径必须留在该功能目录。MIT 通用工具和 GPL-2.0-only 功能明确分开标注。

主配置引用本客户端的远程规则，必须与对应资源一同发布并核验路径；首次使用需要下载规则。standalone 版本内联规则，可不依赖远程规则下载。baseUrl 只构造远程地址，不自动证明可用性。公开发布采用 clients/<client>/ 的稳定路径，来源与校验值保存在清单；固定提交可用于复现和回退。

## 验证与私人数据

结构、规则语义、VM 契约、真实内核和原生应用导入分别记录。Mihomo、sing-box 有固定版本检查入口，六个图形应用仍需逐一导入；目录存在或结构通过不代表设备实测。

用户节点、订阅、令牌和证书保留在本地。公开模板、fixture、生成文件和日志不包含这些内容，工具不读取用户正在运行的客户端配置。

接口和验收分别见[规则](specs/rules.md)、[配置](specs/profiles.md)、[功能](specs/features.md)及[构建](specs/build.md)规格；实际证据见[验证记录](validation.md)。

内容覆盖和数据来源现在同时登记在metadata/coverage.json、features.json、integrations.json及resource-parsers.json。分流仍在客户端rules/按服务平铺，纯重写在rewrites/，脚本功能安装资源在modules/，手工合并设置在fragments/。工具安装包可以共享上游实现，但不在不支持的核心里伪造脚本宿主。

## 宿主专属匹配条件

公共 `src/rules/` 保留五类可移植事实。`src/native-rules/` 保存原始ASN编号，`metadata/native-routing.json` 记录宿主ASN/GeoIP能力与数据库更新字段；`metadata/regex-routing.json` 保存源表达式和逐端精确转换证明。`tools/lib/routing-extensions.mjs` 仅在所选源存在时合并原生条件；正则还核对规范投影SHA，避免私有调用复用同一ID时意外恢复不需要的源表达式。未知/改变的来源不静默生成。

输出仍是 `clients/<client>/rules/<id>.*`，原生资源独立命名 `china-asn`、`geoip-cn`、`<sourceId>-regex`；没有支持的客户端不生成假资源。默认远程引用与standalone内联使用同一能力计划，ASN/GeoIP只用于路由，不作为DNS域名选择器。`src/supplements/` 保留有独立许可、主来源和SHA的精确端点事实，不能绕过规则目录来源审计。
