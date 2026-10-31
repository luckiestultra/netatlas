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
│   ├── routing.json                 # 默认策略、初始选项、规则顺序
│   ├── clients.json                 # 格式、版本与官方来源
│   ├── features.json                # 可选功能、路径、验证范围
│   ├── upstreams.json               # 数据来源、许可与校验值
│   └── native-tools.json            # 固定二进制版本与 SHA-256
├── tools/
│   ├── lib/profiles.mjs              # 八种原生配置渲染器
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

上图表示实现边界；只有存在真实产物时才生成相应可选目录。配置模板当前由 tools/lib/profiles.mjs 中的原生渲染器维护，没有另外一套 src/profiles/ 副本。

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

规则源只描述精确域名、域名后缀、IPv4 CIDR 和 IPv6 CIDR。category 是内部标签，公开 rules/ 按具体应用或服务 ID 平铺。策略与优先级只由 routing.json 决定；新增服务可自动生成同名选择组，不必为八个客户端分别复制规则事实。

`routing.excludedFromDefault` 指定只单独发布的可选大规则集。当前 anti-ad 有 100,682 条，不进入默认 38 组主配置；仍为八客户端生成独立规则与安装包/合并片段。清单分别记录默认与可选数量，不能把所有可下载规则误认为全部默认生效。

DNS、策略组、最终策略、规则执行阶段和 MITM 要求保留客户端差异。Egern、Mihomo、sing-box 的 YAML/JSON 结构分别适配；文件后缀相同也不隐含兼容。

## 如何扩展

- 新增应用分流：在 metadata/upstreams.json 登记稳定服务 ID、来源与许可，按规范写入 src/rules/<标签>/<服务ID>.json；外部来源通过 sync 获取。只有默认策略或优先级需要例外时才调整 routing.json。构建会为八个客户端自动生成同名规则与服务选择组，无需复制八份数据。
- 新增重写或脚本：在 src/features/<功能ID>/ 保存原生适配与测试，在 metadata/features.json 登记支持范围，再由 tools/lib/features.mjs 输出到对应客户端。不把尚未验证的宿主 API 当作通用接口。
- 新增客户端：在 metadata/clients.json 登记 ID、格式与来源，增加原生配置和规则适配、结构验证与语义测试。客户端能力差异明确保留。

扩展后运行 npm test、npm run build、npm run check；涉及原生配置时另跑对应内核或应用验证。发布目录不作为维护源。

## 功能与发布路径

scripts/ 保存已适配的 JS，rewrites/ 保存纯重写，modules/ 保存原生功能安装包，fragments/ 保存需要手工合并的配置片段。一个功能可以共享纯解析函数，但客户端宿主 API、请求路由和完成契约分别测试。QX General 合并片段不是重写订阅。

第三方功能须保留固定原文、许可证、修改说明与源 SHA；根 SPDX 不代替依赖闭包审查。HTTPS-upgrade 投影同时核对登记主机集合、唯一性、原文行和源/目标主机，规范化后的源路径必须留在该功能目录。MIT 通用工具和 GPL-2.0-only 功能明确分开标注。

主配置内联规则，所以无需先发布远程资源。可选功能使用的 baseUrl 只构造远程地址；推送前这些地址不能视为可用链接。公开发布采用 clients/<client>/ 的稳定路径，来源与校验值保存在清单；固定提交可用于复现和回退。

## 验证与私人数据

结构、规则语义、VM 契约、真实内核和原生应用导入分别记录。Mihomo、sing-box 有固定版本检查入口，六个图形应用仍需逐一导入；目录存在或结构通过不代表设备实测。

用户节点、订阅、令牌和证书保留在本地。公开模板、fixture、生成文件和日志不包含这些内容，工具不读取用户正在运行的客户端配置。

接口和验收分别见[规则](specs/rules.md)、[配置](specs/profiles.md)、[功能](specs/features.md)及[构建](specs/build.md)规格；实际证据见[验证记录](validation.md)。
