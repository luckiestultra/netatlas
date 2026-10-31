# 功能包

分流规则在各客户端的 rules/，纯重写资源在 rewrites/，JavaScript 在 scripts/。modules/ 只放原生功能安装包；fragments/ 保存需要手工合并的配置片段。QX 主配置已接入 GeoIP 显示；其他可选功能不自动启用。

行为契约见[功能规格](specs/features.md)，整体范围见[能力表](capabilities.md)，当前执行证据见[验证记录](validation.md)。

## GeoIP

共享核心是 src/features/geoip/core.mjs，只解析数据，不发请求、不读取客户端存储。支持 IPinfo、ipwho.de 和 ip-api 三种响应结构；兼容 ip-api 不代表推荐其定位结果。核心保留 API 实际返回的国家与城市，不用节点名称推测位置，也不会填入虚构城市或服务商。

空 ASN、缺失字段、无地理数据、无效 JSON、HTTP 错误、限流和传输超时分别处理。HTTP 403 不自动视为限流；收到一个 HTTP 响应也不被包装为“所有网络正常”。数据库定位不是物理机房证明。

### Quantumult X

产物：

- clients/quantumultX/scripts/geoip.js
- clients/quantumultX/fragments/geoip.conf：只有设置了公开构建 baseUrl 才生成。

主配置 default.conf 已包含该 checker；其他既有配置可使用 geoip.conf 合并到 [general]。该片段**不是重写订阅，也不是完整配置**。它使用 http://ipwho.de/json，并引用本仓库生成的公开脚本地址。内置 geo_location_checker 仅支持 HTTP 查询源；脚本接收原生 $response，只调用一次 $done，不会再发请求或更改节点。

渲染接口未传 baseUrl 时省略该片段；传入 baseUrl 只负责构造地址，不检查远端是否已发布。使用前需先推送对应脚本并确认直链存在。不声称未经确认的本地脚本文件名引用可用。IPinfo 的 HTTPS 查询可以由其他客户端适配器使用，不能直接当作 QX 内置 checker 的查询地址。

依据：[官方响应脚本示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-location-with-script.js)、[官方 HTTP 限制说明](https://github.com/crossutility/Quantumult-X/blob/master/sample-fetch-opts-policy.js)、[ipwho.de API](https://ipwho.de/)。

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
