# Stash

[主配置](profiles/default.yaml) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/stash/profiles/default.yaml) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

导入主配置，在 proxy-providers 添加自己的 Stash 原生订阅，将 provider 名称填入节点选择、自动选择和地区组的 use；也可直接添加 proxies。选择实际节点；当前公开文件没有活动假订阅。

首次使用需由客户端下载远程规则。主配置引用本客户端的 40 份规则资源，覆盖 23,476 条规则，更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 |
| --- | ---: |
| [lan](rules/lan.yaml) | 17 |
| [adblock](rules/adblock.yaml) | 904 |
| [anti-ad（可选）](rules/anti-ad.yaml) | 100,682 |
| [apple-tvplus](rules/apple-tvplus.yaml) | 8 |
| [claude](rules/claude.yaml) | 19 |
| [cursor](rules/cursor.yaml) | 5 |
| [discord](rules/discord.yaml) | 28 |
| [docker](rules/docker.yaml) | 6 |
| [gemini](rules/gemini.yaml) | 49 |
| [github-copilot](rules/github-copilot.yaml) | 6 |
| [gitlab](rules/gitlab.yaml) | 5 |
| [groq](rules/groq.yaml) | 1 |
| [hbo](rules/hbo.yaml) | 65 |
| [huggingface](rules/huggingface.yaml) | 3 |
| [jetbrains](rules/jetbrains.yaml) | 25 |
| [line](rules/line.yaml) | 20 |
| [netflix](rules/netflix.yaml) | 24 |
| [npmjs](rules/npmjs.yaml) | 3 |
| [openai](rules/openai.yaml) | 24 |
| [perplexity](rules/perplexity.yaml) | 5 |
| [poe](rules/poe.yaml) | 2 |
| [signal](rules/signal.yaml) | 8 |
| [slack](rules/slack.yaml) | 11 |
| [speedtest](rules/speedtest.yaml) | 20 |
| [spotify](rules/spotify.yaml) | 28 |
| [steam](rules/steam.yaml) | 61 |
| [telegram](rules/telegram.yaml) | 21 |
| [tiktok](rules/tiktok.yaml) | 40 |
| [twitch](rules/twitch.yaml) | 35 |
| [vercel](rules/vercel.yaml) | 27 |
| [whatsapp](rules/whatsapp.yaml) | 11 |
| [xai](rules/xai.yaml) | 4 |
| [youtube](rules/youtube.yaml) | 178 |
| [zoom](rules/zoom.yaml) | 3 |
| [apple](rules/apple.yaml) | 1,826 |
| [github](rules/github.yaml) | 65 |
| [google](rules/google.yaml) | 1,123 |
| [microsoft](rules/microsoft.yaml) | 760 |
| [china](rules/china.yaml) | 8,387 |
| [china-ipv4](rules/china-ipv4.yaml) | 6,174 |
| [china-ipv6](rules/china-ipv6.yaml) | 3,475 |

## 可选功能

- [modules/anti-ad.stoverride](modules/anti-ad.stoverride)
- [rewrites/https-upgrade.stoverride](rewrites/https-upgrade.stoverride)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX 主配置已经接入 GeoIP；geoip.conf 片段供已有其他配置使用。重写、MITM 和证书均不自动启用。功能依各客户端语法导入，见[功能说明](../../docs/features.md)。

## 高级：离线配置或本地私有转换

[standalone.yaml](profiles/standalone.yaml) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/stash/profiles/input.example.json private/stash.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client stash --input private/stash.json --output private/stash.yaml
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
