# 八客户端完整配置接入

主配置位于 `clients/<client>/profiles/default.<原生扩展名>`。直接在对应 App 中作为独立配置导入，再添加自己的节点或订阅、选择实际节点即可；日常使用不需要 Node.js、构建命令或本地生成器。配置包含明确 DNS、40 个本仓库远程规则资源、国内域名/IPv4/IPv6 兜底与最终策略，不附送私人节点。

所有客户端 ID：`quantumultX`、`surge`、`loon`、`shadowrocket`、`egern`、`stash`、`mihomo`、`singBox`。QX、Surge、Loon、Shadowrocket 使用 `.conf`，Egern、Stash、Mihomo 使用 `.yaml`，sing-box 使用 `.json`。每个客户端 README 列出主配置和资源入口。

## 在 App 中接入

| 客户端 | 节点或订阅入口 | 导入后的选择 |
| --- | --- | --- |
| QX | 在 App 的节点/资源页面添加自己的节点订阅，或填写 `[server_remote]` | “节点选择”通过内置 `proxy` 和节点名称匹配器使用 App 节点；确认当前节点和规则模式 |
| Surge | 在当前配置中添加原生节点，或添加 `select, policy-path=你的订阅URL` 来源组 | 在“节点选择”加入该来源；自动/地区组通过 `include-other-group` 连接来源，本地节点由 `include-all-proxies` 纳入 |
| Loon | 在配置的“订阅节点 / Remote Proxy”中添加来源 | 全部/地区 `Remote Filter` 自动筛选 App 节点，在“节点选择”选择实际节点或分组 |
| Shadowrocket | 在首页添加订阅并选中节点，再在配置页导入独立主配置 | 内置 `PROXY` 使用首页选中节点；自动/地区组按节点名称匹配，使用规则模式 |
| Egern | 在“节点订阅”选择组的 `urls` 中填写原生订阅，或添加本地原生节点 | “节点选择”引用订阅组；自动/地区组用 `flatten`、`filter` 展开并筛选订阅节点 |
| Stash | 填写自己的原生 `proxy-providers`，或添加本地 `proxies` | 将 provider 名称加入分组 `use`；`include-all` 纳入节点，在“节点选择”选择 |
| Mihomo | 填写自己的原生 `proxy-providers`，或添加本地 `proxies` | 将 provider 名称加入分组 `use`；`include-all` 纳入节点，由图形壳选择“节点选择”的成员 |
| sing-box | 内核没有通用原生订阅 provider；在 `outbounds` 添加真实节点，并将其 tag 加入 selector/urltest 的 `outbounds` | 更新“节点选择”的 `default` 和自动/地区组成员；也可使用支持订阅合并的图形壳，或下方可选本地工具 |

没有配置可用节点时，不能把主配置视为已连通。多数客户端的公开“节点选择”初始为 REJECT；QX、Shadowrocket 使用 App 内置节点选择，结果取决于 App 现有节点与选择状态。导入配置也不代表 App 已切换到它，既有选择可能保留。本仓库的生成与测试不会读取或改动你现用的 QX、其他应用配置或系统代理。

业务策略使用“AI服务、苹果服务、谷歌服务、微软服务、开发服务、即时通讯、游戏平台、国外媒体、国外网站”，最终交给“漏网之鱼”。苹果服务初始直连，其他业务通常跟随“节点选择”；可在 App 分别切换。另有“自动选择”和香港、台湾、日本、韩国、新加坡、美国六个地区组。地区组只匹配节点名称，不提供节点，也不保证空组自动回退到其他地区；先确认有匹配节点再选择。

40 个规则资源由客户端独立拉取更新，主配置保持精简；规则内容刷新与主配置升级分开进行。支持明确间隔的适配器使用一天刷新，Loon 由 App 管理规则刷新。策略组、DNS 或功能配置变化时，再升级主配置。`rules/` 下仍按 `openai`、`netflix`、`github` 等具体 App/服务 ID 平铺，中文业务组仅控制策略，不改变资源路径。

QX 默认主配置已经接入本仓库 GeoIP 查询脚本；独立 GeoIP 片段继续提供给其他已有配置使用。重写与 MITM 默认关闭，不安装证书；其他可选模块、片段按客户端 README 单独选择。

## 可选高级方式：内联配置与本地生成器

需要不依赖远程规则 URL 的完整内联文件时，可使用 `clients/<client>/profiles/standalone.<原生扩展名>`。需要本地合并订阅、批量填写原生节点或自定义 DNS 时，以下工具在仓库忽略目录 `private/` 生成独立内联文件；它不是使用默认 App 配置的前置步骤。不要把私人文件提交或发给在线转换网站。

### 三步生成自己的配置

以 QX 为例，其他客户端只需替换 ID 和扩展名：

~~~sh
mkdir -p private
cp clients/quantumultX/profiles/input.example.json private/quantumultX.json
# 用编辑器填入自己的原生节点或订阅，参见下表。
npm run profile -- --client quantumultX --input private/quantumultX.json --output private/quantumultX.conf
~~~

在客户端导入生成的文件，确认 Proxy 当前选择，再启动你选择的配置。填了本地节点时默认选择第一个；可用 `selectedProxy` 指定另一个实际节点。原生 URL 来源由客户端加载；待加载后选择来源中的真实节点。仅导入配置不代表应用已切换到它，既有选择也可能保留。

私有输入是 JSON：

~~~json
{
  "version": 1,
  "nodes": [],
  "subscriptions": [],
  "selectedProxy": "My-Node"
}
~~~

`nodes` 和 `subscriptions` 至少填一项；没有本地节点或尚不知道订阅节点名称时先省略 `selectedProxy`。下面的 `proxy.example.invalid` 仅解释格式，必须换成自己的真实地址；不会把它作为活动节点放进公开配置。

### 私有生成器的节点与订阅

下表中的 `Proxy` 是高级内联配置的策略名；公开默认配置使用前述中文业务组和“节点选择”。

| 客户端 | nodes 中一个本地节点示例（换成真实原生参数） | subscriptions 的实际处理 |
| --- | --- | --- |
| QX | `"socks5=proxy.example.invalid:1080, tag=My-Node"` | `[server_remote]` 原生 QX 资源，Proxy 的 `server-tag-regex=.+` 纳入节点；URI/其他软件资源通过应用原生导入，不能假设所有格式无需转换 |
| Surge | `"My-Node = socks5, proxy.example.invalid, 1080"` | 每来源独立原生 `select,policy-path=URL`，连接到 Proxy；加载后手选，空来源不自动选中 |
| Loon | `"My-Node = http, proxy.example.invalid, 8080"` | 原生 `[Remote Proxy]` 别名接入 Proxy；更新由应用管理 |
| Shadowrocket | `"My-Node = socks5, proxy.example.invalid, 1080"` | 本地拉取支持的原生 Proxy 文本/JSON 并展开；常规 URI 机场订阅也可在应用首页导入，Proxy 原生匹配器纳入应用节点 |
| Egern | `{"socks5":{"name":"My-Node","server":"proxy.example.invalid","port":1080}}` | 原生 Proxy 选择组 `urls`；同组来源使用相同刷新间隔，加载后手选实际节点 |
| Stash | `{"name":"My-Node","type":"socks5","server":"proxy.example.invalid","port":1080}` | 原生 proxy-providers 及 Proxy 的 use/include-all |
| Mihomo | 同 Stash | 原生 HTTP provider，默认直连下载，Proxy use/include-all；本地节点还设置原生 default-selected |
| sing-box | `{"tag":"My-Node","type":"socks","server":"proxy.example.invalid","server_port":1080,"version":"5"}` | 没有伪造 outbound-provider；本地拉取并展开真实 outbounds，设置 Proxy selector 的成员和 default |

原生协议的 TLS、Reality、认证和传输参数仍按各客户端格式填写。不会把一个客户端的节点对象直接塞给另一个。脚本、外部程序或策略对象不能伪装成代理节点。Egern AnyTLS 未指定时启用证书校验；用户原生输入中明确设置的选项保留，不能把任意私人节点都笼统称为已验证安全。

一个来源：

~~~json
{"name":"My-Subscription","url":"https://your-provider.example/subscription","interval":3600}
~~~

将它放入 `subscriptions` 数组，并把 URL 换成自己的。生产来源要求 HTTPS，HTTP 仅允许回环测试。账号/密码或 token 应留在私人文件；命令成功/错误输出不回显订阅 URL、节点密码或正文。原生订阅刷新由应用进行；Shadowrocket/sing-box 本地展开的来源执行同一命令刷新，成功时保留前一输出副本。

高级 Mihomo 原生 URL 来源模式需要在加载后选择节点：图形壳负责该操作；裸内核可用官方 `-ext-ctl 127.0.0.1:端口`、`-secret` 启动一个受保护的回环控制接口，再以 `PUT /proxies/Proxy` 选择来源里的真实节点。高级订阅刷新测试采用此原生路径。公共配置不默认开放管理接口；本地节点输入可用 `selectedProxy` 生成已选择的配置。

### 本地导入器支持范围

sing-box 支持原生 JSON 数组/`outbounds`，基本 Clash YAML/JSON `proxies`，及常见 VLESS、Trojan、Shadowsocks SIP002、VMess 的普通/整批 Base64 URI；支持已实现的 TCP、WebSocket、gRPC 传输，WS 自定义鉴权头会完整保留。原生 JSON 是复杂选项的首选格式。

不把未知功能静默简化：SS 插件、HY2 混淆、TLS 包装 SOCKS、VMess TCP HTTP header 等尚未转换的特征会明确拒绝，要求提供正确原生 outbounds。这样失败不会把能用的配置覆盖成握手错误的节点。不要把“支持某类订阅”理解为已经实现该类所有扩展字段。

Shadowrocket 本地导入器支持原生 `[Proxy]` 节点文本或 `{"nodes":["My-Node = ..."]}`；URI 机场来源通过 Shadowrocket 自身导入。不会伪造 Surge 的 policy-path 或 sing-box 不存在的 provider 字段。

空来源、HTTP 失败、坏格式、重名/悬空节点和不支持的关键功能都会拒绝生成，并保留原文件；多个本地展开来源中任何一个失败都不会发布半套节点。输入输出不能互为同一文件、软链接或硬链接，输出必须在仓库 `private/` 下且权限为 0600。加载过程中检测到用户改动也拒绝覆盖。

## DNS 方案

默认配置保留 bootstrap、国内/直连、远端与 LAN 的原生边界，使用远程规则集参与 DNS 分类，避免把成千上万个域名再内联一遍。下表也适用于高级内联配置；表中的 Proxy 在默认配置对应“节点选择”，部分 App 由代理节点远端解析目的域名。

| 客户端 | 节点引导与国内/直连 | 代理目的域名与 LAN |
| --- | --- | --- |
| QX | IP 引导上游和 AliDNS DoH；节点地址独立绑定引导解析 | 代理目的域名由节点远端解析，LAN 绑定系统；不伪造 foreign DoH 经 Proxy 字段 |
| Surge/Loon | 明确本地引导服务器和国内 DoH 直连，不以代理解析代理自己的地址 | 代理连接保留目的主机名给节点；系统/客户端承担本地 LAN 解析 |
| Shadowrocket | direct-dns-server + proxy-dns-server 独立引导，明确 DoH/系统回退 | 保留原生代理远端解析机制与本地系统回退 |
| Egern | 独立 bootstrap/proxy_nameservers；按原有分流顺序生成 forward | LAN→local、拦截→reject、直连→domestic、服务代理→remote，服务例外优先宽泛 CN |
| Mihomo | 独立 proxy-server-nameserver；直连 DNS 遵循 nameserver-policy | remote 经 Proxy；LAN local；明确服务 DNS 先于 CN；CN IP 兜底可触发解析 |
| Stash | 原生引导与独立 proxy-server-nameserver | nameserver-policy + follow-rule；国内 DoH IP 命中 CN 直连、国外 DoH IP 走 Proxy；LAN 系统 |
| sing-box | 节点域名独立 bootstrap；默认 DNS 及 route resolve 尊重 DNS 规则 | local/domestic/remote 三类目的解析，remote detour Proxy；不以 bootstrap 强行绕过分流 |

支持的角色可在 `dnsUpstreams` 中覆盖。Native 内核示例：

~~~json
{"bootstrap":"https://223.5.5.5/dns-query","domestic":"https://223.5.5.5/dns-query","remote":"https://1.1.1.1/dns-query","local":"system"}
~~~

INI/Apple 客户端的 bootstrap 使用原生 IP 端点（如 `223.5.5.5`）；前三者的远端解析由节点处理，不假装同一 `remote` 字段能改变节点侧 DNS。Mihomo 支持私有 `listenerPorts:{mixed:7890,dns:1053}`，sing-box 支持 `listenerPorts:{mixed:7890}`；仅改变回环端口，不允许开启 LAN 或系统代理。

## 分流优先级与数据

LAN / 隐私拦截 → 具体 AI/媒体/社交/开发服务 → Apple/GitHub/Google/Microsoft 广覆盖 → CN 域名 → CN IPv4/IPv6 → 最终策略。默认配置最终交给“漏网之鱼”，高级内联配置最终交给 Proxy。明确服务例外优先 CN，例如 google.cn 仍按谷歌服务策略决定，DNS 分类也保留服务例外优先 CN 的顺序；各 App 的原生匹配规则仍有差异。

默认引用 40 个规则资源，共 29,103 条；高级 standalone 文件将这些规则内联。CN 域名 8,387 条（原 19 个全部保持语义覆盖），IPv4 6,174 条、IPv6 3,475 条；固定 MIT 上游及精确非可移植表达式记录见来源清单。CN CIDR 允许解析未匹配域名以完成兜底，LAN CIDR 保留 `no-resolve`。这些规则是网络分类，不是完美地理位置真值；没有把 3 条被记录的 CN regex 冒充已跨八客户端等价实现。anti-AD 另有 100,682 条可选资源。

## 验证如何复现

~~~sh
npm ci
npm test
npm run build
npm run check
npm run test:native
~~~

验证区分默认远程资源配置和高级内联配置。固定 Mihomo、sing-box 内核检查与路由测试验证真实内核行为；私有输入工作流另验证 HTTP 订阅、节点刷新、四种 DNS 角色和 HTTP/SOCKS 目标请求。远程资源测试使用受控本地服务检查实际拉取与更新，不能以 YAML/JSON 可解析代替连通性结果。具体已执行项目与结果以[验证记录](validation.md)为准。

六个闭源应用没有可用测试设备，以官方文档、固定高星完整配置和独立接入/边界测试交叉核对；这些不是 GUI 导入或流量实测。来源记录见 [profile-references.json](../metadata/profile-references.json)，实际日志和结论见验证记录。测试和生成都不更改用户现用 QX 或其他客户端配置。

## Mihomo / sing-box 的接管方式

主配置包含原生 TUN、DNS 劫持和自动接口选择，供客户端/VPN 前端启用后接管设备流量；mixed 入口仍仅绑定回环。sing-box 目标为 1.14.4，DNS/TUN 字段不能直接用于旧版本。仅需本地 HTTP/SOCKS 时可在自己的配置关闭/移除 TUN。

仓库验证对公开 TUN 成品只运行内核配置检查，不启动 TUN。流量测试通过显式 captureTraffic:false 渲染无 TUN 的回环配置，真实下载同一套规则并测试 DNS/路由；这不等同于 GUI VPN 实测，也不改变本机网络。

扩展规则与安装资源的逐项支持/来源差异见[覆盖清单](coverage.md)。
