# Quantumult X

[主配置](profiles/default.conf) · [Raw 导入地址](https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/profiles/default.conf) · [详细接入](../../docs/profile-setup.md)

## 直接在客户端使用

导入主配置后，在节点页添加自己的节点或支持格式的订阅资源（[server_remote] 使用 opt-parser=true）。节点选择默认使用 App 内置 proxy；选择实际节点即可，自动/地区组按节点名称筛选。定位显示已接入。

首次使用需由客户端下载远程规则。主配置引用本客户端的 122 份规则资源（116 份公共规则、6 份原生条件补充），更新由客户端处理；主配置升级与规则刷新是两件事。没有私人节点，配置不会凭空提供代理服务。除 QX/SR 使用 App 内置节点选择外，无节点时节点选择保持 REJECT，导入后核对实际选择。

AI、苹果、谷歌、微软、开发、通讯、游戏、媒体与最终兜底可独立选策略；支持手选、自动选择及六地区测速组。地区名来自节点标签，不是 IP 定位结论；没有匹配节点时不要选择该组，不承诺空组自动回退。苹果服务初始直连，其余业务默认走节点选择。

DNS 按各客户端原生能力配置引导、直连/国内、代理目的地和 LAN 解析。LAN 规则不主动解析；CN IP 兜底允许解析。服务规则先于 CN 兜底。具体默认字段与客户端差异见详细接入。

## 独立分流

rules/ 按具体应用或服务 ID 平铺，可单独订阅；QX 资源的 force-policy 覆盖文件策略，其他客户端在主配置引用处指定策略。anti-AD 为可选的 100,682 条，不默认启用。

| 规则资源 | 条目 | 许可 |
| --- | ---: | --- |
| [lan](rules/lan.list) | 17 | MIT |
| [connectivity-probes](rules/connectivity-probes.list) | 3 | MIT |
| [unbreak](rules/unbreak.list) | 50 | GPL-2.0-only |
| [adblock](rules/adblock.list) | 904 | MIT |
| [abc](rules/abc.list) | 4 | MIT |
| [abema](rules/abema.list) | 21 | MIT |
| [acfun](rules/acfun.list) | 8 | MIT |
| [alipay](rules/alipay.list) | 11 | MIT |
| [all4](rules/all4.list) | 2 | GPL-2.0-only |
| [amap](rules/amap.list) | 16 | MIT |
| [android](rules/android.list) | 4 | MIT |
| [anti-ad（可选）](rules/anti-ad.list) | 100,682 | MIT |
| [apple-tvplus](rules/apple-tvplus.list) | 8 | MIT |
| [appstore](rules/appstore.list) | 26 | MIT |
| [baidu](rules/baidu.list) | 132 | MIT |
| [bilibili](rules/bilibili.list) | 53 | MIT |
| [blizzard](rules/blizzard.list) | 25 | MIT |
| [bybit](rules/bybit.list) | 22 | MIT |
| [claude](rules/claude.list) | 19 | MIT |
| [coolapk](rules/coolapk.list) | 3 | MIT |
| [cursor](rules/cursor.list) | 5 | MIT |
| [deezer](rules/deezer.list) | 2 | MIT |
| [discord](rules/discord.list) | 28 | MIT |
| [discovery](rules/discovery.list) | 3 | MIT |
| [docker](rules/docker.list) | 6 | MIT |
| [douban](rules/douban.list) | 3 | MIT |
| [douyin](rules/douyin.list) | 71 | MIT |
| [douyu](rules/douyu.list) | 7 | MIT |
| [dropbox](rules/dropbox.list) | 25 | MIT |
| [facebook](rules/facebook.list) | 397 | MIT |
| [five-itv](rules/five-itv.list) | 2 | GPL-2.0-only |
| [gemini](rules/gemini.list) | 49 | MIT |
| [github-copilot](rules/github-copilot.list) | 6 | MIT |
| [gitlab](rules/gitlab.list) | 5 | MIT |
| [global（可选）](rules/global.list) | 6,985 | GPL-2.0-only |
| [google-cn（可选）](rules/google-cn.list) | 124 | MIT |
| [groq](rules/groq.list) | 1 | MIT |
| [hbo-asia](rules/hbo-asia.list) | 19 | GPL-2.0-only |
| [heroku](rules/heroku.list) | 12 | MIT |
| [huggingface](rules/huggingface.list) | 3 | MIT |
| [hulu-jp](rules/hulu-jp.list) | 5 | GPL-2.0-only |
| [huya](rules/huya.list) | 2 | MIT |
| [icloud](rules/icloud.list) | 55 | MIT |
| [iqiyi](rules/iqiyi.list) | 20 | MIT |
| [jetbrains](rules/jetbrains.list) | 25 | MIT |
| [joox](rules/joox.list) | 1 | MIT |
| [kkbox](rules/kkbox.list) | 5 | MIT |
| [kktv](rules/kktv.list) | 3 | MIT |
| [line](rules/line.list) | 20 | MIT |
| [mozilla](rules/mozilla.list) | 77 | MIT |
| [mudvod](rules/mudvod.list) | 10 | MIT |
| [mytvsuper](rules/mytvsuper.list) | 1 | MIT |
| [netease-music](rules/netease-music.list) | 28 | GPL-2.0-only |
| [netflix](rules/netflix.list) | 24 | MIT |
| [niconico](rules/niconico.list) | 10 | MIT |
| [notion](rules/notion.list) | 7 | MIT |
| [npmjs](rules/npmjs.list) | 3 | MIT |
| [olevod](rules/olevod.list) | 9 | MIT |
| [onedrive](rules/onedrive.list) | 11 | MIT |
| [openai](rules/openai.list) | 24 | MIT |
| [oracle](rules/oracle.list) | 19 | MIT |
| [paypal](rules/paypal.list) | 245 | MIT |
| [perplexity](rules/perplexity.list) | 5 | MIT |
| [pikpak](rules/pikpak.list) | 7 | MIT |
| [poe](rules/poe.list) | 2 | MIT |
| [pornhub](rules/pornhub.list) | 9 | MIT |
| [pptv](rules/pptv.list) | 3 | MIT |
| [primevideo](rules/primevideo.list) | 24 | MIT |
| [qobuz](rules/qobuz.list) | 1 | MIT |
| [quark](rules/quark.list) | 3 | MIT |
| [signal](rules/signal.list) | 8 | MIT |
| [slack](rules/slack.list) | 11 | MIT |
| [soundcloud](rules/soundcloud.list) | 3 | MIT |
| [speedtest](rules/speedtest.list) | 20 | MIT |
| [spotify](rules/spotify.list) | 28 | MIT |
| [steam-cn](rules/steam-cn.list) | 17 | MIT |
| [taptap](rules/taptap.list) | 7 | MIT |
| [telegram](rules/telegram.list) | 21 | MIT |
| [terabox](rules/terabox.list) | 7 | MIT |
| [tidal](rules/tidal.list) | 3 | MIT |
| [tiktok](rules/tiktok.list) | 40 | MIT |
| [twitch](rules/twitch.list) | 35 | MIT |
| [vercel](rules/vercel.list) | 27 | MIT |
| [viu-portable](rules/viu-portable.list) | 6 | MIT |
| [wechat](rules/wechat.list) | 5 | MIT |
| [weibo](rules/weibo.list) | 6 | MIT |
| [whatsapp](rules/whatsapp.list) | 11 | MIT |
| [wikimedia](rules/wikimedia.list) | 18 | MIT |
| [xai](rules/xai.list) | 4 | MIT |
| [xiaohongshu](rules/xiaohongshu.list) | 12 | MIT |
| [ximalaya](rules/ximalaya.list) | 5 | MIT |
| [yandex](rules/yandex.list) | 157 | MIT |
| [youku](rules/youku.list) | 31 | MIT |
| [youtube](rules/youtube.list) | 178 | MIT |
| [z-library](rules/z-library.list) | 48 | MIT |
| [zoom](rules/zoom.list) | 3 | MIT |
| [hulu](rules/hulu.list) | 48 | MIT |
| [hbo](rules/hbo.list) | 65 | MIT |
| [steam](rules/steam.list) | 61 | MIT |
| [quora](rules/quora.list) | 6 | MIT |
| [twitter](rules/twitter.list) | 24 | MIT |
| [tvb](rules/tvb.list) | 14 | MIT |
| [disney](rules/disney.list) | 236 | MIT |
| [china-media](rules/china-media.list) | 297 | MIT |
| [hmt-media](rules/hmt-media.list) | 60 | MIT |
| [global-media](rules/global-media.list) | 704 | MIT |
| [amazon-portable](rules/amazon-portable.list) | 250 | MIT |
| [akamai](rules/akamai.list) | 81 | MIT |
| [alibaba](rules/alibaba.list) | 464 | MIT |
| [bytedance](rules/bytedance.list) | 960 | MIT |
| [netease](rules/netease.list) | 54 | MIT |
| [tencent](rules/tencent.list) | 700 | MIT |
| [apple](rules/apple.list) | 1,826 | MIT |
| [github](rules/github.list) | 65 | MIT |
| [google](rules/google.list) | 1,123 | MIT |
| [microsoft](rules/microsoft.list) | 760 | MIT |
| [china](rules/china.list) | 8,387 | MIT |
| [china-ipv4](rules/china-ipv4.list) | 6,174 | MIT |
| [china-ipv6](rules/china-ipv6.list) | 3,475 | MIT |
| [netflix-regex](rules/netflix-regex.list) | 8 | MIT |
| [china-regex](rules/china-regex.list) | 551 | MIT |
| [amazon-portable-regex](rules/amazon-portable-regex.list) | 950 | MIT |
| [global-media-regex](rules/global-media-regex.list) | 8 | MIT |
| [china-asn](rules/china-asn.list) | 5,231 | MIT |
| [geoip-cn](rules/geoip-cn.list) | 1 | MIT |

## ASN、GeoIP、正则与白名单

主配置和 standalone 已启用完整 5,231 个 ASN 编号匹配及 CN GeoIP 数据库条件，位于业务规则之后、静态 CN CIDR 之前。二者查询宿主真实数据库，不展开为国家 IP 集合。 数据库更新方式见 [原生条件片段](fragments/native-routing.conf)。数据库归属信息不保证物理位置，ASN 归属也不等于 IP 国家。

固定源的 24 个正则引用中，本客户端可无损表达 14 个，无法原生表达 10 个；正则资源与原服务同策略同优先级，google-cn 仍为可选。只有零未支持项才称本客户端源正则完整，详见[逐项覆盖](../../docs/coverage.md)。

Unbreak 是完整 50 条条件，保留精确域名/后缀/关键词语义；默认在广告规则之前按“规则修正”直连（standalone 策略名 unbreak），包含若干 Google 下载及推送域。可将该策略切到节点选择；三个原有连接探测域仍独立固定直连。此白名单会明确豁免其中的统计/广告样式域，并非隐私拦截集合。

## 可选功能

| 功能 | 实际入口/导入方式 |
| --- | --- |
| 出口定位 | [scripts/geoip.js](scripts/geoip.js) · [fragments/geoip.conf](fragments/geoip.conf)；general-fragment |
| Bing 搜索跳转 | [rewrites/search-redirect.snippet](rewrites/search-redirect.snippet)；rewrite-resource |
| 可选反广告 | [fragments/anti-ad.conf](fragments/anti-ad.conf)；merge-fragment |
| 六站 HTTPS 升级 | [rewrites/https-upgrade.snippet](rewrites/https-upgrade.snippet)；rewrite-resource |
| 47 项快速搜索 | [rewrites/quick-search.snippet](rewrites/quick-search.snippet)；rewrite-resource |
| 59 项网站重定向 | [rewrites/redirects.snippet](rewrites/redirects.snippet)；rewrite-resource |
| BiliIntl 菲律宾参数 | [rewrites/biliintl-region.snippet](rewrites/biliintl-region.snippet)；rewrite-resource |
| BoxJS | [modules/boxjs.snippet](modules/boxjs.snippet)；rewrite-resource |
| ScriptHub | [modules/script-hub.snippet](modules/script-hub.snippet)；rewrite-resource |
| Sub-Store | [modules/sub-store.snippet](modules/sub-store.snippet)；rewrite-resource |
| 资源解析器 | [scripts/resource-parser.js](scripts/resource-parser.js) · [fragments/resource-parser.conf](fragments/resource-parser.conf)；general-fragment |
| QX服务兼容补充（非无损） | [rules/openai-compat.list](rules/openai-compat.list) · [rules/viu-cdn-compat.list](rules/viu-cdn-compat.list) · [rewrites/speedtest-ads-http.snippet](rewrites/speedtest-ads-http.snippet) · [rewrites/speedtest-ads-https.snippet](rewrites/speedtest-ads-https.snippet) · [fragments/regex-compat.conf](fragments/regex-compat.conf)；optional-filter-resources-and-rewrites |
| app-exceptions | [rules/app-exceptions.list](rules/app-exceptions.list)；optional-filter-resource |
| wps-account | [rewrites/wps-account.snippet](rewrites/wps-account.snippet)；rewrite-resource |
| youtube-enhance | [scripts/youtube-request.js](scripts/youtube-request.js) · [scripts/youtube-response.js](scripts/youtube-response.js) · [rewrites/youtube-enhance.snippet](rewrites/youtube-enhance.snippet)；rewrite-resource |
| youtube-enhance-worker | [scripts/youtube-request-worker.js](scripts/youtube-request-worker.js) · [rewrites/youtube-enhance-worker.snippet](rewrites/youtube-enhance-worker.snippet)；explicit-worker-opt-in-rewrite-resource |
| qx-script-runtime | [scripts/compat-youtube-request.js](scripts/compat-youtube-request.js) · [scripts/compat-youtube-response.js](scripts/compat-youtube-response.js)；registered-static-script-runtime |
| qx-rewrite-actions | [scripts/rewrite-actions.js](scripts/rewrite-actions.js)；declarative-rewrite-runtime |

modules 保存脚本功能安装资源，rewrites 保存纯重写，fragments 需要手工合并。QX 的 modules/*.snippet 仍在 App 中按“重写资源”导入；Surge/SR 用各自模块入口，Loon 用插件，Egern 用模块，Stash 用覆写，不能混用相同扩展名推断兼容。

BoxJS、ScriptHub、Sub-Store 为明确可选的上游工具，脚本入口固定版本，GUI 导入未实测；BoxJS 会读写宿主脚本存储，转换工具会读取订阅/用户指定 URL。没有自动同步任务，也不会自动启用 MITM 或安装 CA。第三方脚本与前端的完整依赖树不全部固定，见[工具许可与边界](../../src/vendor/integrations/)。QX 资源解析器为本仓库原创实现，打包 YAML 依赖；Loon 解析器片段仍链接固定上游脚本，许可与权限单独登记。

Mihomo/sing-box 提供原生规则、DNS、节点与可选反广告；BoxJS 等 GUI 模块和 HTTP 重写不是这两个核心的能力。需要订阅转换时可另用 [Sub-Store 官方服务](https://github.com/sub-store-org/Sub-Store)，不要把 GUI 脚本格式塞进核心配置。QX 主配置已经接入自有资源解析器和中文 GeoIP；片段供既有配置手工合并。支持范围及严格拒绝项见功能说明，转换不会加载或执行订阅中的脚本。完整边界见[逐项覆盖](../../docs/coverage.md)与[功能说明](../../docs/features.md)。 两份服务兼容分流与HTTP/HTTPS广告资源均为独立可选，扩大范围、顺序和MITM前提见[QX接入说明](../../docs/qx-compatibility.md)，不计入14/24严格覆盖。

## 高级：离线配置或本地私有转换

[standalone.conf](profiles/standalone.conf) 内联全部默认规则，可作为不依赖远程规则资源的独立配置；业务选择沿用其服务 ID。它与主配置使用相同规范数据，规则更新需更新整个文件。

如需自动将私有节点/支持格式订阅展开到这份内联配置，可选用本地工具：

~~~sh
mkdir -p private
cp clients/quantumultX/profiles/input.example.json private/quantumultX.json
# 填入自己的 nodes 或 subscriptions。
npm run profile -- --client quantumultX --input private/quantumultX.json --output private/quantumultX.conf
~~~

这是高级可选流程，不是使用主配置的前提。私有输出权限 0600，private/ 已忽略。项目不改动你现用的 QX 或其他客户端配置。

来源、许可与验证边界见[构建清单](manifest.json)、[来源登记](../../metadata/profile-references.json)、[验证记录](../../docs/validation.md)及[第三方声明](../../THIRD_PARTY_NOTICES.md)。六个闭源 GUI 未实际导入，结构/引用检查不能代替原生运行。
