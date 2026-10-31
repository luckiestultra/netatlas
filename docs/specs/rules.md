# 规则数据规格

状态：已批准；本文按当前接口整理。实际来源见 [来源审计](../upstream-audit.md)，验证证据见 [验证记录](../validation.md)。

## 契约

规范规则只描述匹配事实，格式为 version、id、category、entries。每项 entry 只有 type 与 value，类型限定为 domain、domain-suffix、ip-cidr、ip-cidr6。

~~~json
{"version":1,"id":"openai","category":"ai","entries":[{"type":"domain-suffix","value":"openai.com"}]}
~~~

id 是跨客户端稳定的具体应用或服务名。category 只整理源文件，不表示策略、优先级、国内外属性或默认出站。公开规则路径是 clients/<client>/rules/<id>.<原生扩展名>，不保留 category 层。

src/rules/<category>/<id>.json 是唯一规范输入；metadata/upstreams.json 登记来源、作者、许可、固定提交、原始文件校验值、输出字节校验值和逐条审查的排除项。策略与规则集顺序属于 metadata/routing.json，不写进规则数据。

## 已接入数据

当前固定规范目录为 41 个规则集、124,158 条规则；默认配置使用 40 组、23,476 条，另有可选 AntiAD 100,682 条。默认目录原有 15 组保留，新增 apple-tvplus, cursor, discord, docker, github-copilot, gitlab, groq, hbo, huggingface, jetbrains, line, npmjs, perplexity, poe, signal, slack, steam, tiktok, twitch, vercel, whatsapp, xai, zoom，覆盖通信、开发、AI、媒体与游戏服务。以后更新以清单统计为准。

其中三十六组从 MIT 许可的 v2fly/domain-list-community 固定提交选取指定文件及显式 include；lan、china 是本项目自有的有限事实列表；可选 AntiAD 从独立 MIT 来源的原生 DOMAIN-SET 固定快照导入。此目录是可移植投影，不是完整 DLC/geosite 数据库；不做全仓库 affiliation 反向聚合。当前九次不可移植正则排除逐条登记，不近似改写成更宽的后缀，任何新增且未登记的正则或关键词表达式都会阻止同步。

新增 23 组均可用精确域名或域名后缀无损表达，没有新增正则排除。Apple TV+、GitHub Copilot 和 npm 等具体服务必须在 Apple、GitHub 父集合之前匹配；该顺序独立于分类标签，Apple 默认 DIRECT 保持不变。

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
