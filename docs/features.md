# 功能包

分流规则在各客户端的 rules/，纯重写资源在 rewrites/，JavaScript 在 scripts/。modules/ 只放组合功能安装包或明确标注的配置片段。完整基础配置不自动启用这里的可选功能。

行为契约见[功能规格](specs/features.md)，整体范围见[能力表](capabilities.md)，当前执行证据见[验证记录](validation.md)。

## GeoIP

共享核心是 src/features/geoip/core.mjs，只解析数据，不发请求、不读取客户端存储。支持 IPinfo、ipwho.de 和 ip-api 三种响应结构；兼容 ip-api 不代表推荐其定位结果。核心保留 API 实际返回的国家与城市，不用节点名称推测位置，也不会填入虚构城市或服务商。

空 ASN、缺失字段、无地理数据、无效 JSON、HTTP 错误、限流和传输超时分别处理。HTTP 403 不自动视为限流；收到一个 HTTP 响应也不被包装为“所有网络正常”。数据库定位不是物理机房证明。

### Quantumult X

产物：

- clients/quantumultX/scripts/geoip.js
- clients/quantumultX/modules/geoip.conf：只有设置了公开构建 baseUrl 才生成。

geoip.conf 是需要合并到已有 [general] 的配置片段，**不是重写订阅，也不是完整配置**。它使用 http://ipwho.de/json，并引用本仓库生成的公开脚本地址。内置 geo_location_checker 仅支持 HTTP 查询源；脚本接收原生 $response，只调用一次 $done，不会再发请求或更改节点。

渲染接口未传 baseUrl 时省略该片段；传入 baseUrl 只负责构造地址，不检查远端是否已发布。使用前需先推送对应脚本并确认直链存在。不声称未经确认的本地脚本文件名引用可用。IPinfo 的 HTTPS 查询可以由其他客户端适配器使用，不能直接当作 QX 内置 checker 的查询地址。

依据：[官方响应脚本示例](https://github.com/crossutility/Quantumult-X/blob/master/sample-location-with-script.js)、[官方 HTTP 限制说明](https://github.com/crossutility/Quantumult-X/blob/master/sample-fetch-opts-policy.js)、[ipwho.de API](https://ipwho.de/)。

### Surge

产物：

- clients/surge/scripts/geoip.js
- clients/surge/modules/geoip.sgmodule

这是手动刷新的 generic 面板，查询 https://ipinfo.io/json。模块明确传入已有策略名 Proxy，脚本通过 $httpClient 的 policy 选项仅为**这一次查询**选择该策略。它不修改策略组当前选择，不读取持久化偏好，也不证明其他域名或其他请求走同一路由。使用其他已有策略时修改模块里的 argument=Proxy；该策略不存在或尚未配置可用代理时，面板会报告查询错误。

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

VM 测试不等于原生客户端实测。metadata/features.json 分别记录测试方式和 nativeApp: not-run。Loon、Shadowrocket、Egern、Stash、Mihomo、sing-box 目前只由仓库其他部分提供其已实现的配置与分流产物；这些可选功能不向它们输出占位文件或假兼容脚本。

Node 工具可直接导入 parseGeoResponse({statusCode, body}, {error})，得到结构化 state；diagnoseHttpResponse 只区分收到响应、超时和传输错误。联网采样应由显式工具调用执行，响应与真实 IP 不进入提交的测试 fixture。
