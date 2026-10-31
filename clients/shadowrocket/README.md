# Shadowrocket

[主配置](profiles/default.conf) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/shadowrocket/profiles/default.conf) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

在配置页导入主配置，在首页添加/更新订阅并选中实际节点，启用规则模式。节点选择中的 PROXY 指向首页选择；自动/地区组按首页节点名称筛选。

首次使用需由客户端下载远程规则。主配置引用本客户端的 40 份规则资源，覆盖 23,476 条规则，更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 |
| --- | ---: |
| [lan](rules/lan.list) | 17 |
| [adblock](rules/adblock.list) | 904 |
| [anti-ad（可选）](rules/anti-ad.list) | 100,682 |
| [apple-tvplus](rules/apple-tvplus.list) | 8 |
| [claude](rules/claude.list) | 19 |
| [cursor](rules/cursor.list) | 5 |
| [discord](rules/discord.list) | 28 |
| [docker](rules/docker.list) | 6 |
| [gemini](rules/gemini.list) | 49 |
| [github-copilot](rules/github-copilot.list) | 6 |
| [gitlab](rules/gitlab.list) | 5 |
| [groq](rules/groq.list) | 1 |
| [hbo](rules/hbo.list) | 65 |
| [huggingface](rules/huggingface.list) | 3 |
| [jetbrains](rules/jetbrains.list) | 25 |
| [line](rules/line.list) | 20 |
| [netflix](rules/netflix.list) | 24 |
| [npmjs](rules/npmjs.list) | 3 |
| [openai](rules/openai.list) | 24 |
| [perplexity](rules/perplexity.list) | 5 |
| [poe](rules/poe.list) | 2 |
| [signal](rules/signal.list) | 8 |
| [slack](rules/slack.list) | 11 |
| [speedtest](rules/speedtest.list) | 20 |
| [spotify](rules/spotify.list) | 28 |
| [steam](rules/steam.list) | 61 |
| [telegram](rules/telegram.list) | 21 |
| [tiktok](rules/tiktok.list) | 40 |
| [twitch](rules/twitch.list) | 35 |
| [vercel](rules/vercel.list) | 27 |
| [whatsapp](rules/whatsapp.list) | 11 |
| [xai](rules/xai.list) | 4 |
| [youtube](rules/youtube.list) | 178 |
| [zoom](rules/zoom.list) | 3 |
| [apple](rules/apple.list) | 1,826 |
| [github](rules/github.list) | 65 |
| [google](rules/google.list) | 1,123 |
| [microsoft](rules/microsoft.list) | 760 |
| [china](rules/china.list) | 8,387 |
| [china-ipv4](rules/china-ipv4.list) | 6,174 |
| [china-ipv6](rules/china-ipv6.list) | 3,475 |

## 可选功能

- [fragments/anti-ad.conf](fragments/anti-ad.conf)
- [rewrites/https-upgrade.conf](rewrites/https-upgrade.conf)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX 主配置已经接入 GeoIP；geoip.conf 片段供已有其他配置使用。重写、MITM 和证书均不自动启用。功能依各客户端语法导入，见[功能说明](../../docs/features.md)。

## 高级：离线配置或本地私有转换

[standalone.conf](profiles/standalone.conf) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/shadowrocket/profiles/input.example.json private/shadowrocket.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client shadowrocket --input private/shadowrocket.json --output private/shadowrocket.conf
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
