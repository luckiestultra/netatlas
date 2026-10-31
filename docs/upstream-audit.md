# 规则来源审计

本文件记录实际进入构建的来源和复用范围。机器可读的固定提交、校验值、来源文件及精确排除项以 [upstreams.json](../metadata/upstreams.json) 为准，许可原文保存在[第三方声明](../THIRD_PARTY_NOTICES.md)。

## 当前数据快照

核对日期：2026-10-31，Asia/Shanghai。

| 来源 | 固定版本与许可 | 使用范围 |
|---|---|---|
| [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community) | 1daade8c4bb957d21d1f5c09c2b050d699e8e96c，2026-10-30，MIT | 三十六组登记列表及显式 include 的可移植投影 |
| 本项目 lan | 2026-10-31，MIT | 从登记的 RFC/IANA 来源选择常见本地与特殊地址事实，非完整登记表 |
| 本项目 china | 2026-10-31，MIT | 常用中国服务域名便利集，非完整地理域名/IP 数据库 |
| [privacy-protection-tools/anti-AD](https://github.com/privacy-protection-tools/anti-AD) | cafc2bfb031a9e5ee4461721afc65b82430f2c15，2026-10-30，MIT | 可选原生 DOMAIN-SET 的完整后缀规则；默认主配置不包含 |

规范目录共 41 组、124,158 条规则；默认配置使用其中 40 组、23,476 条，另有可选 AntiAD 100,682 条。DLC 的许可文件 URL 与 SHA-256 已登记，作者署名和完整许可继续保留，不用本项目许可覆盖第三方原有权利。

| 规则集 | 条数 | 已审查的不可移植表达式排除 |
|---|---:|---:|
| openai | 24 | 1 |
| claude | 19 | 0 |
| gemini | 49 | 0 |
| google | 1,123 | 2 |
| microsoft | 760 | 0 |
| apple | 1,826 | 0 |
| github | 65 | 0 |
| telegram | 21 | 0 |
| youtube | 178 | 0 |
| netflix | 24 | 4 |
| spotify | 28 | 0 |
| speedtest | 20 | 1 |
| adblock | 904 | 1 |
| lan | 17 | 0 |
| china | 19 | 0 |
| anti-ad（可选） | 100,682 | 0 |
| apple-tvplus | 8 | 0 |
| cursor | 5 | 0 |
| discord | 28 | 0 |
| docker | 6 | 0 |
| github-copilot | 6 | 0 |
| gitlab | 5 | 0 |
| groq | 1 | 0 |
| hbo | 65 | 0 |
| huggingface | 3 | 0 |
| jetbrains | 25 | 0 |
| line | 20 | 0 |
| npmjs | 3 | 0 |
| perplexity | 5 | 0 |
| poe | 2 | 0 |
| signal | 8 | 0 |
| slack | 11 | 0 |
| steam | 61 | 0 |
| tiktok | 40 | 0 |
| twitch | 35 | 0 |
| vercel | 27 | 0 |
| whatsapp | 11 | 0 |
| xai | 4 | 0 |
| zoom | 3 | 0 |

早期服务扩展的 23 组共享同一个固定 MIT 上游提交，不引入额外表达式排除。逐组实际收集确认，共新增 382 条规范规则；DLC 源文件联合去重为 232 个数据文件，加许可文件为 233 次固定版下载。再加独立 AntiAD 数据及许可后，共 235 次固定版下载，当时低于512文件上限；本轮完整CN闭包及IP数据后合计519文件，现有全局上限1024、每个DLC闭包仍512。

## 转换范围

依据[上游数据格式](https://github.com/v2fly/domain-list-community#structure-of-data)，裸域名和 domain: 转换为后缀，full: 转换为精确域名；显式 include 递归展开并处理属性筛选。本仓库没有执行全仓库 affiliation 反向聚合，也不声称生成完整 geosite 数据库。

当前九次正则排除涉及无法在首版四种规则类型间无损表达的条目，均以“来源文件、确切表达式、原因”逐条登记，并保留源行号和原文。同一表达式可在不同规则集各登记一次。它们没有被近似放大为后缀。任何新增、未经登记的正则或关键词表达式会阻止整批更新。

这些排除范围仍可能由其他规则或最终策略处理，但规则集不承诺覆盖原表达式的全部匹配对象。重叠服务集合的先后关系和默认出站属于 [routing.json](../metadata/routing.json)，与 category 标签分离。Apple TV+ 的 8 条均与 Apple 父集合重叠，Copilot 的 6 条及 npm 的 3 条与 GitHub 父集合重叠，因此 Apple、GitHub、Google、Microsoft 父集合安排在普通服务之后。Apple 的初始 DIRECT 选项保持不变。

## 更新与复用

每次接入核对原始 URL、作者、许可、固定提交及内容 SHA-256。多来源定点更新使用 --repository 登记ID 选择版本移动目标；没有 selector 的 --latest 检查全部来源，多来源的 --revision 则必须指定 selector。校验仍覆盖全部固定输入，未选来源的版本、日期与输出不能随之改变。下载内容只作为规则数据，不执行上游代码。新的来源、许可变化和不可移植类型需要显式审查。

同步先校验所有候选，再发布规范目录和来源清单；网络失败、许可变化、未审查表达式或本地手工修改会阻止覆盖。恢复信息保存在被忽略的 .cache/sync/。手动 upstream-check 工作流只生成候选差异与 review artifact，不自动提交、推送或创建 PR。

客户端格式来自各自官方手册或开发者示例，见[客户端格式依据](client-formats.md)。功能脚本区分本项目自有实现与按独立来源、许可登记的第三方功能包；API 响应格式、原生宿主契约与验证范围见[功能说明](features.md)。

## 本轮候选源筛查

以下星标、维护时间与许可证在 2026-10-31 通过仓库 API 和许可正文核对，属于该次快照，不是持续维护保证。

| 项目 | Stars | 最近推送（UTC） | 许可证 | 本轮处理 |
| --- | ---: | --- | --- | --- |
| [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community) | 9,792 | 2026-10-30 | MIT | 沿现有固定提交增补 23 个具体服务 |
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 28,467 | 2026-10-27 | GPL-2.0 | 来源活跃，但不属于当前规则同步许可登记范围，本轮未复制 |
| [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules) | 29,061 | 2026-10-29 | GPL-3.0 | 本轮未复制，不将其内容标为 MIT |
| [privacy-protection-tools/anti-AD](https://github.com/privacy-protection-tools/anti-AD) | 10,910 | 2026-10-30 | MIT | 固定 cafc2bfb031a9e5ee4461721afc65b82430f2c15 的 Surge DOMAIN-SET 已作为大型可选规则集接入；100,682 条、2,024,029 字节，默认主配置排除 |

另有 Disney 与 Epic Games 源列表包含当前四类模型不能无损表达的正则，现同步器已实际拒绝。本批不为了增加数量而新增有损排除，保留后续明确适配的空间。第三方功能包如有独立来源与许可，按其自身登记和验证边界说明，不从此规则源表推断。

## AntiAD 的匹配语义与资源边界

固定输入为 [anti-ad-surge2.txt](https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/cafc2bfb031a9e5ee4461721afc65b82430f2c15/anti-ad-surge2.txt)，SHA-256 为 c8fee421d931f8160f2c2414e1148bb39c4ca1c964ecffe51d91cc2dd4318290。其 100,682 行全部使用原生 DOMAIN-SET 的点前缀。source.format=domain-lines、linePrefix=.、matchType=domain-suffix 显式登记，解析器要求每一行都满足该语法，不从普通文本猜测匹配方式。

伴随的 [Clash 文件](https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/cafc2bfb031a9e5ee4461721afc65b82430f2c15/anti-ad-clash.yaml) 全部使用 +. 前缀，归一后的后缀根域集合与本次输入双向完全一致；该文件的 SHA-256 及依据写在来源元数据。未使用 anti-ad-domains.txt 作为替代：它与原生后缀集合不等价。

该登记源的传输上限为 3 MB，所有单源硬上限为 4 MB；普通 DLC 文件仍使用 1 MB，整批下载仍受 24 MB 与 1024 全局文件上限（单 DLC 闭包512）约束。HTTP 响应头、实际流字节和缓存复用都会复核限额；非法行、头部计数变化、未登记格式或许可校验失败都会阻止整批替换。

AntiAD 不自动进入八套默认配置，独立文件应由使用者按需导入并指定 REJECT。原始 [MIT 许可](../src/vendor/anti-ad/LICENSE)、[上游 README 与鸣谢](../src/vendor/anti-ad/README.md) 及所需的小型文档依赖按固定提交保留；鸣谢中的原始上游来源不被重新标成由本项目创作。


## 完整 CN 域名与 IP 兜底

当前使用固定 DLC 的 cn 完整 include闭包：361文件、482条属性过滤、8,387个可移植域名事实；原19个常用后缀全部保持语义覆盖。3条非可移植正则逐字登记文件/行号/原因，不静默扩展成不同含义。另固定 gaoyifan/china-operator-ip ip-lists 分支 f7533065e164cbe0cf24b488a77ca75b8e897923 的 china.txt/china6.txt：6,174 IPv4、3,475 IPv6，二者与原china46集合双向相同。MIT完整许可与文档保留。BGP和登记分类不等于物理地理真值。

当前完整固定同步实际519文件/2,506,997字节，changed:false。CIDR源逐行核对family与canonical网络，拒绝会扩大网段的hostbits输入；共享总24MB、单文件硬4MB预算保持，每闭包512与全局1024文件分别测试。CN在具体服务后、final前，IP兜底允许主动解析。
