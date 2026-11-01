# 功能包

分流规则在各客户端的 rules/，纯重写资源在 rewrites/，JavaScript 在 scripts/。modules/ 只放原生功能安装包；fragments/ 保存需要手工合并的配置片段。QX 主配置已接入 GeoIP 显示与本仓库资源解析器；其他可选功能不自动启用。

行为契约见[功能规格](specs/features.md)，整体范围见[能力表](capabilities.md)，当前执行证据见[验证记录](validation.md)。

## GeoIP

共享核心是 src/features/geoip/core.mjs，只解析数据，不发请求、不读取客户端存储。支持 ipwho.is、IPinfo legacy/Lite、ipwho.de 和 ip-api 响应结构；兼容 ip-api 不代表推荐其定位结果。API实际返回的国家、城市、组织和IP字段保持原值；QX显示层按国家代码使用固定Unicode CLDR 48中文名称，不用节点名称推测位置，也不会填入虚构城市或服务商。CLDR不是IP定位数据库，中文化不会把源返回的美国强改成日本。[固定来源与许可](../src/features/geoip/localization/NOTICE.md)。

空 ASN、缺失字段、无地理数据、无效 JSON、HTTP 错误、限流和传输超时分别处理。HTTP 403 不自动视为限流；收到一个 HTTP 响应也不被包装为“所有网络正常”。数据库定位不是物理机房证明。

### Quantumult X

产物：

- clients/quantumultX/scripts/geoip.js
- clients/quantumultX/fragments/geoip.conf：只有设置了公开构建 baseUrl 才生成。

主配置 default.conf 已包含该 checker；其他既有配置可使用 geoip.conf 合并到 [general]。该片段**不是重写订阅，也不是完整配置**。它使用 http://ipwho.is/?lang=zh-CN，并引用本仓库生成的公开脚本地址。内置 geo_location_checker 仅支持 HTTP 查询源；脚本接收原生 $response，只调用一次 $done，不会再发请求或更改节点。内置定位宿主将 $done 定义为返回参数本身的函数，并消费整段脚本的最终求值结果；适配器的外层函数必须 return $done(...)，否则即使调用了 $done，宿主拿到的仍是 undefined。回归测试同时校验四字段对象和最终求值结果。

QX 标题输出国旗、中文国家和实际地点，例如 `🇺🇸 美国 加州 洛杉矶` 或 `🇯🇵 日本 东京`；同名地区/城市去重，已登记的地区可用短名。第二行仅显示 ASN 与完整 IP，不再插入运营商名称，避免名称字宽挤掉末尾地址；完整组织、省州、城市、时区仍保留在输出对象的 `description` 字段。长 IPv6 的第二行仅显示完整地址。QX 原生标签按像素宽度裁剪，脚本没有界面宽度信息，仍不能保证任意窄窗口或长 IPv6 都完整显示。独立 `ip` 和 `description` 字段也保留完整 IP；不保证 QX 界面会展示 `description`。蓝色星标由 QX 根据连接入口与查询出口地址是否不同添加，脚本不人为补星。

常见城市/地区按已登记名称显示中文，未登记的地名及组织保持原文；不推断缺失地点。用户自行替换已确认的旧缓存后，截图已显示中文地点和完整 IP，证实先前返回值修复可用；此次紧凑布局尚未在 QX 界面验证。完整生成脚本的 VM/Apple JavaScriptCore 测试与原生界面实测分别记录。

渲染接口未传 baseUrl 时省略该片段；传入 baseUrl 只负责构造地址，不检查远端是否已发布。使用前需先推送对应脚本并确认直链存在。不声称未经确认的本地脚本文件名引用可用。IPinfo 的 HTTPS 查询可以由其他客户端适配器使用，不能直接当作 QX 内置 checker 的查询地址。

依据：[官方响应脚本示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-location-with-script.js)、[官方 HTTP 限制说明](https://github.com/crossutility/Quantumult-X/blob/master/sample-fetch-opts-policy.js)、[ipwho.is HTTP、中文字段与配额说明](https://ipwhois.io/documentation)、[IPinfo 新旧响应说明](https://ipinfo.io/developers)。

默认源选用 ipwho.is 是因为其 HTTP 接口提供中文省州/城市，以及独立 ASN、组织、时区字段；不代表其地理数据库一定优于其他服务。按当前官方文档，免费端点每个查询方 IP 每日 1000 次、没有 SLA；共享出口会共享配额，限流时脚本报告错误，不会擅自向其他服务重试。省州/城市/ASN 缺失时保持空值，不借用时区、运营商或节点名称猜位置。

已有配置在现有 `[general]` 下替换对应两行，不添加重复项。本项目不会自动改写本机配置：

```ini
geo_location_checker=http://ipwho.is/?lang=zh-CN, https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/scripts/geoip.js
resource_parser_url=https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/scripts/resource-parser.js
```

完整 GeoIP 行也保存在 [geoip.conf](../clients/quantumultX/fragments/geoip.conf)。

#### 为什么更新 main 后仍可能显示“运行中”

QX 1.8.0 build 946 的定位脚本从本地文件缓存读取，缓存键是完整脚本 URL 的 MD5；缓存非空时，定位流程不会先下载远端新版本。故障版曾丢弃外层返回值，修复后若继续使用相同裸 `main/.../geoip.js` 地址，已有配置仍可能执行旧内容。返回 `undefined` 时，QX 清空定位标签并露出 VPN 连接状态；“运行中”不代表定位脚本还在执行。自动更新另受全局间隔、触发时机及下载是否成功影响。

发布配置统一使用普通 `main/.../geoip.js`，不附加版本摘要、短版本号或时间戳；主配置和片段使用同一生成函数。QX 成功刷新脚本资源后可下载 main 的新代码，更新时不需要计算或更换参数。仓库推送不会强制清除本地旧缓存，是否自动刷新取决于 QX 的资源更新设置；已有长摘要地址可一次替换为上面的普通链接。

首次使用一个新 URL 时，QX 可能先触发脚本下载并显示连接状态，下载完成后才可在后续定位检查中执行。空缓存路径没有立即重试；本项目不通过脚本自行轮询、断开连接或切换节点来掩盖这个宿主行为。新地址也不保证查询源与脚本服务器始终可达。

上述缓存及标签路径来自只读静态分析，旧脚本失败由真实历史字节重放确认；用户提供的缓存摘要与该历史故障版一致，并在自行备份替换后提供了恢复定位的截图。本轮未读取或操作用户 QX。详细证据与限制见[验证记录](validation.md)。

原来的 ip-api 中文接口、ipwho.de 和 IPinfo legacy 响应仍支持。IPinfo Lite 的 country_code/asn/as_name 也可解析，但新版接口需要用户自己的令牌且通常使用 HTTPS；不把它直接配置成 QX 的内置 HTTP checker。

### Surge

产物：

- clients/surge/scripts/geoip.js
- clients/surge/modules/geoip.sgmodule

这是手动刷新的 generic 面板，查询 https://ipinfo.io/json。模块明确传入主配置已有策略名 节点选择，脚本通过 $httpClient 的 policy 选项仅为**这一次查询**选择该策略。它不修改策略组当前选择，不读取持久化偏好，也不证明其他域名或其他请求走同一路由。使用其他已有策略时修改模块里的 argument=节点选择；使用 standalone 的 Proxy 时需相应修改 argument。该策略不存在或尚未配置可用代理时，面板会报告查询错误。

公开构建用绝对脚本 URL。未设置 baseUrl 时，模块使用 ../scripts/geoip.js，相对位置按 **Surge 主配置文件目录** 解析。该本地模式要求保持生成树布局，以 clients/surge/profiles/default.conf 为主配置；不能只复制模块后假设脚本路径仍然正确。

脚本请求超时为 5 秒，6 秒看门狗确保返回一次结果，8 秒原生脚本上限留出完成余量。晚到的响应不会再次调用 $done。面板按官方文档最低要求 Surge iOS 4.9.3 / Mac 5.7.5；原生应用导入和设备运行尚未验证。

依据：[脚本 HTTP API 与一次完成约定](https://manual.nssurge.com/scripting/api.html)、[generic 脚本](https://manual.nssurge.com/scripting/generic.html)、[面板](https://manual.nssurge.com/tools/panel.html)。

## 可选搜索重定向

- QX：clients/quantumultX/rewrites/search-redirect.snippet，作为重写资源导入。
- Surge：clients/surge/rewrites/search-redirect.sgmodule，作为原生模块安装。

规则把 www.bing.com/search?q=... 返回 302 到 Google 搜索，保留编码后的 q 内容，丢弃后续参数。只处理 q 为第一个参数的形式；其他参数顺序、主机和路径不匹配。该功能不需要 JavaScript。

HTTPS 重写需要使用者已有并信任的 MITM CA，范围限于 www.bing.com；功能包不携带证书，也不启用全域名解密。Surge 模块通过 %APPEND% 增加 hostname，QX 资源使用官方重写资源的 hostname 语法。没有把同一重写内容在 modules/ 再复制一份。

依据：[QX 原生重写示例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)、[QX 远程资源示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-import-rewrite.snippet)、[Surge URL Rewrite](https://manual.nssurge.com/http/url-rewrite.html)、[Surge 模块追加语法](https://manual.nssurge.com/profile/module.html)。

## 验证边界

node --test tests/scripts/*.test.mjs 检查纯解析、真实原生适配器代码的 VM 契约、超时与晚响应、重定向正反例及资源路径。测试数据使用文档保留地址，不提交真实用户出口 IP。

VM 测试不等于原生客户端实测。metadata/features.json 分别记录测试方式和 nativeApp: not-run。Loon、Shadowrocket、Egern、Stash 未实现 GeoIP JS 宿主适配，但已提供下述原生规则或重写资源；Mihomo、sing-box 不输出假兼容 HTTP 重写。

Node 工具可直接导入 parseGeoResponse({statusCode, body}, {error})，得到结构化 state；diagnoseHttpResponse 只区分收到响应、超时和传输错误。联网采样应由显式工具调用执行，响应与真实 IP 不进入提交的测试 fixture。

## anti-AD 可选大规则集

直接来源是 [privacy-protection-tools/anti-AD](https://github.com/privacy-protection-tools/anti-AD)，固定提交及原文、许可和集合核验 SHA 均在 [来源清单](../metadata/upstreams.json)。严格解析源 DOMAIN-SET 的 `.` 前缀，与同提交 Clash 后缀集合双向一致，共 100,682 条。默认配置不内联、不启用此集合。

八客户端都提供 `rules/anti-ad.<原生扩展名>`，仅含匹配数据；QX 文件明确使用 reject。安装方式：

| 客户端 | 安装入口 | 操作 |
| --- | --- | --- |
| QX | fragments/anti-ad.conf | 合并到 [filter_remote]，使用 force-policy=reject |
| Surge | modules/anti-ad.sgmodule | 原生模块，RULE-SET 使用 REJECT |
| Loon | fragments/anti-ad.conf | 合并到主配置 [Remote Rule]；不伪称插件支持该节 |
| Shadowrocket | fragments/anti-ad.conf | 手工合并 [Rule]；不称厂商已验证独立模块 |
| Egern | modules/anti-ad.yaml | 原生 rule_set 模块；导入后检查规则合并次序 |
| Stash | modules/anti-ad.stoverride | 原生覆写，映射递归合并、rules 前插，不使用 replace |
| Mihomo | fragments/anti-ad.yaml | 合并 rule-providers，把规则前插到宽泛允许/最终规则之前 |
| sing-box | fragments/anti-ad.json | 合并 rule_set，并前插 action:reject；不替换现有 DNS/outbounds |

这些资源无 JavaScript、MITM、证书或持久化 API，启用后仅获取对应客户端的规则文件。Mihomo/sing-box 的下载策略显式使用 DIRECT，避免初始 Proxy=REJECT 导致下载失败；若网络需要代理下载，改为自己已配置的策略。远程 URL 必须已发布；也可在应用支持时使用本地规则文件。

六个图形应用仍需真实导入、确认合并次序与误拦截影响。该规则集的直接来源声明 MIT，原始许可和聚合来源 credits 均在 [vendor 目录](../src/vendor/anti-ad/README.md) 保留。

依据：[Surge RULE-SET](https://manual.nssurge.com/rules/ruleset.html)、[Loon 订阅规则](https://nsloon.app/docs/Rule/sub_rule/)、[Egern 模块](https://egernapp.com/docs/configuration/modules/)、[Stash 覆写](https://stash.wiki/configuration/override)、[Mihomo provider](https://wiki.metacubex.one/en/config/rule-providers/)、[sing-box rule-set](https://sing-box.sagernet.org/configuration/rule-set/)。

## HTTPS-upgrade

从 blackmatrix7 的固定 GPL-2.0 Redirect 原文只选择 6 个同主机 HTTP→HTTPS 规则：`www.jd.com`、`www.mi.com`、`suning.com`、`taobao.com`、`yhd.com`、`you.163.com`。保留完整路径与编码查询，不接受相似域名、显式端口、userinfo，不匹配已经是 HTTPS 的 URL。跨主机 aicoin 跳转、地区修改和 HTTP 降级均不进入成品。

QX/Surge/Loon/Egern/Stash 使用 `rewrites/https-upgrade.<原生扩展名>`；Loon 插件要求 3.5.1(978)+ 新 DSL。Shadowrocket 使用 [URL Rewrite] 手工合并片段。两种内核不输出不支持的 URL 重写文件。

该功能默认不启用，不需要 MITM、脚本、存储或后台请求；只有到达客户端 HTTP 引擎的 HTTP URL 才能被处理，不是 HSTS。302 可能改变非 GET 方法，不承诺请求体/方法保留。六站点 HTTPS HEAD 已完成证书验证，但不代表每个路径或原生截获行为已实测。

完整 [GPL-2.0 许可](../src/features/https-upgrade/LICENSE)、[原文](../src/features/https-upgrade/upstream/Redirect.conf.txt)、[修改说明](../src/features/https-upgrade/NOTICE.md)、[客户端依据及最低版本](../metadata/https-upgrade.json) 均保留。此功能和生成资源不是 MIT。

## 未直接引入的候选

DualSubs 的根许可虽为 Apache-2.0，固定 gitlink 仍含 GPL-3.0 组件，且一项 protobuf 对应源不可公开读取；不能据根 SPDX 将完整 bundle 认作 Apache-only。其偏好面板 API 还可跨模块读写持久化字段。本批没有导入这些 bundle/API。Sub-Store 涉及 AGPL-3.0、订阅存储与自动上传配置，需要独立的明确方案。老单文件也不拿聚合仓近期更新冒充文件新维护。

## 快速搜索与扩展跳转

quick-search 为原创六端原生资源，共47项：34站点搜索、9个Apple旧版storefront链接、3个翻译动作及普通查询Google兜底。支持q参数任意顺序、单字符/中文/多词与编码分隔；搜索词只放入固定HTTPS查询参数，避免表单加号跨到路径后改变含义。Apple指令只打开官方旧路由，不承诺改变账户国家。JD/淘宝使用HTTPS搜索入口。详见[src/features/quick-search/NOTICE.md](../src/features/quick-search/NOTICE.md)。

redirects 从既有固定GPL原文适配59项：严格匹配主机，保留HTTP升级与Google跳转的路径/查询，软件站跳转按原意进入对应官网。原来的两个HTTP降级目标已改为真实TLS验证的HTTPS地址；源码重复规则去重。biliintl-region独立提供两个菲律宾locale/SIM参数功能，实际序列化4条覆盖两种参数顺序，修正捕获组错误，保留其他编码参数。它们不会自动进入主配置或安装证书。

QX按重写资源导入；Surge使用sgmodule；Loon Rewrite v2要求3.5.1(978)+；Shadowrocket为手工合并片段；Egern是原生模块，Stash是覆写。MITM主机仅使用登记的精确集合：快速搜索duckduckgo.com，BiliIntl为两个API主机，一般跳转113个HTTPS主机别名。不要把协议、导入方式或不同包的许可混同。[完整GPL源与修改](../src/features/redirects/NOTICE.md)。

## BoxJS、ScriptHub、Sub-Store

六GUI各提供三个可选安装包，共18个，位于各自modules/。QX的snippet仍使用App的重写资源入口；Surge/SR用各自模块入口，Loon用插件，Egern用模块，Stash用覆写。ScriptHub在Loon使用Script v2，最低3.5.1(983)，不能与Rewrite v2的978要求混用。

BoxJS处理脚本设置与宿主存储；ScriptHub拉取、编辑和转换用户指定资源，部分动作可执行用户脚本；Sub-Store管理节点订阅并可在用户手动操作后同步。所有自动同步/cron已从安装包移除；没有捆绑CA或关闭TLS校验。导入才启用脚本和工具主机MITM。完整许可、官方原始安装包、修改后源码、上游版本、入口JS字节哈希与权限见[第三方集成](../src/vendor/integrations/)及[机器清单](../metadata/integrations.json)。

BoxJS/ScriptHub安装包为GPL-3.0-only，Sub-Store为AGPL-3.0-only。只固定直接执行的入口脚本；BoxJS的HTML/CDN、Vercel前端和ScriptHub另行生成资源的依赖不都在固定闭包内，不能称为全依赖锁定。入口真实GET、源标记与node --check通过，但未执行第三方代码、读写用户存储或触发Gist同步。六GUI仍未实机导入。

ScriptHub选择器只读取固定上游实际解析的唯一/_end_/之后的外层type；拒绝重复/编码别名、值后缀及嵌套分隔符，内嵌来源URL的type不再干扰。QX入口不承诺其他五端的所有edit/reload/convert能力。

Mihomo、sing-box核心不执行这些GUI的HTTP重写/JS模块；需要转换时可单独使用[官方Sub-Store服务](https://github.com/sub-store-org/Sub-Store)，再将原生provider/outbounds/完整配置接到相应核心。没有生成假兼容模块。

## 资源解析器与正文替换

QX现在使用本仓库独立实现的`scripts/resource-parser.js`，不再引用KOP-XIAO。已有配置把`fragments/resource-parser.conf`合并到`[general]`，替换已有`resource_parser_url`；它不是模块或重写订阅。本仓库QX配置已默认接入。解析器只处理QX交给它的资源文本，不下载订阅、不访问存储、不执行来源脚本、不改用户正在运行的QX配置。MIT原创代码与内联yaml 2.9.1的ISC许可均保留在生成脚本中。

| 资源 | 支持范围 | 严格边界 |
| --- | --- | --- |
| 节点订阅 | 原生QX行、受支持的SS/SSR/VMess/VLESS/Trojan/HTTP/SOCKS5/AnyTLS URI、Base64订阅、Surge/Loon节点、Clash YAML、sing-box JSON | 只转换已实现的TLS/WS/Reality等字段；未知协议、传输、mux、安全字段或冲突参数整份失败 |
| 分流 | QX/classical域名、IP CIDR v4/v6、GEOIP、ASN、UA、FINAL；Surge DOMAIN-SET；Clash payload；sing-box headless地址OR条件 | 未登记正则、端口、进程、逻辑AND、附加条件和未知选项整份失败；不悄悄丢规则 |
| 重写 | QX已实现原生动作；Surge/Loon 302/307；可等价Loon reject-200/img/dict/array；MITM主机；用户声明QX兼容的HTTP脚本引用 | 不导入CA、私钥、本地路径、cron或未知执行项；不同reject语义、无法保留的脚本字段与重写动作整份失败 |

SIP008 的 `version: 1 + servers` 中，服务器 UUID `id` 是更新标识，不是密码；解析器在该格式作用域校验并移除元数据后转换连接。VMess/VLESS 的 `id` 仍按协议凭据处理，其他格式不会随意忽略同名字段。既有不带 `id` 的服务器格式继续支持；未知连接字段或不支持版本仍整份失败。[官方 SIP008 规范](https://shadowsocks.org/doc/sip008.html)。

节点转换不把QX未支持的Hysteria2、TUIC、gRPC、XHTTP或HTTP/2映射成其他协议；证书 pin 和无法同时保留的WS Host/TLS SNI也会报错。旧VMess alterId大于0不转换。v2ray-plugin需要显式关闭 mux（字符串 `mux=0`，结构化 `mux: false`），SIP003 字符串中的 TLS flag 与 `false` 等矛盾值拒绝；Clash 结构化 `plugin-opts` 按字段类型直接处理，布尔 `tls: false` 保持关闭，path 中的分号和反斜杠保留字面值。Clash v2ray-plugin 缺省 Host 按 [Mihomo 1.19.33](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/adapter/outbound/shadowsocks.go#L333) 为 `bing.com`，与 SIP003 的默认值分别处理；Surge与Loon的VMess握手默认值也分别处理。源显式关闭证书验证时保留该选择，不擅自改变；冲突别名和重复JSON键整份拒绝。 Legacy 全文 Base64 SS 密码不重复百分号解码；sing-box `udp_over_tcp: true` 使用 QX `sp.v2`，对象省略 `enabled` 保持关闭。Clash VMess/VLESS WSS 按源实现使用 Host 作为缺省 SNI 并固定 HTTP/1.1，无法保留的 Host/SNI 组合报错；WS 同时带 Reality 的源组合也报错，避免把源传输未启用的 Reality 误启用。原生节点凭据与名称不被普通注释裁剪。

源节点的三个客户端偏好按 QX 原生方式自动处理，不增加模式开关：VLESS/Trojan/HTTP(S)/SOCKS/AnyTLS URI 的 `fp/spx`、VMess JSON 的 `fp`，以及 Clash 样式节点对象的 `client-fingerprint` 不写入 QX 连接字段。该对象格式也可位于裸数组、nodes 或旧式 servers 中；SS/SSR URI、显式 SIP008 v1 与 sing-box 仍严格校验，不套用这项处理。仅接受有界字符串（指纹偏好128字符、spx 2048字符），非字符串、控制字符及超长值报错。成功资源会带固定注释说明实际使用 QX 原生指纹、忽略 spx，不回显源值；这与旧 KOP 的常见订阅处理一致，不宣称保留 Chrome 指纹。QX Reality 的原生指纹见 [官方说明](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf#L162-L164)。

Reality 的 `support-x25519mlkem768=true` 与这三个偏好分别处理。[3x-ui 的公开生成器](https://github.com/MHSanaei/3x-ui/blob/1a5100ea166361cc2a01d8f245d616fb18baa0dd/internal/sub/service.go#L1243)会给 Reality URI 添加这个能力提示；当前 [QX 原生 Reality 指纹](https://github.com/crossutility/Quantumult-X/blob/master/ios26-safari-fingerprint.txt#L129)已包含对应 supported group 和 key share。转换器只在启用 Reality 的上述通用 URI、Clash VMess/VLESS 的 reality-opts 中接受正值（URI `true/1`，对象 `true/1/"true"/"1"`），交给原生握手兑现，不生成虚构的 QX 参数。需要使用实现该原生握手的 QX 版本；脚本不能给旧 SDK 增加密钥交换算法，也不保证最终协商选中该组。

`false/0`、空值、非标量、非 Reality、错放到顶层、原生 QX/sing-box/SIP008 的同名字段均拒绝；不忽略关闭能力的请求。`pqv` 等签名校验字段不是同一种提示，仍严格处理。资源增加一条固定原生能力说明，源值不回显。证书、pubkey/sid、UUID、flow、真实路径、ALPN/TFO不因该提示改变。

这三个偏好属于节点内容，不是订阅链接 `#` 后的新参数。真实 WS path、Reality 公钥/short-id、UUID、flow、地址和证书校验仍按原逻辑处理；Clash `fingerprint` 等证书 pin、sing-box utls、未知参数与不支持传输仍报错。原生 QX 行不新增 fp 字段。固定注释在整批校验和名称转换成功后添加，info/out/emoji 不被这些说明干扰。

链接哈希提供一套声明式选项：关键词使用下面的 OR/AND 规则，名称替换为字面操作，不支持 eval 或任意自定义解析脚本。示例以文档保留域名表示，请换成自己的资源URL：

```text
https://example.com/subscription#type=server&in=香港+日本&out=到期&prefix=自用-&sort=name
https://example.com/domains#type=filter&format=domain-set&domain-mode=exact
https://example.com/clash-domains.yaml#type=filter&format=clash&domain-mode=exact
https://example.com/rules#type=filter&policy=Proxy
```

`type`可选`auto/server/filter/rewrite`；只在类型明确时才使用自动识别。`format`仅对分流有效，可选`auto/classical/qx/domain-set/clash/sing-box`。`domain-mode=exact/suffix`选择纯DOMAIN-SET裸域名的匹配方式，默认exact；Surge `.domain`始终包含根域。Clash域名payload必须显式exact：其`.domain`只匹配子域，`+.domain`包含根域；单标签`*`不能无损变成QX跨点通配，直接报错。sing-box裸domain_suffix含根域，带前导点时只匹配子域；地址字段之间为OR，其他条件不得扁平化。

常用参数直接使用下表，不需要切换模式。QX 1.5.6 build 918+ 可用原生 helper 编辑，界面保存为规范选项。

| 参数 | 行为与示例 |
| --- | --- |
| `in/out` | 包含/排除关键词，大小写不敏感；`+` 表示任一项、`.` 表示同时包含。例如 `in=香港.IEPL+日本`。字面点写 `\.`，字面加号写 `%2B`。节点匹配名称；分流和重写匹配转换后的规则行。先校验整份来源，再筛选；不能用排除条件藏住无效规则。 |
| `inhn/outhn` | 仅重写资源的 MITM 主机筛选，语法同上；规则 `in/out` 不会隐式删除主机。 |
| `prefix/suffix` | 节点名称前后缀。 |
| `rename` | 顺序字面替换 `旧名@新名+旧名2@新名2`；`前缀@`、`@后缀` 添加前后缀，`词1.词2☠️` 删除这些词。编码 `%40/%2B` 保留字面 `@/+`；仍支持编码的 JSON 替换配对 `[["香港","HK"]]`。替换区分大小写，不执行正则或代码。 |
| `sort` | `none/name/name-desc`；`1/-1` 分别等于名称升序/降序。 |
| `type` | 规范值 `auto/server/filter/rewrite`；也接受 `nodes/list → server`、`rule → filter`、`module → rewrite`、`domain-set → filter + DOMAIN-SET exact`。显式类型优先于自动识别，冲突参数报错。 |
| `policy` | 显式覆盖全部源策略，输出注释提示；不等价的 Surge 内置策略默认拒绝，不能当作未声明策略组输出。 |

`GEOIP` 可保留 `PRIVATE/CLOUDFLARE` 等合法数据库类别，但实际匹配依赖用户所用 MMDB 中存在这些类别；不把无对应数据的库称为完整支持，`IP-ASN` 仍独立处理。本地路径或 `file:` 资源可在第一行写 `#out=套餐+重置`，路径自身的 `#` 参数优先；远程内容中的第一行注释不会启用参数。名称最多 512 字符、关键词最多 128 个子条件、改名最多 100 步；参数内保留字符需 URL 编码，未知、重复或无效值报错。

兼容这组既有订阅参数，无须修改订阅地址：`#info=1&out=套餐+重置&emoji=2`。`out` 排除名称含“套餐”或“重置”的节点；`info=1` 在成功转换后，根据原生 `$resource.info` 的已有用量发送一次本地通知，没有该信息时可从过滤前的流量/到期伪节点提取纯数字与有效日期。不输出订阅地址、凭据或任意标签文字；未提供数据就不伪造，通知 API 缺失/抛错不影响节点转换。`info=0` 或不设置均不通知。该选项不联网，不修改通知设置。

`emoji=1` 按节点名称添加地区旗，`emoji=2` 使用国行显示模式（台湾对应标记换为 🇨🇳），`emoji=-1` 删除地区旗，`emoji=0` 或不设置保持原样。名称转换之后再添加旗帜并检查重名；未知名称保留已有旗，没有既有旗才加 🏴‍☠️。地区名/城市名仅是名称修饰的有限词表，不能证明实际出口位置；不会影响 GeoIP 查询数据或 TLS 参数。此处参考 [KOP 参数行为](https://github.com/KOP-XIAO/QuantumultX/blob/master/Scripts/resource-parser.js)，实现为原创，不复制其脚本。已实现上表中的常用写法；未实现 `reg/regout`、`sfilter/srename`、任意执行脚本以及 UDP/TFO/证书等连接覆盖参数，未知参数仍明确报错，不宣称完整替换 KOP 的所有功能。

有两个选项会改变转换前提，默认均不启用：`allow-resolve=1`明确允许移除源`no-resolve`，可能增加DNS查询，输出会警告行为变化；`script-compat=qx`只是使用者声明所引用的Surge/Loon脚本本体已经支持QX，不翻译JavaScript API，不忽略timeout、argument、binary-body或max-size等无法保留的设置。QX原生HTTPS脚本引用可以保留，解析器不下载或执行脚本；之后QX运行该重写脚本是另一项操作。跨宿主`reject`不能仅因名称相同就等同于QX的HTTP 404。 影响执行条件的 `#!include/requirement/system` 与平台限定指令，在节点、分流、重写中整份拒绝，不作为普通注释丢弃；Surge 普通行内注释按引号边界处理。URL 正则可以不以 `^` 开头，也可用 `[hH]` 开头，明确的 `type` 仍优先。

QX 资源宿主使用 identity `$done` 并消费整段脚本的最终求值；生成脚本必须返回同一 `{content}` 或 `{error}` 对象。回归同时检查回调次数与最终对象，并覆盖 helper 单独加载。字段拒绝会标出来源格式和已登记的公共字段名，例如 `unsupported field in sing-box TLS: utls`；未知字段名与所有字段值不回显，避免泄露凭据。任何一行失败都只返回一次错误，不发布前半份结果；更新失败后的缓存和提示由QX处理，本实现不承诺宿主保留旧内容。资源限额为输入/输出各2 Mi字符、2000节点或20000规则/重写行；YAML最大32层、100000个值节点与20个alias，并拒绝循环、重复键和自定义tag。VM测试执行实际生成bundle与helper协议，尚未在原生QX导入运行。详细接口、来源和边界见[解析器登记](../metadata/resource-parsers.json)、[功能规格](specs/features.md)。

Loon仍链接固定AGPL Sub-Store解析器，`fragments/resource-parser.conf`合并到`[General]`，并在选定的`[Remote Proxy]`订阅上设置`parser-enabled=true`。它是外部工具入口，可能重新获取资源并按宿主权限访问缓存；本仓库没有把它替换成QX实现或宣称离线隔离。来源、哈希与对应完整AGPL源码均保留。其他六客户端没有虚构的同名解析器字段。

Surge的scripts/replace-body.js为原创文本请求/响应正文替换工具；片段中的例子全部注释，需使用者指定自己的窄URL与规则。支持旧式pattern->replacement、/pattern/flags及百分号编码JSON规则；先编译完整配方，任何错误或不支持输入都一次性原样放行，不输出正文、联网或修改headers。需要requires-body=true与明确max-size；HTTPS仅在使用者已有可信CA及对应主机启用MITM时可用。[Surge请求契约](https://manual.nssurge.com/scripting/http-request.html)、[响应契约](https://manual.nssurge.com/scripting/http-response.html)。

## QX 正则缺口的可选兼容处理

见[可直接复制的接入步骤](qx-compatibility.md)：ChatGPT/ViuTV关联CDN的两个原生分流补充，以及Speedtest HTTP和单独HTTPS重写。它们与严格源正则资源分开，默认关闭；扩大范围、排序/优化和MITM前提均逐项说明，不计为14/24之外的无损恢复。
