# Shadowrocket

[完整配置](profiles/default.conf) · [构建清单](manifest.json)

先导入完整配置，再在本地添加自己的节点并加入 Proxy 策略组。新建 Proxy 默认 REJECT；应用可能保留旧选择，导入后核对实际选项。DIRECT 可手动选择。配置不含订阅、账号或节点凭据。主配置已内联规则，不需要远程规则地址。

规则按应用或服务平铺；分类只是索引标签。单独导入规则时自行指定策略，Quantumult X 文件含原生策略名，可在导入时设置 force-policy。不要把其他客户端的同名规则文件互换。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
| [lan](rules/lan.list) | network | 17 |
| [adblock](rules/adblock.list) | privacy | 904 |
| [apple](rules/apple.list) | system | 1826 |
| [china](rules/china.list) | system | 19 |
| [claude](rules/claude.list) | ai | 19 |
| [gemini](rules/gemini.list) | ai | 49 |
| [github](rules/github.list) | development | 65 |
| [netflix](rules/netflix.list) | media | 24 |
| [openai](rules/openai.list) | ai | 24 |
| [speedtest](rules/speedtest.list) | network | 20 |
| [spotify](rules/spotify.list) | media | 28 |
| [telegram](rules/telegram.list) | social | 21 |
| [youtube](rules/youtube.list) | media | 178 |
| [google](rules/google.list) | system | 1123 |
| [microsoft](rules/microsoft.list) | system | 760 |

## 可选重写、脚本与模块

该客户端本次没有脚本或重写成品；不创建空目录。

可选功能单独导入，默认不启用。Quantumult X 的 modules/geoip.conf 是 [general] 合并片段，不是重写订阅。GeoIP 只显示查询源返回的出口归属；它不证明服务器物理位置。公共脚本 URL 需要对应文件已发布；本地构建不会自动发布。见 [功能说明](../../docs/features.md)。

规则、配置结构和策略引用在构建时校验。原生状态：仍需在真实应用中导入验证。参见 [验证范围](../../docs/validation.md) 与 [官方参考](https://apps.apple.com/us/app/shadowrocket/id932747118)。
