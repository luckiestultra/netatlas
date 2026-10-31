# 规则数据规格

状态：已批准；本文按当前接口整理。实际来源见 [来源审计](../upstream-audit.md)，验证证据见 [验证记录](../validation.md)。

## 契约

规范规则只描述匹配事实，格式为 version、id、category、entries。每项 entry 只有 type 与 value，类型限定为 domain、domain-suffix、domain-keyword、ip-cidr、ip-cidr6。

~~~json
{"version":1,"id":"openai","category":"ai","entries":[{"type":"domain-suffix","value":"openai.com"}]}
~~~

id 是跨客户端稳定的具体应用或服务名。category 只整理源文件，不表示策略、优先级、国内外属性或默认出站。公开规则路径是 clients/<client>/rules/<id>.<原生扩展名>，不保留 category 层。

src/rules/<category>/<id>.json 是唯一规范输入；metadata/upstreams.json 登记来源、作者、许可、固定提交、原始文件校验值、输出字节校验值和逐条审查的排除项。策略与规则集顺序属于 metadata/routing.json，不写进规则数据。

## 已接入数据

当前公共规范目录为118个规则集、136,944条；默认115组、29,153条，另有可选anti-AD、global、google-cn。确切来源和逐条件排除见metadata/upstreams.json；不把未纳入公共模型的条件静默丢弃，原生补充层另见本文后节。

数据来自固定 MIT DLC、MIT反广告与国家网段，以及固定 GPL-2.0-only 服务数据；自有LAN、连接探测和经审计的精确端点补充采用MIT。具体服务在企业/媒体父集合之前，业务策略不从category猜测。Unbreak保留全部50条件及混合来源原始许可，原有三个连接探测另成集合。

可选 AntiAD 使用显式 domain-lines 格式、点前缀和 domain-suffix 匹配，不能把无前缀文本自动猜成精确域名或后缀。输入与同版本 Clash 后缀根域集合已双向核对一致；该大集只输出独立规则，不进入默认主配置。格式、传输预算和匹配依据均登记，详见[来源审计](../upstream-audit.md)。

许可原文与范围见 [第三方声明](../../THIRD_PARTY_NOTICES.md)。

## 同步与失败行为

~~~sh
npm run sync -- --dry-run
npm run sync
npm run sync -- --latest --dry-run
npm run sync -- --repository domain-list-community --revision <完整提交SHA>
npm run sync -- --repository anti-ad --latest --dry-run
npm run validate -- --rules
npm run test:rules
~~~

多上游时，--revision 必须配合 --repository <登记ID>，否则在任何下载或恢复写入前拒绝；单上游保留省略 selector 的用法。--latest 不选 ID 时移动全部来源，选择 ID 时只移动该来源。selector 限定的是版本、日期与产物变更范围，不缩小校验下载范围：整个目录仍被重新校验，未选来源保持原样，异常漂移会阻止整批替换。

同步只获取已登记 HTTPS 数据端点，不执行上游脚本。固定提交、许可文件、包含边界、规则语法和本地已有内容校验值都通过后才交换规范目录与来源清单。失败保留上一批，待恢复目录与日志保存在被忽略的 .cache/sync/；dry-run 只检查，不修复或写入。

手工修改托管规则会导致校验值不符并阻止覆盖。扩展规则应修改来源登记并完成审查，而不是编辑生成的 clients/ 文件。

## 验收

- 后缀包含根域名和真实子域名，不匹配 lookalike 域名；精确域名不匹配子域名。
- IPv4、IPv6 网段规范化保持首末地址和边界语义；域名支持明确的 Unicode/IDN 规范化。
- 无效输入和不支持类型给出来源位置；不静默丢项。
- 所有八种目标用相同正反例检查转换前后语义。
- 相同固定输入重复同步产生相同字节，不添加当前时钟形成无意义变更。
- 个人节点、订阅、令牌、证书和真实出口响应不属于规则源。

## 关键词与许可来源补充

规则模型包含domain-keyword，语义是ASCII大小写归一后的域名子串匹配，不能改写成domain-suffix。分别导出QX host-keyword、classical DOMAIN-KEYWORD、Egern domain_keyword_set和sing-box domain_keyword；格式与实际内核案例独立验证。不把不支持的regex、进程、USER-AGENT、ASN静默塞入该模型。

classical-yaml为明确登记的原始五类型来源，未知条件/额外动作字段/非canonical CIDR/重复YAML键均拒绝。selectPayload只选精确原始token，缺失就阻止同步，不扩展为企业全站。完整原始GPL数据、LICENSE和SHA/Git blob归档于src/vendor/rule-sources/blackmatrix7；MIT/GPL逐规则登记。默认不加载可选global代理替代集，它不是Geolocation或原Global逐条复刻。

## 原生条件补齐契约

本轮补齐 ASN、GeoIP、源正则和完整 Unbreak；公共五类型模型不承载宿主无法表达的条件。ASN 保留编号与宿主数据库查询，GeoIP 保留国家代码与宿主数据库查询；不能用国家 CIDR 资源冒充二者。原生条件按客户端另生成 `rules/china-asn.*`、`rules/geoip-cn.*` 和 `rules/<来源ID>-regex.*`，主配置与 standalone 均实际接入支持的条件。ASN/GeoIP 位于业务域名之后、静态 CN CIDR 兜底之前；正则与所属服务使用相同策略和优先级。

正则以固定上游表达式为准，支持原生域名正则的宿主保留等价表达式；只有具有精确语言等价证明时才转换成有限通配模式。不能把域名匹配改成 URL 匹配，不能将不支持的表达式扩大成后缀。逐客户端记录完整、部分与不支持，不把未提供条件的客户端标成完整。

Unbreak 以参考的全部精确条件核对，来源必须可追溯且许可兼容；保留原有网络探测规则为独立资源。白名单在广告拦截之前生效，这一影响须在文档及真实路由测试中说明。检查包括来源集合双向比较、逐客户端序列化正反例、缺项/篡改拒绝、可运行内核的真实流量和数据库条件测试。六 GUI 未实机验证的边界照实保留；不更改本机 QX 或系统代理。
