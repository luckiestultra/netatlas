# 来源与参考记录

核对时间：2026-10-31，Asia/Shanghai。星标与维护信息是这次查询的快照，不作为质量保证。

## 账号与参考范围

- 新仓库所有者为 [luckiestultra](https://github.com/luckiestultra)。
- 与当前连接身份对应的原星标账号为 [luckiestmax](https://github.com/luckiestmax?tab=stars)。已查看其公开星标，筛选与本项目目标相关的内容。
- 用户明确指定 [Centralmatrix3/Matrix-io](https://github.com/Centralmatrix3/Matrix-io) 作为完整多客户端仓库的组织参考。

## 当前参考来源

| 来源 | 本次核对 | 参考用途 | 复用边界 |
|---|---|---|---|
| [Centralmatrix3/Matrix-io](https://github.com/Centralmatrix3/Matrix-io) | 809 stars；最近推送 2026-10-30 | 多客户端分发、独立规则和功能模块 | 未见明确许可证；不直接复制代码、模块和图标 |
| [iab0x00/ProxyRules](https://github.com/iab0x00/ProxyRules) | luckiestmax 已星标；832 stars；2026-10-14 推送 | 服务分类与可选重写的组织方式 | 本次 API 未识别许可证；只参考设计和原始来源 |
| [xykt/IPQuality](https://github.com/xykt/IPQuality) | luckiestmax 已星标；10,929 stars；AGPL-3.0 | 多来源检测、结果分歧与异常状态的表达 | 首版不移植其代码；未来复用时单独处理许可证 |
| [xykt/NetQuality](https://github.com/xykt/NetQuality) | luckiestmax 已星标；5,966 stars；AGPL-3.0 | 网络诊断方法和结果验证 | 不把 VPS 检测脚本直接当客户端脚本发布 |
| [yding-git/personal-edge-proxy](https://github.com/yding-git/personal-edge-proxy) | luckiestmax 已星标；MIT | 节点、出站策略与客户端内容的分离 | 不把服务端部署扩进当前客户端仓库范围 |
| [v2fly/domain-list-community](https://github.com/v2fly/domain-list-community) | 9,792 stars；2026-10-30 推送；MIT | 后续公共域名规则数据的候选来源 | 这是额外筛选的候选，不冒称用户已星标；接入前固定提交并保留许可 |

## Matrix-io 的具体发现

- 有八种客户端配置目录，但 `Config/Sing-box/Matrix.json` 内容为 `{}`，只是占位。
- `Ruleset` 中的规则由 workflow 从另一个仓库 `Centralmatrix3/Network` 取得 Surge 格式输入，再转换多种格式；生成 sing-box 的 JSON 与 SRS。
- 现有构建没有统一生成配置、模块、图标与脚本；这些内容另行维护。
- Matrix-io 和 Network 的完整文件树均未见 LICENSE；Matrix-io 的 readme 也没有额外给出复用授权。
- QX 的 GeoIP 文件仍含之前遇到的空 ASN 解析缺陷，因此不继承该实现。

证据入口：[配置目录](https://github.com/Centralmatrix3/Matrix-io/tree/master/Config)、[构建 workflow](https://github.com/Centralmatrix3/Matrix-io/blob/master/.github/workflows/Build.yml)、[GeoIP 脚本](https://github.com/Centralmatrix3/Matrix-io/blob/master/Scripts/QuantumultX/IP-API.js)。

## 后续接入规则

来源进入构建之前，要登记原始 URL、作者、用途、许可证、固定提交或版本、内容校验值和转换方法。明确许可的数据可以按其许可复用；许可未明的内容仅作参考，不以本项目许可证覆盖。

不自动执行下载来的上游代码。上游数据更新先校验，失败保留上一份已验证产物，不发布部分更新。
