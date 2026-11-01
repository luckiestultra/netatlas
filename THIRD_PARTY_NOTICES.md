# 第三方声明与规则来源

本仓库包含多种许可。原创通用代码采用根目录 MIT 许可；HTTPS-upgrade 功能代码及其生成资源采用 GPL-2.0-only，不以根 MIT 许可替代。各组件与产物的许可见对应来源、文件头和清单。

## anti-AD

- 项目：[privacy-protection-tools/anti-AD](https://github.com/privacy-protection-tools/anti-AD)
- 固定版本：`cafc2bfb031a9e5ee4461721afc65b82430f2c15`。
- 使用 `anti-ad-surge2.txt` 的 100,682 个明确域名后缀，严格解析每行的 `.` 前缀；与同提交 Clash 规则的后缀集合双向一致。
- 这是可选规则集，不内联默认主配置；完整源 SHA-256、许可 SHA-256、匹配类型、原始来源与核验依据登记在 `metadata/upstreams.json`。
- 原始 [MIT 许可](src/vendor/anti-ad/LICENSE) 和 [README/credits](src/vendor/anti-ad/README.md) 原样保留，包括其聚合来源说明。本项目按直接来源的许可声明记录，不声称所有被聚合项目均采用 MIT。

## HTTPS-upgrade

- 来源：[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)，固定 `0b6897dc17e0c513d25449c935a9694818e32f0c`。
- 仅选择 6 个同主机的 HTTP→HTTPS 规则，并增加严格主机、路径和查询保留；其他跳转、地区替换、HTTP 降级和 MITM 配置不进入生成资源。
- 完整 [GPL-2.0 许可](src/features/https-upgrade/LICENSE)、[原文](src/features/https-upgrade/upstream/Redirect.conf.txt)、[修改说明](src/features/https-upgrade/NOTICE.md) 与 [来源元数据](metadata/https-upgrade.json) 均保留。适配器、数据和相关生成资源均标明 GPL-2.0-only，不应标为 MIT。
- 仓库维护时间与规则文件头更新时间分别记录；不拿仓库近期提交冒充所有规则刚刚更新。

## Domain list community

- 项目：[v2fly/domain-list-community](https://github.com/v2fly/domain-list-community)
- 固定版本：`1daade8c4bb957d21d1f5c09c2b050d699e8e96c`（2026-10-30）
- 许可：[MIT License](https://github.com/v2fly/domain-list-community/blob/1daade8c4bb957d21d1f5c09c2b050d699e8e96c/LICENSE)
- LICENSE 文件 SHA-256：`b9d84a22870d3f21c91a4c6e410c9cc51d00902f5233ad0c84011479244bf7d2`
- 使用范围：`metadata/upstreams.json` 登记的具体域名列表及其显式 `include:`；没有执行上游代码。

每个规则集的清单记录来源文件 URL、文件字节 SHA-256、固定提交、作者、许可、生成 JSON 文件字节 SHA-256、规则数量和已应用排除项。`updatedAt` 使用上游固定提交时间；本项目自有事实列表使用明确登记的整理日期。重复同步不会写入当前时钟产生的时间戳。保留以下完整许可声明：

```text
MIT License

Copyright (c) 2018-2019 V2Ray

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 可移植规则的范围

这份目录是上游数据的**可移植投影**，不是完整 DLC/geosite 编译产物：

- `domain:` 和裸域名转换为域名后缀；`full:` 转换为精确域名。
- 显式包含会递归展开，`@属性` 和 `@-属性` 的包含过滤遵循上游说明。
- 不执行全仓库的 `&目标列表` 反向聚合；只使用登记文件及显式包含的内容。
- 八种客户端不能无损共享任意 Go 正则。已审查的个别表达式只能通过清单中“文件 + 确切表达式 + 原因”的显式排除处理，原文、行号、原因和数量都保留在 `appliedExclusions`。不把正则近似放大成后缀。
- **任何新增、没有登记的正则或关键词表达式会阻止该批同步。** 不静默跳过，也不会发布半批新数据。
- 排除的动态主机名可能需要其他规则或最终策略处理；本项目公共五类型文件不声称覆盖被排除表达式原本匹配的全部范围；各端原生补充见 metadata/regex-routing.json。

## 本项目自有事实列表

- `lan`：根据 RFC 1918、4193、4291、6598、6762、8375 和 IANA 地址登记选择常见本地、私有及特殊目的地址。不是完整 IANA 特殊用途表。
- 这些列表采用本项目 MIT 许可，其参考链接在来源清单中逐项登记。

## 同步与恢复

```sh
npm run sync -- --dry-run             # 核对当前固定版本，不改源文件
npm run sync                         # 重建当前固定版本
npm run sync -- --latest --dry-run    # 检查上游分支最新提交，但不发布
npm run sync -- --repository <来源ID> --revision <完整SHA>  # 经审查后只切换所选来源
```

下载限制包括 15 秒请求超时、普通单文件 1 MB；anti-AD 登记上限为 3 MB，硬上限为 4 MB。总计 24 MB、最多1024个全局下载文件、每个DLC闭包512文件和20层包含；禁止包含循环。同步先验证所有输入，再发布规则目录和来源清单；网络失败、许可变化或新不可移植表达式会保留旧数据。已有托管规则若被手工修改，校验值不符会阻止覆盖；下载期间发生的本地改动也会在发布前再次核对。

本地上一个目录和中断记录保存在被 Git 忽略的 `.cache/sync/` 中，不自动删除。若目录交换期间进程被强制终止，下一次普通同步会先恢复上一批；`--dry-run` 只报告待恢复状态，不修改它。

## 完整配置对照与新增 CN 网络数据

完整节点、订阅、DNS 与策略适配参考原生官方文档，并与 Repcz/Tool、Orz-3/QuantumultX、LOWERTOP/Shadowrocket 和 Aethersailor/Custom_OpenClash_Rules 的固定完整配置交叉核对。仓库星标、配置文件更新时间、固定版本和使用方式见 metadata/profile-references.json。没有复制无许可证仓库的规则、脚本、证书或源代码；API 字段做独立适配。Repcz 的 MIT 原许可保存在 src/vendor/profile-references/Repcz-LICENSE。

CN 域名来自已有 MIT 固定 DLC 的 cn 完整 include 闭包，保留3条逐字登记的不可移植正则例外；不冒称与原生 GeoSite 完全等价。CN IPv4/IPv6 来自 gaoyifan/china-operator-ip 的 ip-lists 分支固定 f7533065e164cbe0cf24b488a77ca75b8e897923，MIT Copyright 2017 Yifan Gao。完整许可、固定说明及关联文档在 src/vendor/china-operator-ip/；来源、SHA 与网络分类边界在 metadata/upstreams.json。数据用于路由分类，不作为服务器物理地点结论。

## 扩展 Redirect 与规则数据

扩展Redirect及BiliIntl从同一固定GPL-2.0原文适配，保留[完整源码、许可与修改](src/features/redirects/NOTICE.md)。另外七套规则数据从blackmatrix7固定许可来源导入，完整原始YAML、GPL与字节/Git哈希位于[src/vendor/rule-sources/blackmatrix7](src/vendor/rule-sources/blackmatrix7)。每套规则许可由metadata/upstreams.json及生成manifest的sources.rules[].license登记；含这些规则数据的成品不能整体标为MIT。global选用Proxy_Classical的完整五类型数据，未声称等于其他Global集合。

## 外部脚本工具

[Loon参数回归夹具](tests/scripts/integrations-loon-argument.test.mjs)包含三个固定ScriptHub源文件的短初始化摘录，该文件以GPL-3.0-only标注，并保留完整源码URL、行号与SHA-256；不以根MIT许可替代。

BoxJS和ScriptHub的安装包采用GPL-3.0-only，Sub-Store采用AGPL-3.0-only；完整许可证、作者、官方原包、改版包与对应源码入口见[src/vendor/integrations](src/vendor/integrations)。本仓库发布小安装资源，入口脚本仍从上游获取，没有将大型bundle重新分发或改标MIT。Sub-Store的发布bundle提交与对应源码tag分开登记，不把当前README提交当成其构建来源。前端/CDN及生成资源的全部依赖闭包未宣称锁定。

QX资源解析器由NetAtlas依据原生公开接口独立实现，转换器和宿主适配采用本项目MIT许可，没有复制KOP-XIAO解析器源码。浏览器成品内联yaml 2.9.1（ISC，Copyright Eemeli Aro），完整许可保存在[src/features/resource-parser/vendor/LICENSE-yaml](src/features/resource-parser/vendor/LICENSE-yaml)，也写入生成脚本头部；构建依赖和版本在package-lock.json锁定。URL、协议字段和官方helper协议的独立适配不表示第三方项目为本实现背书。

Loon解析器仍链接固定官方AGPL发布入口及对应完整源码，不复制或重新标注其bundle许可。原创quick-search和正文替换采用MIT。边界、原生宿主契约及Loon哈希见[解析器登记](metadata/resource-parsers.json)、[工具登记](metadata/integrations.json)。

GeoIP中文国家/地区名称取自Unicode CLDR 48，固定提交`acd6d88ae493633240e19a87a721076a8a75c310`的`common/main/zh.xml`，Copyright © 1991–2025 Unicode, Inc.，采用Unicode-3.0许可。完整[许可](src/features/geoip/localization/LICENSE-Unicode)、[来源与投影说明](src/features/geoip/localization/NOTICE.md)保留在本仓库。这些名称只翻译查询源返回的国家代码，不包含IP定位数据库，也不据此推测节点物理位置。

## 原生 ASN、GeoIP、正则和 Unbreak

`china-asn`保留missuo/ASN-China的完整5,231个编号，MIT Copyright (c) 2022 Vincent Young；固定提交、原文、Git blob、许可及SHA见[原始归档](src/vendor/rule-sources/missuo/)和[原生条件登记](metadata/native-routing.json)。没有根据ASN归属推断物理国家，也不把CN CIDR转换结果称作ASN匹配。

GeoIP与ASN数据库由各客户端自身下载和更新，本仓库没有重新分发数据库。Loon/Egern/Mihomo字段指向P3TERX发布的GeoLite2 MMDB；更新URL有意可变，不是固定规则来源，也不在可复现数据统计中。遵守数据库提供者的原始许可；国家数据库内容会随刷新而变。

24个正则引用的8份原始DLC文件和MIT许可位于[src/vendor/rule-sources/domain-list-community/regex](src/vendor/rule-sources/domain-list-community/regex)，逐行SHA与转换证明见[正则登记](metadata/regex-routing.json)。原生正则/有限通配保留原始语言，不沿用未许可参考仓库负载。

完整Unbreak的48个条件来自已固定GPL Direct.yaml；另外2个精确端点由本项目依据Android/Chromium官方端点事实独立编写（MIT），见[src/supplements/unbreak.json](src/supplements/unbreak.json)。合并集合按GPL-2.0-only分发，完整源文和修改声明已保留。三个原有连接探测域仍是独立MIT列表，不冒充50条原始集合。

## QX 可选兼容补充

QX兼容分流与HTTP/HTTPS重写是本项目MIT适配，依据已归档的同一MIT DLC正则表达式和QX公开语法独立实现。扩大范围的通配与仅HTTP(S)的重写不计为源域名正则完整恢复；源表达式及额外匹配例子在metadata/qx-compat.json登记。没有复制第三方未许可配置、脚本或证书，也未重新分发CA或私有数据。

## YouTube Enhance QX adaptation

Pinned Maasea YouTube bundles, the original module and the minimal QX adaptation retain Apache-2.0, embedded protobuf-ts Apache/BSD-3-Clause and AnonyCo text polyfill CC0-1.0 terms. Complete source, licenses, hashes, authors and changes are in [the feature notice](src/features/youtube-enhance/NOTICE.md) and [provenance](src/features/youtube-enhance/provenance.json). The exact protobuf npm/build dependency closure was not recovered. No code from unmerged PR #105 is used.

The primary optional resource does not intercept initplayback or redirect QX to a third-party Worker. A separate Worker resource is disabled by default and explicitly exposes runtime onesie clientKey and the original playback target URL to the upstream Worker; it is not required by the primary resource and is not limited to advertisements. Neither resource is automatically enabled in public profiles. Node VM/JavaScriptCore tests use synthetic fixtures; native QX playback, PIP, background play, ad removal and subtitle behavior remain not-run.
