# sing-box

[完整配置](profiles/default.json) · [私有接入输入示例](profiles/input.example.json) · [构建清单](manifest.json)

配置已包含节点/订阅接入、DNS、LAN/拦截/服务分流、CN 域名和 IPv4/IPv6 兜底及最终策略。公开文件不含你的私人节点，因此未配置时 Proxy 拒绝；填入真实节点后会自动接入，不需要再手改每个服务策略组。

## 填入自己的节点或订阅

~~~sh
mkdir -p private
cp clients/singBox/profiles/input.example.json private/singBox.json
# 编辑 private/singBox.json，填 nodes 或 subscriptions。
npm run profile -- --client singBox --input private/singBox.json --output private/singBox.json
~~~

随后在 sing-box 导入生成的私有配置。文件权限为 0600；private/ 已忽略，不会提交。填本地节点时默认选第一个，selectedProxy 可指定其他节点。原生 URL 订阅在应用加载后还需手选实际节点；图形应用可能保留旧选择，导入后核对实际出站。

该客户端不伪造远程节点 provider：本地命令拉取支持格式并展开真实节点；刷新时重新执行。Shadowrocket 的普通 URI 机场订阅也可直接从应用首页导入，Proxy 的原生匹配器会纳入应用节点。

支持的原生节点格式、订阅格式、DNS 行为及失败处理见[完整接入说明](../../docs/profile-setup.md)。无需为使用本仓库修改现有客户端配置；可导入为独立配置。

## 分流与 DNS

主配置内联 40 组 / 23,476 条规则，不依赖首次下载远程规则。具体服务先于 CN 兜底；LAN 直连，拦截拒绝，未命中走 Proxy。CN 数据是固定来源的网络分类，不是物理地理位置保证。anti-AD 的 100,682 条为可选资源，不默认内联。

DNS 按各客户端原生能力配置：独立的节点引导解析、LAN 系统解析、国内直连解析和代理目标远端解析；不会用一套外来字段硬套八个客户端。默认使用 AliDNS 国内 DoH；支持明确国外 DNS 角色的客户端使用 Cloudflare DoH 经代理。可在私有输入的 dnsUpstreams 覆盖对应角色，见接入说明。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
| [lan](rules/lan.json) | network | 17 |
| [adblock](rules/adblock.json) | privacy | 904 |
| [anti-ad（可选）](rules/anti-ad.json) | privacy | 100682 |
| [apple-tvplus](rules/apple-tvplus.json) | media | 8 |
| [claude](rules/claude.json) | ai | 19 |
| [cursor](rules/cursor.json) | ai | 5 |
| [discord](rules/discord.json) | social | 28 |
| [docker](rules/docker.json) | development | 6 |
| [gemini](rules/gemini.json) | ai | 49 |
| [github-copilot](rules/github-copilot.json) | ai | 6 |
| [gitlab](rules/gitlab.json) | development | 5 |
| [groq](rules/groq.json) | ai | 1 |
| [hbo](rules/hbo.json) | media | 65 |
| [huggingface](rules/huggingface.json) | ai | 3 |
| [jetbrains](rules/jetbrains.json) | development | 25 |
| [line](rules/line.json) | social | 20 |
| [netflix](rules/netflix.json) | media | 24 |
| [npmjs](rules/npmjs.json) | development | 3 |
| [openai](rules/openai.json) | ai | 24 |
| [perplexity](rules/perplexity.json) | ai | 5 |
| [poe](rules/poe.json) | ai | 2 |
| [signal](rules/signal.json) | social | 8 |
| [slack](rules/slack.json) | social | 11 |
| [speedtest](rules/speedtest.json) | network | 20 |
| [spotify](rules/spotify.json) | media | 28 |
| [steam](rules/steam.json) | gaming | 61 |
| [telegram](rules/telegram.json) | social | 21 |
| [tiktok](rules/tiktok.json) | media | 40 |
| [twitch](rules/twitch.json) | media | 35 |
| [vercel](rules/vercel.json) | development | 27 |
| [whatsapp](rules/whatsapp.json) | social | 11 |
| [xai](rules/xai.json) | ai | 4 |
| [youtube](rules/youtube.json) | media | 178 |
| [zoom](rules/zoom.json) | social | 3 |
| [apple](rules/apple.json) | system | 1826 |
| [github](rules/github.json) | development | 65 |
| [google](rules/google.json) | system | 1123 |
| [microsoft](rules/microsoft.json) | system | 760 |
| [china](rules/china.json) | system | 8387 |
| [china-ipv4](rules/china-ipv4.json) | network | 6174 |
| [china-ipv6](rules/china-ipv6.json) | network | 3475 |

## 可选功能

- [fragments/anti-ad.json](fragments/anti-ad.json)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX fragments/geoip.conf 合并到 [general]；不会自动启用 MITM、证书、重写或脚本。

HTTPS-upgrade 按 GPL-2.0-only 提供；anti-AD 和 CN 数据保留各自原始许可与 credits。详见[功能](../../docs/features.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。

验证：固定内核原配置检查、真实订阅更新、四个 DNS 角色和 HTTP/SOCKS 路由；运行 npm run test:native。具体结果见[验证记录](../../docs/validation.md)，[来源登记](../../metadata/profile-references.json)。
