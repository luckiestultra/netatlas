# 功能包规格

状态：已批准；实际产物与用法见 [可选功能](../features.md)，登记项见 [features.json](../../metadata/features.json)。

## 模块边界

src/features/ 按功能保存纯逻辑及明确的客户端适配器。tools/lib/features.mjs 导出 renderFeatures(client, {baseUrl})，返回相对于 clients/<client>/ 的 path、content 数组。

- scripts/ 放客户端可执行的 JavaScript。
- rewrites/ 放纯重写资源，即便其原生文件格式是 .sgmodule。
- modules/ 只放原生功能安装包；fragments/ 保存需要手工合并的配置片段。

metadata/features.json 记录用途、支持客户端、执行入口、数据源、MITM 范围、输出路径、官方依据和验证边界。没有实现的客户端返回空产物，不生成假兼容脚本。

## 已接入的第三方资源

anti-AD 固定 MIT 直接源提供 100,682 条后缀，单独生成八种规则与安装入口，默认不内联、不启用；源与伴随规则的集合双向一致，许可与聚合 credits 保留。原生模块、手工合并片段的界限按客户端逐一登记，不将 QX 或 Loon 的主配置节包装成未经证明的模块。

HTTPS-upgrade 为固定 GPL-2.0 原文的六主机投影，保留 path/query，不包含跨主机跳转、HTTP 降级、MITM、脚本、存储或后台请求。六个图形客户端按原生语法输出，Shadowrocket 仅手工合并；Loon 要求 3.5.1(978)+。投影必须与登记主机集合完全一致、不重复，原文行与 origin/destination 都需匹配，源路径不能规范化越出功能目录。原文、GPL 许可、NOTICE 与 SHA 一并保留，不改标 MIT。

第三方包的根许可和星标不代替依赖审查；若编译 bundle 的对应源码不可读取、混合许可闭包未清或存储权限过宽，保持未接入状态。GUI 语法依据、文本和 VM 检查不能冒称真实应用已导入。

## GeoIP 行为

共享纯核心 src/features/geoip/core.mjs 支持 ipwho.is、IPinfo legacy/Lite、ipwho.de、ip-api 响应格式。外部字段必须校验类型；空 ASN、空组织、无城市、无数据、错误 JSON、API 错误状态、限流和传输超时不得导致未完成回调。

结果保留来源给出的地理信息，不推断物理机房，不硬编码某国或某个用户 IP，不填入虚构城市或运营商。QX显示按源国家代码使用固定Unicode CLDR 48中文国家/地区名称，原始provider字段不改；正常 title 仅显示国旗、国家和实际地区/城市，不重复 IP；subtitle、ip、description 保留完整源 IP。第二行压缩组织名以优先保留 ASN/IP，长 IPv6 可独占第二行；完整字段保留在 description 中，不据此声称原生卡片会显示这些字段。地区短名和去重仅作用于显示，蓝色星标由 QX 原生决定。CLDR数据采用Unicode-3.0许可，固定版本、原文哈希与完整许可分别保留在localization目录；生成脚本带完整Unicode许可。收到响应、定位成功和网络整体正常是不同事实。VM验证不等于原生QX界面截图或设备实测。

QX 原生适配器只解析 $response，不再联网或更改节点。默认 HTTP 查询使用 ipwho.is 的 lang=zh-CN 响应，保留省州、城市、时区、连接 ASN 和组织；只有布尔 success=true 才接受成功数据。输出保留完整 IP，缺失字段不推断，不在脚本里自动轮询或切换来源。生成的 fragments/geoip.conf 是 [general] 合并片段，不是重写订阅；它的脚本 URL 只有对应文件推送到公开提交后才能使用。 QX 主配置与片段统一引用普通 `main/.../geoip.js`，不附加版本摘要、短版本号、时间戳或片段参数。脚本更新由 QX 资源刷新处理，成功下载后才能在后续定位检查中使用新代码；仓库推送不强制清空客户端已有缓存。

Surge generic 面板的一次查询明确指定已有策略名，发布模块默认节点选择。该选项只影响本次查询，不切换策略组、不读取账户偏好，也不代表其他请求采用相同路由。请求、看门狗和晚响应共用一次完成保护。

## 诊断与重写

诊断纯函数只报告响应是否收到、超时或传输失败；显式联网工具负责请求，并避免打印或保存真实出口 IP。

当前原生搜索重定向只输出 QX 与 Surge 版本，默认不启用。重写规则保存编码后的搜索词，只处理文档约定的 URL 形式，并限制 MITM hostname。没有客户端依据的入口不输出可安装文件。

## 验证

~~~sh
npm run test:scripts
npm run test:live
~~~

离线测试覆盖保留地址样本和异常分支；VM 执行生成的原生适配器检查完成契约。实时 API 检查单独运行并有超时，不进入离线 CI 的稳定断言。VM 通过不能标记为应用内实测，当前原生应用功能验证状态保留 not-run。

新增请求目的地、持久存储、MITM 范围或宿主 API 时更新功能清单与对应测试；不自动修改用户正在运行的客户端。

## 完整可选资源

本轮增加原创47动作快速搜索、固定GPL完整59动作跳转与独立BiliIntl参数资源（六GUI）；三类官方工具18个可选安装包；原创QX资源解析器及Loon外部解析器片段；原创Surge正文替换。安装格式、许可、入口权限、直接依赖固定范围和nativeApp:not-run分别登记，不以核心不支持的格式伪造Mihomo/sing-box模块。完整机器清单为metadata/features.json、metadata/integrations.json、metadata/resource-parsers.json和metadata/coverage.json。

## QX 资源解析器

QX的`resource_parser_url`指向本仓库的`scripts/resource-parser.js`，源码入口为`src/features/resource-parser/entry.mjs`。构建为不依赖Node、浏览器DOM、URL、Buffer、atob或TextDecoder全局的浏览器IIFE，包含MIT原创代码和yaml 2.9.1 ISC许可。`fragments/resource-parser.conf`只合并`[general]`；本仓库QX配置默认启用，Loon外部解析器仍可选。六个其他客户端不输出未有原生依据的解析器设置。

宿主输入为`$resource.content`、可选`link`和字符串`type`；每次转换完整校验后调用一次`$done({content})`，失败只返回受控、不含原文的`$done({error})`；整段脚本的最终求值也必须是同一结果对象，不能只检查回调副作用。不输出部分结果或自动降级。未知数字type不猜测含义。解析器不联网、不持久化、不执行订阅中的脚本或自定义表达式、不请求原生UA重试、不更改运行中配置。生成资源可以包含经验证的HTTPS脚本引用，但安装后由QX执行该脚本不在解析器离线权限承诺之内。

支持已实现的节点URI/原生节点/Clash YAML与sing-box JSON节点字段，严格处理TLS与传输；不支持的协议、传输、mux、未知参数、无法表达的字段或名称冲突导致整份订阅失败。规则支持QX原生及已登记的classical类型、Surge DOMAIN-SET、Clash payload和sing-box headless地址条件。Surge DOMAIN-SET的`.domain`包含根域；Clash的`.domain`排除根域，`+.domain`包含根域；Clash单标签通配不能放大为QX跨点通配。Clash域名payload必须显式`domain-mode=exact`，suffix模式冲突报错。任意新DOMAIN-REGEX、端口/进程/逻辑AND与其他附加条件不得丢弃或转成更宽集合。

`no-resolve`没有在已查证QX接口中找到等价字段，默认报错；仅显式`allow-resolve=1`移除并在结果注释中标出DNS行为变化。`policy`是显式覆盖所有源策略的操作，也必须输出提示。正则只对已登记的确切表达式生成经过证明的通配或有限枚举；其他表达式整资源失败，不冒称完整正则支持。

重写支持QX原生已实现动作、Surge/Loon 302/307跳转和可等价的Loon响应体拒绝动作；不同reject语义、header URL替换、未实现的重写DSL、CA/证书设置、本地脚本路径及其他功能段报错。跨宿主Script转换必须显式`script-compat=qx`声明脚本本体已经支持QX，只有可表达字段能转换；该声明不翻译JavaScript宿主API，也不允许忽略timeout、argument、binary-body或max-size等字段。

helper的三个`$parser`函数按固定官方协议独立可提取；哈希参数只做声明式类型/格式/策略选择与字面名称处理，未知或重复参数不自动忽略。测试必须执行真实生成bundle的节点、规则、重写、错误回调及helper契约；VM测试不宣称QX设备导入成功。用户本地QX配置不得用于测试或被修改。

## QX 正则缺口的可选兼容处理

严格源正则覆盖保持14/24，不给兼容资源计无损覆盖。两个独立原生分流资源只解决ChatGPT Azure端点与ViuTV/Now E CDN的实际策略归类，明确额外匹配非数字及可能跨标签主机名，默认/standalone均不启用。接入片段要求手工前置资源、选择正确业务策略并关闭App分流匹配优化；不编造配置字段或改本机设置。Google已有普通后缀覆盖，不新增近似的CN直连集合。

Speedtest广告只提供独立HTTP及HTTPS重写，保留源主机名正则、完整authority边界和有效端口；HTTP版无MITM，HTTPS版单独列出所需hostname与人工CA信任前提，不能算作DNS、UDP、HTTP/3或任意TCP域名规则恢复。无脚本、证书、私人节点、定时任务或自动启用。源表达式、扩大范围反例、默认关闭、策略/顺序和逐URL正反例必须测试，六GUI实测边界继续保留。
