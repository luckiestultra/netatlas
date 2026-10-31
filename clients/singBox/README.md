# sing-box

[主配置](profiles/default.json) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/singBox/profiles/default.json) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

主配置面向 sing-box 1.14.4 核心。填入原生 outbounds，并将节点 tag 加入节点选择、自动选择和对应地区组的 outbounds，更新 selector.default。核心没有通用机场订阅 provider；支持订阅合并的前端需按其说明接入。需要本地转换时再使用下方高级工具，不向在线转换站上传秘密。

首次使用需由客户端下载远程规则。主配置引用本客户端的 40 份规则资源，覆盖 23,476 条规则，更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 |
| --- | ---: |
| [lan](rules/lan.json) | 17 |
| [adblock](rules/adblock.json) | 904 |
| [anti-ad（可选）](rules/anti-ad.json) | 100,682 |
| [apple-tvplus](rules/apple-tvplus.json) | 8 |
| [claude](rules/claude.json) | 19 |
| [cursor](rules/cursor.json) | 5 |
| [discord](rules/discord.json) | 28 |
| [docker](rules/docker.json) | 6 |
| [gemini](rules/gemini.json) | 49 |
| [github-copilot](rules/github-copilot.json) | 6 |
| [gitlab](rules/gitlab.json) | 5 |
| [groq](rules/groq.json) | 1 |
| [hbo](rules/hbo.json) | 65 |
| [huggingface](rules/huggingface.json) | 3 |
| [jetbrains](rules/jetbrains.json) | 25 |
| [line](rules/line.json) | 20 |
| [netflix](rules/netflix.json) | 24 |
| [npmjs](rules/npmjs.json) | 3 |
| [openai](rules/openai.json) | 24 |
| [perplexity](rules/perplexity.json) | 5 |
| [poe](rules/poe.json) | 2 |
| [signal](rules/signal.json) | 8 |
| [slack](rules/slack.json) | 11 |
| [speedtest](rules/speedtest.json) | 20 |
| [spotify](rules/spotify.json) | 28 |
| [steam](rules/steam.json) | 61 |
| [telegram](rules/telegram.json) | 21 |
| [tiktok](rules/tiktok.json) | 40 |
| [twitch](rules/twitch.json) | 35 |
| [vercel](rules/vercel.json) | 27 |
| [whatsapp](rules/whatsapp.json) | 11 |
| [xai](rules/xai.json) | 4 |
| [youtube](rules/youtube.json) | 178 |
| [zoom](rules/zoom.json) | 3 |
| [apple](rules/apple.json) | 1,826 |
| [github](rules/github.json) | 65 |
| [google](rules/google.json) | 1,123 |
| [microsoft](rules/microsoft.json) | 760 |
| [china](rules/china.json) | 8,387 |
| [china-ipv4](rules/china-ipv4.json) | 6,174 |
| [china-ipv6](rules/china-ipv6.json) | 3,475 |

## 可选功能

- [fragments/anti-ad.json](fragments/anti-ad.json)

modules 是原生安装包，rewrites 是纯重写资源，fragments 需要合并。QX 主配置已经接入 GeoIP；geoip.conf 片段供已有其他配置使用。重写、MITM 和证书均不自动启用。功能依各客户端语法导入，见[功能说明](../../docs/features.md)。

## 高级：离线配置或本地私有转换

[standalone.json](profiles/standalone.json) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/singBox/profiles/input.example.json private/singBox.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client singBox --input private/singBox.json --output private/singBox.json
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
