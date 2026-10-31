# Surge

[完整配置](profiles/default.conf) · [私有接入输入示例](profiles/input.example.json) · [构建清单](manifest.json)

配置已包含节点/订阅接入、DNS、LAN/拦截/服务分流、CN 域名和 IPv4/IPv6 兜底及最终策略。公开文件不含你的私人节点，因此未配置时 Proxy 拒绝；填入真实节点后会自动接入，不需要再手改每个服务策略组。

## 填入自己的节点或订阅

~~~sh
mkdir -p private
cp clients/surge/profiles/input.example.json private/surge.json
# 编辑 private/surge.json，填 nodes 或 subscriptions。
npm run profile -- --client surge --input private/surge.json --output private/surge.conf
~~~

随后在 Surge 导入生成的私有配置。文件权限为 0600；private/ 已忽略，不会提交。填本地节点时默认选第一个，selectedProxy 可指定其他节点。原生 URL 订阅在应用加载后还需手选实际节点；图形应用可能保留旧选择，导入后核对实际出站。

订阅使用该客户端自己的原生资源语法，刷新由客户端处理。公开示例没有活动假 URL。

支持的原生节点格式、订阅格式、DNS 行为及失败处理见[完整接入说明](../../docs/profile-setup.md)。无需为使用本仓库修改现有客户端配置；可导入为独立配置。

## 分流与 DNS

主配置内联 40 组 / 23,476 条规则，不依赖首次下载远程规则。具体服务先于 CN 兜底；LAN 直连，拦截拒绝，未命中走 Proxy。CN 数据是固定来源的网络分类，不是物理地理位置保证。anti-AD 的 100,682 条为可选资源，不默认内联。

DNS 按各客户端原生能力配置：独立的节点引导解析、LAN 系统解析、国内直连解析和代理目标远端解析；不会用一套外来字段硬套八个客户端。默认使用 AliDNS 国内 DoH；支持明确国外 DNS 角色的客户端使用 Cloudflare DoH 经代理。可在私有输入的 dnsUpstreams 覆盖对应角色，见接入说明。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
| [lan](rules/lan.list) | network | 17 |
| [adblock](rules/adblock.list) | privacy | 904 |
| [anti-ad（可选）](rules/anti-ad.list) | privacy | 100682 |
| [apple-tvplus](rules/apple-tvplus.list) | media | 8 |
| [claude](rules/claude.list) | ai | 19 |
| [cursor](rules/cursor.list) | ai | 5 |
| [discord](rules/discord.list) | social | 28 |
| [docker](rules/docker.list) | development | 6 |
| [gemini](rules/gemini.list) | ai | 49 |
| [github-copilot](rules/github-copilot.list) | ai | 6 |
| [gitlab](rules/gitlab.list) | development | 5 |
| [groq](rules/groq.list) | ai | 1 |
| [hbo](rules/hbo.list) | media | 65 |
| [huggingface](rules/huggingface.list) | ai | 3 |
| [jetbrains](rules/jetbrains.list) | development | 25 |
| [line](rules/line.list) | social | 20 |
| [netflix](rules/netflix.list) | media | 24 |
| [npmjs](rules/npmjs.list) | development | 3 |
| [openai](rules/openai.list) | ai | 24 |
| [perplexity](rules/perplexity.list) | ai | 5 |
| [poe](rules/poe.list) | ai | 2 |
| [signal](rules/signal.list) | social | 8 |
| [slack](rules/slack.list) | social | 11 |
| [speedtest](rules/speedtest.list) | network | 20 |
| [spotify](rules/spotify.list) | media | 28 |
| [steam](rules/steam.list) | gaming | 61 |
| [telegram](rules/telegram.list) | social | 21 |
| [tiktok](rules/tiktok.list) | media | 40 |
| [twitch](rules/twitch.list) | media | 35 |
| [vercel](rules/vercel.list) | development | 27 |
| [whatsapp](rules/whatsapp.list) | social | 11 |
| [xai](rules/xai.list) | ai | 4 |
| [youtube](rules/youtube.list) | media | 178 |
| [zoom](rules/zoom.list) | social | 3 |
| [apple](rules/apple.list) | system | 1826 |
| [github](rules/github.list) | development | 65 |
| [google](rules/google.list) | system | 1123 |
| [microsoft](rules/microsoft.list) | system | 760 |
| [china](rules/china.list) | system | 8387 |
| [china-ipv4](rules/china-ipv4.list) | network | 6174 |
| [china-ipv6](rules/china-ipv6.list) | network | 3475 |

## 可选功能

- [scripts/geoip.js](scripts/geoip.js)
- [modules/geoip.sgmodule](modules/geoip.sgmodule)
- [rewrites/search-redirect.sgmodule](rewrites/search-redirect.sgmodule)
- [modules/anti-ad.sgmodule](modules/anti-ad.sgmodule)
- [rewrites/https-upgrade.sgmodule](rewrites/https-upgrade.sgmodule)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX fragments/geoip.conf 合并到 [general]；不会自动启用 MITM、证书、重写或脚本。

HTTPS-upgrade 按 GPL-2.0-only 提供；anti-AD 和 CN 数据保留各自原始许可与 credits。详见[功能](../../docs/features.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。

验证：高星完整配置与官方资料交叉核对、私有输入/原生字段/规则与引用检查；没有本机原生 GUI 运行证据。具体结果见[验证记录](../../docs/validation.md)，[来源登记](../../metadata/profile-references.json)。
