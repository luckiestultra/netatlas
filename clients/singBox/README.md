# sing-box

[主配置](profiles/default.json) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/singBox/profiles/default.json) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

主配置面向 sing-box 1.14.4 核心。填入原生 outbounds，并将节点 tag 加入节点选择、自动选择和对应地区组的 outbounds，更新 selector.default。核心没有通用机场订阅 provider；支持订阅合并的前端需按其说明接入。需要本地转换时再使用下方高级工具，不向在线转换站上传秘密。

首次使用需由客户端下载远程规则。主配置引用本客户端的 126 份规则资源（116 份公共规则、10 份原生条件补充），更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 | 许可 |
| --- | ---: | --- |
| [lan](rules/lan.json) | 17 | MIT |
| [connectivity-probes](rules/connectivity-probes.json) | 3 | MIT |
| [unbreak](rules/unbreak.json) | 50 | GPL-2.0-only |
| [adblock](rules/adblock.json) | 904 | MIT |
| [abc](rules/abc.json) | 4 | MIT |
| [abema](rules/abema.json) | 21 | MIT |
| [acfun](rules/acfun.json) | 8 | MIT |
| [alipay](rules/alipay.json) | 11 | MIT |
| [all4](rules/all4.json) | 2 | GPL-2.0-only |
| [amap](rules/amap.json) | 16 | MIT |
| [android](rules/android.json) | 4 | MIT |
| [anti-ad（可选）](rules/anti-ad.json) | 100,682 | MIT |
| [apple-tvplus](rules/apple-tvplus.json) | 8 | MIT |
| [appstore](rules/appstore.json) | 26 | MIT |
| [baidu](rules/baidu.json) | 132 | MIT |
| [bilibili](rules/bilibili.json) | 53 | MIT |
| [blizzard](rules/blizzard.json) | 25 | MIT |
| [bybit](rules/bybit.json) | 16 | MIT |
| [claude](rules/claude.json) | 19 | MIT |
| [coolapk](rules/coolapk.json) | 3 | MIT |
| [cursor](rules/cursor.json) | 5 | MIT |
| [deezer](rules/deezer.json) | 2 | MIT |
| [discord](rules/discord.json) | 28 | MIT |
| [discovery](rules/discovery.json) | 3 | MIT |
| [docker](rules/docker.json) | 6 | MIT |
| [douban](rules/douban.json) | 3 | MIT |
| [douyin](rules/douyin.json) | 71 | MIT |
| [douyu](rules/douyu.json) | 7 | MIT |
| [dropbox](rules/dropbox.json) | 25 | MIT |
| [facebook](rules/facebook.json) | 397 | MIT |
| [five-itv](rules/five-itv.json) | 2 | GPL-2.0-only |
| [gemini](rules/gemini.json) | 49 | MIT |
| [github-copilot](rules/github-copilot.json) | 6 | MIT |
| [gitlab](rules/gitlab.json) | 5 | MIT |
| [global（可选）](rules/global.json) | 6,985 | GPL-2.0-only |
| [google-cn（可选）](rules/google-cn.json) | 124 | MIT |
| [groq](rules/groq.json) | 1 | MIT |
| [hbo-asia](rules/hbo-asia.json) | 19 | GPL-2.0-only |
| [heroku](rules/heroku.json) | 12 | MIT |
| [huggingface](rules/huggingface.json) | 3 | MIT |
| [hulu-jp](rules/hulu-jp.json) | 5 | GPL-2.0-only |
| [huya](rules/huya.json) | 2 | MIT |
| [icloud](rules/icloud.json) | 55 | MIT |
| [iqiyi](rules/iqiyi.json) | 20 | MIT |
| [jetbrains](rules/jetbrains.json) | 25 | MIT |
| [joox](rules/joox.json) | 1 | MIT |
| [kkbox](rules/kkbox.json) | 5 | MIT |
| [kktv](rules/kktv.json) | 3 | MIT |
| [line](rules/line.json) | 20 | MIT |
| [mozilla](rules/mozilla.json) | 77 | MIT |
| [mudvod](rules/mudvod.json) | 10 | MIT |
| [mytvsuper](rules/mytvsuper.json) | 1 | MIT |
| [netease-music](rules/netease-music.json) | 28 | GPL-2.0-only |
| [netflix](rules/netflix.json) | 24 | MIT |
| [niconico](rules/niconico.json) | 10 | MIT |
| [notion](rules/notion.json) | 7 | MIT |
| [npmjs](rules/npmjs.json) | 3 | MIT |
| [olevod](rules/olevod.json) | 9 | MIT |
| [onedrive](rules/onedrive.json) | 11 | MIT |
| [openai](rules/openai.json) | 24 | MIT |
| [oracle](rules/oracle.json) | 19 | MIT |
| [paypal](rules/paypal.json) | 245 | MIT |
| [perplexity](rules/perplexity.json) | 5 | MIT |
| [pikpak](rules/pikpak.json) | 7 | MIT |
| [poe](rules/poe.json) | 2 | MIT |
| [pornhub](rules/pornhub.json) | 9 | MIT |
| [pptv](rules/pptv.json) | 3 | MIT |
| [primevideo](rules/primevideo.json) | 24 | MIT |
| [qobuz](rules/qobuz.json) | 1 | MIT |
| [quark](rules/quark.json) | 3 | MIT |
| [signal](rules/signal.json) | 8 | MIT |
| [slack](rules/slack.json) | 11 | MIT |
| [soundcloud](rules/soundcloud.json) | 3 | MIT |
| [speedtest](rules/speedtest.json) | 20 | MIT |
| [spotify](rules/spotify.json) | 28 | MIT |
| [steam-cn](rules/steam-cn.json) | 17 | MIT |
| [taptap](rules/taptap.json) | 7 | MIT |
| [telegram](rules/telegram.json) | 21 | MIT |
| [terabox](rules/terabox.json) | 7 | MIT |
| [tidal](rules/tidal.json) | 3 | MIT |
| [tiktok](rules/tiktok.json) | 40 | MIT |
| [twitch](rules/twitch.json) | 35 | MIT |
| [vercel](rules/vercel.json) | 27 | MIT |
| [viu-portable](rules/viu-portable.json) | 6 | MIT |
| [wechat](rules/wechat.json) | 5 | MIT |
| [weibo](rules/weibo.json) | 6 | MIT |
| [whatsapp](rules/whatsapp.json) | 11 | MIT |
| [wikimedia](rules/wikimedia.json) | 18 | MIT |
| [xai](rules/xai.json) | 4 | MIT |
| [xiaohongshu](rules/xiaohongshu.json) | 12 | MIT |
| [ximalaya](rules/ximalaya.json) | 5 | MIT |
| [yandex](rules/yandex.json) | 157 | MIT |
| [youku](rules/youku.json) | 31 | MIT |
| [youtube](rules/youtube.json) | 178 | MIT |
| [z-library](rules/z-library.json) | 48 | MIT |
| [zoom](rules/zoom.json) | 3 | MIT |
| [hulu](rules/hulu.json) | 48 | MIT |
| [hbo](rules/hbo.json) | 65 | MIT |
| [steam](rules/steam.json) | 61 | MIT |
| [quora](rules/quora.json) | 6 | MIT |
| [twitter](rules/twitter.json) | 24 | MIT |
| [tvb](rules/tvb.json) | 14 | MIT |
| [disney](rules/disney.json) | 236 | MIT |
| [china-media](rules/china-media.json) | 297 | MIT |
| [hmt-media](rules/hmt-media.json) | 60 | MIT |
| [global-media](rules/global-media.json) | 704 | MIT |
| [amazon-portable](rules/amazon-portable.json) | 250 | MIT |
| [akamai](rules/akamai.json) | 81 | MIT |
| [alibaba](rules/alibaba.json) | 464 | MIT |
| [bytedance](rules/bytedance.json) | 960 | MIT |
| [netease](rules/netease.json) | 54 | MIT |
| [tencent](rules/tencent.json) | 700 | MIT |
| [apple](rules/apple.json) | 1,826 | MIT |
| [github](rules/github.json) | 65 | MIT |
| [google](rules/google.json) | 1,123 | MIT |
| [microsoft](rules/microsoft.json) | 760 | MIT |
| [china](rules/china.json) | 8,387 | MIT |
| [china-ipv4](rules/china-ipv4.json) | 6,174 | MIT |
| [china-ipv6](rules/china-ipv6.json) | 3,475 | MIT |
| [openai-regex](rules/openai-regex.json) | 1 | MIT |
| [google-regex](rules/google-regex.json) | 2 | MIT |
| [netflix-regex](rules/netflix-regex.json) | 4 | MIT |
| [speedtest-regex](rules/speedtest-regex.json) | 1 | MIT |
| [adblock-regex](rules/adblock-regex.json) | 1 | MIT |
| [china-regex](rules/china-regex.json) | 3 | MIT |
| [amazon-portable-regex](rules/amazon-portable-regex.json) | 3 | MIT |
| [viu-portable-regex](rules/viu-portable-regex.json) | 1 | MIT |
| [global-media-regex](rules/global-media-regex.json) | 5 | MIT |
| [hmt-media-regex](rules/hmt-media-regex.json) | 1 | MIT |
| [google-cn-regex（可选）](rules/google-cn-regex.json) | 2 | MIT |

## ASN、GeoIP、正则与白名单

此版本核心不支持原生 ASN 和 GeoIP 数据库条件；没有生成冒充二者的 CIDR 集合。 数据库更新方式见 [原生条件片段](fragments/native-routing.md)。数据库归属信息不保证物理位置，ASN 归属也不等于 IP 国家。

固定源的 24 个正则引用中，本客户端可无损表达 24 个，无法原生表达 0 个；正则资源与原服务同策略同优先级，google-cn 仍为可选。只有零未支持项才称本客户端源正则完整，详见[逐项覆盖](../../docs/coverage.md)。

Unbreak 是完整 50 条条件，保留精确域名/后缀/关键词语义；默认在广告规则之前按“规则修正”直连（standalone 策略名 unbreak），包含若干 Google 下载及推送域。可将该策略切到节点选择；三个原有连接探测域仍独立固定直连。此白名单会明确豁免其中的统计/广告样式域，并非隐私拦截集合。

## 可选功能

| 功能 | 实际入口/导入方式 |
| --- | --- |
| 可选反广告 | [fragments/anti-ad.json](fragments/anti-ad.json)；merge-fragment |

modules 保存脚本功能安装资源，rewrites 保存纯重写，fragments 需要手工合并。QX 的 modules/*.snippet 仍在 App 中按“重写资源”导入；Surge/SR 用各自模块入口，Loon 用插件，Egern 用模块，Stash 用覆写，不能混用相同扩展名推断兼容。

BoxJS、ScriptHub、Sub-Store 为明确可选的上游工具，脚本入口固定版本，GUI 导入未实测；BoxJS 会读写宿主脚本存储，转换工具会读取订阅/用户指定 URL。没有自动同步任务，也不会自动启用 MITM 或安装 CA。第三方脚本与前端的完整依赖树不全部固定，见[工具许可与边界](../../src/vendor/integrations/)。QX 资源解析器为本仓库原创实现，打包 YAML 依赖；Loon 解析器片段仍链接固定上游脚本，许可与权限单独登记。

Mihomo/sing-box 提供原生规则、DNS、节点与可选反广告；BoxJS 等 GUI 模块和 HTTP 重写不是这两个核心的能力。需要订阅转换时可另用 [Sub-Store 官方服务](https://github.com/sub-store-org/Sub-Store)，不要把 GUI 脚本格式塞进核心配置。QX 主配置已经接入自有资源解析器和中文 GeoIP；片段供既有配置手工合并。支持范围及严格拒绝项见功能说明，转换不会加载或执行订阅中的脚本。完整边界见[逐项覆盖](../../docs/coverage.md)与[功能说明](../../docs/features.md)。

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
