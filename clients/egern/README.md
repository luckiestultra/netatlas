# Egern

[完整配置](profiles/default.yaml) · [私有接入输入示例](profiles/input.example.json) · [构建清单](manifest.json)

配置已包含节点/订阅接入、DNS、LAN/拦截/服务分流、CN 域名和 IPv4/IPv6 兜底及最终策略。公开文件不含你的私人节点，因此未配置时 Proxy 拒绝；填入真实节点后会自动接入，不需要再手改每个服务策略组。

## 填入自己的节点或订阅

~~~sh
mkdir -p private
cp clients/egern/profiles/input.example.json private/egern.json
# 编辑 private/egern.json，填 nodes 或 subscriptions。
npm run profile -- --client egern --input private/egern.json --output private/egern.yaml
~~~

随后在 Egern 导入生成的私有配置。文件权限为 0600；private/ 已忽略，不会提交。填本地节点时默认选第一个，selectedProxy 可指定其他节点。原生 URL 订阅在应用加载后还需手选实际节点；图形应用可能保留旧选择，导入后核对实际出站。

订阅使用该客户端自己的原生资源语法，刷新由客户端处理。公开示例没有活动假 URL。

支持的原生节点格式、订阅格式、DNS 行为及失败处理见[完整接入说明](../../docs/profile-setup.md)。无需为使用本仓库修改现有客户端配置；可导入为独立配置。

## 分流与 DNS

主配置内联 40 组 / 23,476 条规则，不依赖首次下载远程规则。具体服务先于 CN 兜底；LAN 直连，拦截拒绝，未命中走 Proxy。CN 数据是固定来源的网络分类，不是物理地理位置保证。anti-AD 的 100,682 条为可选资源，不默认内联。

DNS 按各客户端原生能力配置：独立的节点引导解析、LAN 系统解析、国内直连解析和代理目标远端解析；不会用一套外来字段硬套八个客户端。默认使用 AliDNS 国内 DoH；支持明确国外 DNS 角色的客户端使用 Cloudflare DoH 经代理。可在私有输入的 dnsUpstreams 覆盖对应角色，见接入说明。

| 应用/服务 | 标签 | 条目 |
| --- | --- | ---: |
| [lan](rules/lan.yaml) | network | 17 |
| [adblock](rules/adblock.yaml) | privacy | 904 |
| [anti-ad（可选）](rules/anti-ad.yaml) | privacy | 100682 |
| [apple-tvplus](rules/apple-tvplus.yaml) | media | 8 |
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
| [china](rules/china.yaml) | system | 8387 |
| [china-ipv4](rules/china-ipv4.yaml) | network | 6174 |
| [china-ipv6](rules/china-ipv6.yaml) | network | 3475 |

## 可选功能

- [modules/anti-ad.yaml](modules/anti-ad.yaml)
- [rewrites/https-upgrade.yaml](rewrites/https-upgrade.yaml)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX fragments/geoip.conf 合并到 [general]；不会自动启用 MITM、证书、重写或脚本。

HTTPS-upgrade 按 GPL-2.0-only 提供；anti-AD 和 CN 数据保留各自原始许可与 credits。详见[功能](../../docs/features.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。

验证：高星完整配置与官方资料交叉核对、私有输入/原生字段/规则与引用检查；没有本机原生 GUI 运行证据。具体结果见[验证记录](../../docs/validation.md)，[来源登记](../../metadata/profile-references.json)。
