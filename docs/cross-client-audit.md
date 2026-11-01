# 八客户端交叉复核（2026-11-02）

本轮从提交 `954e9193c317a367c4e699ca8077ab3ad1328d07` 开始。735项离线测试和该提交的Linux CI虽已通过，新的真实输入与官方宿主契约对照仍发现下列四项缺陷。因此“CI通过”只证明已覆盖断言通过，不能当作完整功能或六个GUI原生导入已经验证。

## 已确认的缺陷与限定修复

| 范围 | 触发与实际问题 | 修复和复现证据 |
| --- | --- | --- |
| sing-box本地订阅转换 | Clash VMess/VLESS WSS缺省SNI被设成服务器地址，ALPN照抄h2；与Mihomo的WS Host回落及HTTP/1.1强制值不同。实际Mihomo源可完成HTTP，转换后sing-box报TLS no application protocol或证书名称错误。 | WSS按原生servername→WS Host→服务器推导SNI并固定HTTP/1.1；忽略源未使用的sni别名，拒绝大小写重复Host和不能等价激活的WS Reality。单位回归先RED，真实TLS+WS+合成VLESS认证前缀+HTTP回环再RED→GREEN。单独错误SNI与错误ALPN负控均失败。不是完整VLESS协议合规测试。 |
| Surge default/standalone/private | 全局encrypted-dns-server启用后，dns-server=system仅作bootstrap；home.arpa等LAN域名缺少本地DNS绑定，DIRECT分流不能替代DNS选择。 | 补原生[Host]的根域和子域server:system/用户local resolver映射，并将该节保留到managed默认配置。5项新增回归先全失败；与官方配置执行语义交叉复核。没有Surge App实测。 |
| Loon可选ScriptHub模块 | 三个script(path)入口省略第二参数，Loon注入null；固定上游均在参数初始化调用.split，转换前立即TypeError。旧静态安装器测试仍绿。 | 仅三个固定生成调用增加空字符串参数；原始模板、脚本URL、MITM范围及源哈希不变。三个完整固定脚本按官方null输入全部RED，读取实际生成DSL的空参数全部GREEN，各完成一次。18个安装器仅这一包发生适配。没有Loon原生DSL parser或GUI实测。 |
| 八端共享Grok分流 | Twitter的x.com父域在xAI的grok.x.com前，子服务被抢先归到Twitter/即时通讯，AI服务选择无法生效。 | 只把Twitter加入已有宽父域后置名单，不改全部排序算法。八端managed+standalone先16项失败；两真实核心HTTP/SOCKS回环证明修复，新增60个流量案例。LAN/Unbreak/adblock优先保持。 |

Mihomo源语义依据：[VLESS WSS](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vless.go#L179)、[VMess WSS](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/vmess.go#L199)。Surge依据：[全局加密DNS](https://manual.nssurge.com/dns/encrypted-dns.html)、[Host DNS映射](https://manual.nssurge.com/dns/local-dns-mapping.html)。多resolver列表要求Surge iOS 5.21.0+/Mac 6.8.0+；server:system不等于已实测mDNS。Loon依据：[Script v2参数](https://nsloon.app/docs/Script/script_v2/#argument-参数)；固定上游三个初始化摘录和源码哈希见[参数回归](../tests/scripts/integrations-loon-argument.test.mjs)。

## 核查与实测边界

| 客户端 | 这次覆盖的主要路径 | 验证边界 |
| --- | --- | --- |
| Quantumult X | 共享分流优先级；上一轮完整公开anti-AD与资源解析器真实JSC基线 | 本轮没有访问或操作本地QX；不将JS引擎测试称App导入 |
| Surge | 主配置、native policy-path/组/规则、DNS、模块与private生成 | 官方配置契约、实际渲染和负例，GUI未实测 |
| Loon | 原生订阅/NameRegex/策略组/规则、Script v2模块与参数 | 官方契约、固定真实JS字节VM与负例，GUI/原生DSL未实测 |
| Shadowrocket | 原生Proxy行、本地订阅物化、组/分流/DNS、安装器 | 结构与已登记参考；缺少开放厂商完整语法和GUI实测，不声称全部可用 |
| Egern | node/selector/订阅/Forward DNS/规则模块、脚本包装 | 官方schema和生成契约；GUI未实测 |
| Stash | provider/use/include-all/classical rules/DNS policy/覆写 | 当前官方文档与生成契约；GUI未实测 |
| Mihomo | 规则顺序、原生provider、订阅/TLS、四角色DNS与回环流量 | 固定真实核心，不启用TUN或系统代理；非GUI |
| sing-box | 本地订阅转换、原生节点图、DNS/分流与TLS/WS实际流量 | 固定真实核心，不启用TUN或系统代理；未穷举所有远端服务/协议 |

Egern proxy_nameservers的“目的域名”究竟指拨号器端点还是最终网站，以及Loon并发/回退DNS对LAN负响应的具体行为，当前材料不足以确认；均保留为未证实候选，没有贸然改配置。未确认新增缺陷不表示没有缺陷；此记录不承诺所有高级节点字段、所有模块或原生GUI均完整验证。

## 可重复验证

- [Surge本地DNS回归](../tests/profiles/surge-lan-dns.test.mjs)：真实default/standalone/private渲染，含不应匹配的公共域名负例。
- [WSS转换回归](../tests/profiles/subscription-wss.test.mjs)与[真实TLS流程](../tests/native/subscription-tls.test.mjs)：源/目标使用同一个合成证书、固定核心，错误SNI/ALPN单字段负控；信任仅在隔离运行副本，不写系统证书。
- [服务优先级](../tests/profiles/service-priority.test.mjs)与[实际路由](../tests/native/routing.test.mjs)：两源真实规则和完整catalog排序分别验证；不用全127.0.0.1 DNS答案掩盖LAN规则。
- [Loon参数回归](../tests/scripts/integrations-loon-argument.test.mjs)：真实固定初始化字节，按官方宿主契约执行；完整上游脚本另外在合成VM复放。

最终冻结检查：757项离线测试中749通过、0失败、8项原生opt-in跳过；另两真实核心392项回环案例通过，八客户端1137产物校验通过。完整结果统一记录在[验证记录](validation.md)。测试不访问任何私人订阅，没有读取或更改用户客户端配置、节点、缓存、连接或系统代理。
