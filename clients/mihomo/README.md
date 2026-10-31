# Mihomo

[主配置](profiles/default.yaml) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/mihomo/profiles/default.yaml) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

在 GUI 前端导入主配置，在 proxy-providers 添加自己的 Mihomo 原生订阅，将 provider 名称加入节点选择、自动选择和地区组的 use（include-all 也会纳入节点）。也可填写 proxies；加载后选择实际节点。

首次使用需由客户端下载远程规则。主配置引用本客户端的 114 份规则资源，覆盖 29,103 条规则，更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 | 许可 |
| --- | ---: | --- |
| [lan](rules/lan.yaml) | 17 | MIT |
| [unbreak](rules/unbreak.yaml) | 3 | MIT |
| [adblock](rules/adblock.yaml) | 904 | MIT |
| [abc](rules/abc.yaml) | 4 | MIT |
| [abema](rules/abema.yaml) | 21 | MIT |
| [acfun](rules/acfun.yaml) | 8 | MIT |
| [alipay](rules/alipay.yaml) | 11 | MIT |
| [all4](rules/all4.yaml) | 2 | GPL-2.0-only |
| [amap](rules/amap.yaml) | 16 | MIT |
| [android](rules/android.yaml) | 4 | MIT |
| [anti-ad（可选）](rules/anti-ad.yaml) | 100,682 | MIT |
| [apple-tvplus](rules/apple-tvplus.yaml) | 8 | MIT |
| [appstore](rules/appstore.yaml) | 26 | MIT |
| [baidu](rules/baidu.yaml) | 132 | MIT |
| [bilibili](rules/bilibili.yaml) | 53 | MIT |
| [blizzard](rules/blizzard.yaml) | 25 | MIT |
| [claude](rules/claude.yaml) | 19 | MIT |
| [coolapk](rules/coolapk.yaml) | 3 | MIT |
| [cursor](rules/cursor.yaml) | 5 | MIT |
| [deezer](rules/deezer.yaml) | 2 | MIT |
| [discord](rules/discord.yaml) | 28 | MIT |
| [discovery](rules/discovery.yaml) | 3 | MIT |
| [docker](rules/docker.yaml) | 6 | MIT |
| [douban](rules/douban.yaml) | 3 | MIT |
| [douyin](rules/douyin.yaml) | 71 | MIT |
| [douyu](rules/douyu.yaml) | 7 | MIT |
| [dropbox](rules/dropbox.yaml) | 25 | MIT |
| [facebook](rules/facebook.yaml) | 397 | MIT |
| [five-itv](rules/five-itv.yaml) | 2 | GPL-2.0-only |
| [gemini](rules/gemini.yaml) | 49 | MIT |
| [github-copilot](rules/github-copilot.yaml) | 6 | MIT |
| [gitlab](rules/gitlab.yaml) | 5 | MIT |
| [global（可选）](rules/global.yaml) | 6,985 | GPL-2.0-only |
| [google-cn（可选）](rules/google-cn.yaml) | 124 | MIT |
| [groq](rules/groq.yaml) | 1 | MIT |
| [hbo-asia](rules/hbo-asia.yaml) | 19 | GPL-2.0-only |
| [heroku](rules/heroku.yaml) | 12 | MIT |
| [huggingface](rules/huggingface.yaml) | 3 | MIT |
| [hulu-jp](rules/hulu-jp.yaml) | 5 | GPL-2.0-only |
| [huya](rules/huya.yaml) | 2 | MIT |
| [icloud](rules/icloud.yaml) | 55 | MIT |
| [iqiyi](rules/iqiyi.yaml) | 20 | MIT |
| [jetbrains](rules/jetbrains.yaml) | 25 | MIT |
| [joox](rules/joox.yaml) | 1 | MIT |
| [kkbox](rules/kkbox.yaml) | 5 | MIT |
| [kktv](rules/kktv.yaml) | 3 | MIT |
| [line](rules/line.yaml) | 20 | MIT |
| [mozilla](rules/mozilla.yaml) | 77 | MIT |
| [mudvod](rules/mudvod.yaml) | 10 | MIT |
| [mytvsuper](rules/mytvsuper.yaml) | 1 | MIT |
| [netease-music](rules/netease-music.yaml) | 28 | GPL-2.0-only |
| [netflix](rules/netflix.yaml) | 24 | MIT |
| [niconico](rules/niconico.yaml) | 10 | MIT |
| [notion](rules/notion.yaml) | 7 | MIT |
| [npmjs](rules/npmjs.yaml) | 3 | MIT |
| [olevod](rules/olevod.yaml) | 9 | MIT |
| [onedrive](rules/onedrive.yaml) | 11 | MIT |
| [openai](rules/openai.yaml) | 24 | MIT |
| [oracle](rules/oracle.yaml) | 19 | MIT |
| [paypal](rules/paypal.yaml) | 245 | MIT |
| [perplexity](rules/perplexity.yaml) | 5 | MIT |
| [pikpak](rules/pikpak.yaml) | 7 | MIT |
| [poe](rules/poe.yaml) | 2 | MIT |
| [pornhub](rules/pornhub.yaml) | 9 | MIT |
| [pptv](rules/pptv.yaml) | 3 | MIT |
| [primevideo](rules/primevideo.yaml) | 24 | MIT |
| [qobuz](rules/qobuz.yaml) | 1 | MIT |
| [quark](rules/quark.yaml) | 3 | MIT |
| [signal](rules/signal.yaml) | 8 | MIT |
| [slack](rules/slack.yaml) | 11 | MIT |
| [soundcloud](rules/soundcloud.yaml) | 3 | MIT |
| [speedtest](rules/speedtest.yaml) | 20 | MIT |
| [spotify](rules/spotify.yaml) | 28 | MIT |
| [steam-cn](rules/steam-cn.yaml) | 17 | MIT |
| [taptap](rules/taptap.yaml) | 7 | MIT |
| [telegram](rules/telegram.yaml) | 21 | MIT |
| [terabox](rules/terabox.yaml) | 7 | MIT |
| [tidal](rules/tidal.yaml) | 3 | MIT |
| [tiktok](rules/tiktok.yaml) | 40 | MIT |
| [twitch](rules/twitch.yaml) | 35 | MIT |
| [twitter](rules/twitter.yaml) | 24 | MIT |
| [vercel](rules/vercel.yaml) | 27 | MIT |
| [viu-portable](rules/viu-portable.yaml) | 6 | MIT |
| [wechat](rules/wechat.yaml) | 5 | MIT |
| [weibo](rules/weibo.yaml) | 6 | MIT |
| [whatsapp](rules/whatsapp.yaml) | 11 | MIT |
| [wikimedia](rules/wikimedia.yaml) | 18 | MIT |
| [xai](rules/xai.yaml) | 4 | MIT |
| [xiaohongshu](rules/xiaohongshu.yaml) | 12 | MIT |
| [ximalaya](rules/ximalaya.yaml) | 5 | MIT |
| [yandex](rules/yandex.yaml) | 157 | MIT |
| [youku](rules/youku.yaml) | 31 | MIT |
| [youtube](rules/youtube.yaml) | 178 | MIT |
| [z-library](rules/z-library.yaml) | 48 | MIT |
| [zoom](rules/zoom.yaml) | 3 | MIT |
| [hulu](rules/hulu.yaml) | 48 | MIT |
| [hbo](rules/hbo.yaml) | 65 | MIT |
| [steam](rules/steam.yaml) | 61 | MIT |
| [quora](rules/quora.yaml) | 6 | MIT |
| [tvb](rules/tvb.yaml) | 14 | MIT |
| [disney](rules/disney.yaml) | 236 | MIT |
| [china-media](rules/china-media.yaml) | 297 | MIT |
| [hmt-media](rules/hmt-media.yaml) | 60 | MIT |
| [global-media](rules/global-media.yaml) | 704 | MIT |
| [amazon-portable](rules/amazon-portable.yaml) | 250 | MIT |
| [akamai](rules/akamai.yaml) | 81 | MIT |
| [alibaba](rules/alibaba.yaml) | 464 | MIT |
| [bytedance](rules/bytedance.yaml) | 960 | MIT |
| [netease](rules/netease.yaml) | 54 | MIT |
| [tencent](rules/tencent.yaml) | 700 | MIT |
| [apple](rules/apple.yaml) | 1,826 | MIT |
| [github](rules/github.yaml) | 65 | MIT |
| [google](rules/google.yaml) | 1,123 | MIT |
| [microsoft](rules/microsoft.yaml) | 760 | MIT |
| [china](rules/china.yaml) | 8,387 | MIT |
| [china-ipv4](rules/china-ipv4.yaml) | 6,174 | MIT |
| [china-ipv6](rules/china-ipv6.yaml) | 3,475 | MIT |

## 可选功能

| 功能 | 实际入口/导入方式 |
| --- | --- |
| 可选反广告 | [fragments/anti-ad.yaml](fragments/anti-ad.yaml)；merge-fragment |

modules 保存脚本功能安装资源，rewrites 保存纯重写，fragments 需要手工合并。QX 的 modules/*.snippet 仍在 App 中按“重写资源”导入；Surge/SR 用各自模块入口，Loon 用插件，Egern 用模块，Stash 用覆写，不能混用相同扩展名推断兼容。

BoxJS、ScriptHub、Sub-Store 为明确可选的上游工具，脚本入口固定版本，GUI 导入未实测；BoxJS 会读写宿主脚本存储，转换工具会读取订阅/用户指定 URL。没有自动同步任务，也不会自动启用 MITM 或安装 CA。第三方脚本与前端的完整依赖树不全部固定，见[工具许可与边界](../../src/vendor/integrations/)。外部解析器片段只链接作者发布脚本，不是本仓库实现的解析器。

Mihomo/sing-box 提供原生规则、DNS、节点与可选反广告；BoxJS 等 GUI 模块和 HTTP 重写不是这两个核心的能力。需要订阅转换时可另用 [Sub-Store 官方服务](https://github.com/sub-store-org/Sub-Store)，不要把 GUI 脚本格式塞进核心配置。QX 主配置已经接入 GeoIP；其片段供其他既有配置使用。完整边界见[逐项覆盖](../../docs/coverage.md)与[功能说明](../../docs/features.md)。

## 高级：离线配置或本地私有转换

[standalone.yaml](profiles/standalone.yaml) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/mihomo/profiles/input.example.json private/mihomo.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client mihomo --input private/mihomo.json --output private/mihomo.yaml
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
