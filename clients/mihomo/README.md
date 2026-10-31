# Mihomo

[完整配置](profiles/default.yaml) · [构建清单](manifest.json)

先导入完整配置，在本地添加节点并加入 Proxy 策略组，再主动选择出站。新建 Proxy 默认 REJECT；应用可能保留旧选择，导入后核对实际选项。DIRECT 可手动选择。配置不含订阅、账号或节点凭据。

主配置内联默认 38 组、5459 条规则，不依赖远程规则。大型 anti-ad 只生成独立规则，默认不启用、不内联；按需使用下方安装包或手工合并片段，并把拦截规则放在宽泛允许规则之前。

规则按应用或服务平铺，分类只是索引标签。单独导入时指定策略；QX 文件包含原生策略名，可用 force-policy 覆盖。同名文件在不同客户端间不能互换。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
| [lan](rules/lan.yaml) | network | 17 |
| [adblock](rules/adblock.yaml) | privacy | 904 |
| [anti-ad（可选）](rules/anti-ad.yaml) | privacy | 100682 |
| [apple-tvplus](rules/apple-tvplus.yaml) | media | 8 |
| [china](rules/china.yaml) | system | 19 |
| [claude](rules/claude.yaml) | ai | 19 |
| [cursor](rules/cursor.yaml) | ai | 5 |
| [discord](rules/discord.yaml) | social | 28 |
| [docker](rules/docker.yaml) | development | 6 |
| [gemini](rules/gemini.yaml) | ai | 49 |
| [github-copilot](rules/github-copilot.yaml) | ai | 6 |
| [gitlab](rules/gitlab.yaml) | development | 5 |
| [groq](rules/groq.yaml) | ai | 1 |
| [hbo](rules/hbo.yaml) | media | 65 |
| [huggingface](rules/huggingface.yaml) | ai | 3 |
| [jetbrains](rules/jetbrains.yaml) | development | 25 |
| [line](rules/line.yaml) | social | 20 |
| [netflix](rules/netflix.yaml) | media | 24 |
| [npmjs](rules/npmjs.yaml) | development | 3 |
| [openai](rules/openai.yaml) | ai | 24 |
| [perplexity](rules/perplexity.yaml) | ai | 5 |
| [poe](rules/poe.yaml) | ai | 2 |
| [signal](rules/signal.yaml) | social | 8 |
| [slack](rules/slack.yaml) | social | 11 |
| [speedtest](rules/speedtest.yaml) | network | 20 |
| [spotify](rules/spotify.yaml) | media | 28 |
| [steam](rules/steam.yaml) | gaming | 61 |
| [telegram](rules/telegram.yaml) | social | 21 |
| [tiktok](rules/tiktok.yaml) | media | 40 |
| [twitch](rules/twitch.yaml) | media | 35 |
| [vercel](rules/vercel.yaml) | development | 27 |
| [whatsapp](rules/whatsapp.yaml) | social | 11 |
| [xai](rules/xai.yaml) | ai | 4 |
| [youtube](rules/youtube.yaml) | media | 178 |
| [zoom](rules/zoom.yaml) | social | 3 |
| [apple](rules/apple.yaml) | system | 1826 |
| [github](rules/github.yaml) | development | 65 |
| [google](rules/google.yaml) | system | 1123 |
| [microsoft](rules/microsoft.yaml) | system | 760 |

## 可选功能

- [fragments/anti-ad.yaml](fragments/anti-ad.yaml)

modules 是原生安装包，rewrites 是纯重写资源，fragments 必须按说明手工合并。QX fragments/geoip.conf 只合并到 [general]，不能当作重写或模块导入。远程资源 URL 需要对应文件已发布。GeoIP 结果不是服务器物理位置证明。

HTTPS-upgrade 功能代码和生成资源按 GPL-2.0-only 提供，保留完整来源与许可；anti-AD 按直接来源声明的 MIT 许可及 credits 保留。不要把所有产物一概视为 MIT。Loon 的 HTTPS-upgrade 需要 3.5.1(978) 以上。详见 [功能与安装说明](../../docs/features.md) 和 [第三方声明](../../THIRD_PARTY_NOTICES.md)。

原生验证：可运行 npm run test:native；报告在忽略的 .cache/native-check/latest.json。参见 [验证范围](../../docs/validation.md) 与 [官方参考](https://wiki.metacubex.one/en/config/rule-providers/)。
