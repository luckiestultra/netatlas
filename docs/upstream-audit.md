# 规则来源审计

本文件记录实际进入构建的来源和复用范围。机器可读的固定提交、校验值、来源文件及精确排除项以 [upstreams.json](../metadata/upstreams.json) 为准，许可原文保存在[第三方声明](../THIRD_PARTY_NOTICES.md)。

## 当前数据快照

核对日期：2026-10-31，Asia/Shanghai。

| 来源 | 固定版本与许可 | 使用范围 |
|---|---|---|
| [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community) | 1daade8c4bb957d21d1f5c09c2b050d699e8e96c，2026-10-30，MIT | 十三组登记列表及显式 include 的可移植投影 |
| 本项目 lan | 2026-10-31，MIT | 从登记的 RFC/IANA 来源选择常见本地与特殊地址事实，非完整登记表 |
| 本项目 china | 2026-10-31，MIT | 常用中国服务域名便利集，非完整地理域名/IP 数据库 |

当前共 15 组、5,077 条规范规则。DLC 的许可文件 URL 与 SHA-256 已登记，作者署名和完整许可继续保留，不用本项目许可覆盖第三方原有权利。

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

## 转换范围

依据[上游数据格式](https://github.com/v2fly/domain-list-community#structure-of-data)，裸域名和 domain: 转换为后缀，full: 转换为精确域名；显式 include 递归展开并处理属性筛选。本仓库没有执行全仓库 affiliation 反向聚合，也不声称生成完整 geosite 数据库。

当前九次正则排除涉及无法在首版四种规则类型间无损表达的条目，均以“来源文件、确切表达式、原因”逐条登记，并保留源行号和原文。同一表达式可在不同规则集各登记一次。它们没有被近似放大为后缀。任何新增、未经登记的正则或关键词表达式会阻止整批更新。

这些排除范围仍可能由其他规则或最终策略处理，但规则集不承诺覆盖原表达式的全部匹配对象。重叠服务集合的先后关系和默认出站属于 [routing.json](../metadata/routing.json)，与 category 标签分离。

## 更新与复用

每次接入核对原始 URL、作者、许可、固定提交及内容 SHA-256。下载内容只作为规则数据，不执行上游代码。新的来源、许可变化和不可移植类型需要显式审查。

同步先校验所有候选，再发布规范目录和来源清单；网络失败、许可变化、未审查表达式或本地手工修改会阻止覆盖。恢复信息保存在被忽略的 .cache/sync/。手动 upstream-check 工作流只生成候选差异与 review artifact，不自动提交、推送或创建 PR。

客户端格式来自各自官方手册或开发者示例，见[客户端格式依据](client-formats.md)。功能脚本是本项目独立实现，API 响应格式与原生宿主契约见[功能说明](features.md)。
