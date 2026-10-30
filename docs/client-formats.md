# 客户端主配置格式与验证依据

主配置由 `tools/lib/profiles.mjs` 生成。公开入口按软件排列：`clients/<client>/profiles/default.<原生扩展名>`；独立规则直接位于 `clients/<client>/rules/<服务或应用ID>.<原生扩展名>`，不再增加类别目录。

这八个模板是独立适配器，不因文件扩展名相同就共用全部配置语法。规范规则只有 `domain`、`domain-suffix`、`ip-cidr`、`ip-cidr6`；主配置将其按输入顺序内联，不需要先发布远程规则或修改下载地址。

## 各客户端的原生表达

| 客户端 ID | 主配置 | 精确域名 / 后缀 | IPv4 / IPv6 | 策略与兜底 |
|---|---|---|---|---|
| `quantumultX` | INI `.conf` | `host` / `host-suffix` | `ip-cidr` / `ip6-cidr` | `[policy] static=...`；`final,Proxy` |
| `surge` | INI `.conf` | `DOMAIN` / `DOMAIN-SUFFIX` | `IP-CIDR` / `IP-CIDR6` | `[Proxy Group] ...=select,...`；`FINAL,Proxy` |
| `loon` | INI `.conf` | `DOMAIN` / `DOMAIN-SUFFIX` | `IP-CIDR` / `IP-CIDR6` | `[Proxy Group] ...=select,...`；`FINAL,Proxy` |
| `shadowrocket` | INI `.conf` | `DOMAIN` / `DOMAIN-SUFFIX` | `IP-CIDR` / `IP-CIDR6` | `[Proxy Group] ...=select,...`；`FINAL,Proxy`；待原生导入确认 |
| `egern` | YAML `.yaml` | `domain` / `domain_suffix` 对象 | `ip_cidr` / `ip_cidr6` 对象 | `policy_groups[].select`；`rules[].default.policy` |
| `stash` | YAML `.yaml` | `rules` 中原生规则行 | `IP-CIDR` / `IP-CIDR6` | `proxy-groups`；`MATCH,Proxy` |
| `mihomo` | YAML `.yaml` | `rules` 中原生规则行 | `IP-CIDR` / `IP-CIDR6` | `proxy-groups`；`MATCH,Proxy` |
| `singBox` | JSON `.json` | `domain` / `domain_suffix` 数组 | 两者均使用 `ip_cidr` 数组 | `selector` outbound；路由 `action`；`route.final` |

QX 仅将内建 `DIRECT`、`REJECT` 转为小写，保留 `Proxy` 和各服务 ID 的大小写。Egern 的单条配置规则是 `{domain: {match, policy}}` 这类对象；独立规则集则是 `domain_set`、`domain_suffix_set`、`ip_cidr_set`、`ip_cidr6_set` 顶层数组，两者不能互换。

## 默认行为

- 没有节点、虚构订阅或令牌。`Proxy` 的第一个选项是 `REJECT`，另有明确的 `DIRECT` 选项。添加自己的节点后，需要把它加入相应策略组并主动选择。这描述新建组的初始配置；图形应用可能保留先前保存的选择，导入后应核对 `Proxy` 的当前选项。
- 策略组按服务 ID 自动生成，例如 `openai`、`netflix`、`github`，不使用固定的大类组名。新增规范规则集后不需要修改各客户端渲染代码。初始选择和匹配顺序由 `metadata/routing.json` 单独登记，`tools/lib/policies.mjs` 将其转换为各客户端策略；分类标签不决定路由。目前仅 `apple` 初始选择 `DIRECT`，其他服务组初始指向 `Proxy`；`lan`、`china` 固定使用 `DIRECT`，`adblock` 固定使用 `REJECT`。
- Mihomo 和 sing-box 的代理入口绑定 `127.0.0.1:7890`，不额外开启管理接口。Surge Mac 的 HTTP/SOCKS 入口绑定回环地址。其他图形客户端不生成额外的公共监听入口，局域网共享还受客户端自身设置控制。
- 不开启 MITM、不安装根证书、不设置系统代理、不修改系统路由。图形客户端自身的 VPN 或系统代理开关由用户操作。
- DNS 使用客户端或系统默认行为；sing-box 使用现代 `type: local` DNS 服务，不生成已删除的旧式 DNS outbound。主配置没有额外的公共 DNS 查询服务依赖。
- INI/YAML 的 IP 规则使用 `no-resolve`（Egern 为 `no_resolve: true`），避免为这些纯网段规则主动解析未匹配的域名。sing-box 保留其原生路由/DNS处理流程，不把别的客户端参数强行映射进去。

## 官方依据与基线

核对日期：2026-10-31。原生内核版本固定在验证工具与清单中，不能用“最新”替代可复现版本。

### Quantumult X

[开发者配置示例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf) 展示 `[policy]`、`static`、`[server_local]`、`[filter_local]`，以及 `host`、`host-suffix`、`ip-cidr`、`ip6-cidr` 与 `final`。不继承示例中的虚构节点、外部资源订阅或证书内容。

### Surge

[主配置结构](https://manual.nssurge.com/profile/format.html)、[General 参数](https://manual.nssurge.com/profile/general.html)、[策略组](https://manual.nssurge.com/policy-groups/overview.html)、[规则](https://manual.nssurge.com/rules/overview.html)。回环监听使用当前的 `http-listen`、`socks5-listen`，不使用旧的 `interface` / `port` 别名。iOS 的局域网共享显式关闭。

### Loon

[规则总览](https://nsloon.app/docs/Rule/)、[IP 规则](https://nsloon.app/docs/Rule/ip_rule/)、[开发者策略组手册](https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/policygroup.md)、[General 手册](https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/general.md)。现行 IP 规则页面明确给出 `IP-CIDR6` 与 `no-resolve`，不能根据不完整的社区说明把 IPv6 类型误删。

### Shadowrocket

[官方 App Store 页面](https://apps.apple.com/us/app/shadowrocket/id932747118) 确认域名、后缀、CIDR、IPv6 和规则导入能力，其开发者链接指向 [shadowlaunch.com](https://shadowlaunch.com/)。这两个官方页面没有提供完整公开配置语法，因此本仓库不把第三方同名网站包装成官方手册，也不声称其文本测试等于原生导入成功。该模板保留独立适配器与验证限制，仍需在应用中导入并核对实际匹配。

### Egern

[配置示例](https://egernapp.com/docs/configuration/example/)、[策略组](https://egernapp.com/docs/configuration/policy_groups/)、[规则与独立规则集](https://egernapp.com/docs/configuration/rules/)。使用 Egern 自身的 `policy_groups` 和对象规则，不输出 Clash 的 `proxy-groups`、`payload` 或逗号规则列表。

### Stash

[原生配置样例](https://stash.wiki/configuration/example-config)、[策略组](https://stash.wiki/proxy-protocols/proxy-groups)、[分流类型](https://stash.wiki/rules/rule-types)、[局域网共享](https://stash.wiki/en/features/provide-proxy-to-lan-device)。空策略组可能退化为直连，所以所有生成的选择组都有明确成员，`Proxy` 以 `REJECT` 开头。

### Mihomo

固定验证版本为 **v1.19.33**。[通用配置](https://wiki.metacubex.one/en/config/general/)、[选择组](https://wiki.metacubex.one/en/config/proxy-groups/select/)、[路由规则](https://wiki.metacubex.one/en/config/rules/)。该模板只用混合代理入口与内联经典规则，不需要下载 GeoIP、GeoSite 或远程规则提供器才能检查和启动。

### sing-box

固定验证版本为 **v1.14.4**。[Mixed inbound](https://sing-box.sagernet.org/configuration/inbound/mixed/)、[Selector](https://sing-box.sagernet.org/configuration/outbound/selector/)、[路由动作](https://sing-box.sagernet.org/configuration/route/rule_action/)、[Local DNS](https://sing-box.sagernet.org/configuration/dns/server/local/)。

`REJECT` 的选择项使用真正的 `block` outbound，而不是不可连接的假节点。该版本的[官方注册代码](https://github.com/SagerNet/sing-box/blob/v1.14.4/include/registry.go) 和 [block 实现](https://github.com/SagerNet/sing-box/blob/v1.14.4/protocol/block/outbound.go) 明确保留此类型；不能把旧版本迁移印象当成当前事实。隐私拦截规则使用 `action: reject`，普通路由使用 `action: route`，不生成旧 DNS outbound、旧 GeoIP/GeoSite 或旧 inbound sniff 字段。

## 验证范围

`tests/profiles/render.test.mjs` 检查八种格式、四类规则、输入顺序、原生策略引用、默认拒绝、回环地址与不存在的远程发布依赖。测试也区分 Egern 与 Clash YAML、QX 的内建策略大小写和 sing-box 的原生动作。

`npm run test:native` 依据 `metadata/native-tools.json` 下载固定的官方发行包并验证 SHA-256，在缓存中提取内核。支持 `darwin-arm64`、`linux-x64`；每次运行只验证当前宿主平台。工具检查生成的完整 Mihomo / sing-box 主配置，并将每个 sing-box 独立规则集编译为 SRS。实际结果单独记录在 `.cache/native-check/latest.json`，包含被检查主配置与规则集输入的 SHA-256；构建清单本身不代表已经执行原生验证。

同一命令还会启动两个真实内核，在回环 HTTP、SOCKS5 上游及 DNS 测试服务上验证 44 个路由行为。覆盖显式直连/拒绝、默认拒绝/直连/代理，以及后缀规则的根域、子域和相似域边界；不访问公网测试目标，不修改系统代理。日志和临时配置均保留在 `.cache/native-check/`。这些测试证明内核的代表性路由行为，不等于逐条规则都做过网络测试。

闭源应用的原生导入和路由结果必须单独记录。仅通过 JSON/YAML/INI 结构检查时，只能标记结构级验证。
