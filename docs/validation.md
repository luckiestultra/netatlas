# 完整配置验证记录

## QX 自有资源解析器与中文 GeoIP 显示

最终冻结输入 `62871f1c206fb7a8200a3bb330b5f80cc292f6b54e05f2d91cc3200685082bed`，289 个构建输入。离线测试 543 项：538 通过、0 失败、5 项显式原生 opt-in 跳过；另行执行的两个内核原生 308 个流量案例通过。八客户端 1137 个产物构建、无漂移检查、规则语义/配置引用/来源/哈希校验均通过。14 份非 QX default/standalone 与前提交逐字节相同；规则数据、14/24 严格正则覆盖和 10 个原生缺口没有改变。

QX 不再使用外部 KOP 解析器，默认配置与 standalone 接入本仓库原创脚本；节点、分流、重写与原生 helper 独立验证。YAML 2.9.1 为 ISC 依赖，完整许可内联；Loon 的固定 AGPL 外部入口保持独立。红队发现并修复安全字段被忽略、Surge VMess 默认握手/加密、重复 JSON 键覆盖 TLS、WSS 默认 Host/SNI 改义、别名冲突、TLS 总开关与 Reality/插件矛盾、同名节点误分派等问题。冻结后独立 13 项原问题与 9 项同类 TLS/协议反例闭环，官方 72 条节点字符串逐字节保留，21,024 项已登记正则到通配的语言比较通过；这些检查不等于真实远端 TLS 握手。

蓝队在 macOS 27.0.1 的真实 Apple JavaScriptCore 中执行最终压缩 bundle、独立提取的 helper 和 GeoIP 脚本，52/52 通过；禁用 Node/URL/Intl/网络/存储/eval，全资源失败只完成一次。镜像 baseURL 的 4 份自有脚本引用检查通过。最终 QX parser SHA-256 为 `b75090ddd4fd85638218b1289f8222cc72eabbaa9c8fae140d69dda73db79664`，GeoIP 为 `313c6144278a23aafb537523fad22630ce58a3a207ad41b884af826ae9a22eeb`，与生成产物一致。Apple JSC 不代表所有旧版 iOS 的兼容验证。

GeoIP 针对截图形状响应返回中文国家，并在 title/subtitle/ip/description 中保留完整 IP；常见城市/地区显示中文、未知地名保留原文、不推断缺失地点。CLDR 48 固定源 SHA、264 项投影与 Unicode-3.0 许可逐项独立核验。查询源仍为 ipwho.de；中文化不改变数据库的国家判断。原脚本已经返回 IP 字段，截图中原生 UI 未显示的确切原因未从用户私有配置取证，不把缓存猜测当作结论。

本轮没有读取或修改用户本地 QX 配置、节点、订阅、证书或系统设置。原生 QX GUI 导入、标题实际截断、设备流量及 MITM 未实机执行；52 项 JSC 和生成格式测试不能代替这些验证。证据在忽略目录 `.cache/parser-red-*`、`.cache/parser-blue-*`、`.cache/parser-final-*`、`.cache/geoip-*` 及 `.cache/native-check/latest.json`。

## QX 可选服务兼容补充

最终冻结输入`bcf1925523fa158d4ac5bb0e552f43e852a343f622efe31e3c45e5d143da0c0d`：466项离线测试（461通过、0失败、5项原生opt-in跳过），1136产物构建/语义/来源/引用校验通过。最后蓝方复验275输入、8份manifest与1127个产物哈希，合计1231项检查全部通过。

本轮在6c4d867之后提供2个独立的扩大范围分流、HTTP及单独HTTPS广告重写和1个手工片段，共5产物。默认/standalone均不引用，16份八端配置与前提交逐字节相同；严格覆盖14/24、10个未支持引用保持不变。扩大匹配、手工排序/关闭App分流匹配优化、HTTPS更宽的10个MITM掩码和人工CA前提均明确登记，未以此算作无损恢复。

红方发现直接renderer接收空baseUrl会产生null引用，加入失败先行测试后修复。相关features/provenance/兼容20项通过；红方独立70,001端口边界及Apple Foundation正则18个URL正反例通过，镜像完整构建1136产物通过。蓝方以独立Python oracle与fnmatch核验1,051,395条断言、两个协议所有0..65535端口及前导零、非法authority/仿冒主机边界、跨标签扩大、5产物hash、镜像URL和文档链接，全部通过。其他7客户端仅生成清单的输入摘要变化，未增加假QX功能。

本轮QX原生导入、实际匹配优化/排序和MITM未实机测试；Apple Foundation正则执行不等于QX完整宿主验证。没有改动本机QX或系统设置。证据位于忽略目录.cache/qx-compat-*和.cache/qx-blue-independent/。

## ASN、动态 GeoIP、源正则与完整 Unbreak 补齐

最终本地冻结输入 `8e6fb11a3cb682e8def873065fb045eaaaaeb084d91a02cc472e12647f221779`：460项离线测试（455通过、0失败、5项原生opt-in跳过），另行执行的原生308流量案例全部通过。构建及校验1131产物无漂移。独立蓝方核验273输入、8个manifest、1122产物字节和944规范源哈希，41,565项检查/1,826,048次语言比较、33项配置与DNS、564个额外内核边界案例、40项私有同ID保护与1281本地链接通过。红方两P2均复现修复并关闭。

本轮原生数据与公共五类型目录分开验收，不能以主配置变短、同名文件存在或静态国家网段代替语义完成。八端默认配置和 standalone 都实际接入各自支持的原生条件；完整支持范围见[八端支持表](coverage.md#原生条件的八端支持)。

- 来源：完整5,231个MIT源ASN编号与参考双向集合一致；Unbreak50个条件与参考双向一致（35精确域、14后缀、1关键词），48GPL+2原创MIT端点具有原文/SHA/Git blob/许可记录。原有3探针独立保留。24个源正则引用、13个不同表达式由8份固定原文逐行恢复，原生正则或经过证明的有限通配不改变域名/URL匹配层次。
- 原生：两固定内核检查4个完整配置，编译118个公共规则和11个sing-box原生正则补充；212个基础HTTP/SOCKS、8个MMDB、16个anti-AD、32个私有节点/DNS/订阅流程、40个完整远程管理流程，合计308个真实流量案例。
- 数据库：完整ASN与CN国家条件以真实Mihomo provider加载；受控MMDB四个版本通过3次原生热刷新和8次本地GET，证明ASN优先、国家命中、同时未命中、ASN不等于国家归属。人工数据库和回环HTTP用于确定性验证，不把结果声称为公网IP物理定位。其他运行目录预置受控MMDB缓存，避免公网上游数据库变化影响fixture。
- 精确边界：OpenAI/Netflix正则正反例实际流量验证；Unbreak `app.adjust.com` 优先于 `adjust.com` 广告规则，`ads.app.adjust.com` 仍被拒绝；后缀与 `wb_ad` 关键词各有实际命中。四角色DNS、节点与规则更新的旧检查继续保留。
- 红方发现的两处P2均有失败先行测试并修复：自定义镜像未传入原生片段；动态root元数据和静态regex registry可能不一致。独立完整镜像快照重建1131产物、重新注入能力变更后拒绝构建，均已复验。蓝方另发现Egern DNS不应引用IP-only资源，已按域名条件过滤，保留路由中ASN/GeoIP，19项相关回归通过。

来源同步重放为557个固定原始文件、2,838,674字节，结果changed:false。全量在线同步遇TLS超时，本轮改用已有且逐文件校验SHA的固定缓存重放；新增Direct.yaml本轮从GitHub实际获取并校验Git blob。没有把缓存重放称作全量实时联网验证。P3TERX两个真实数据库URL另行TLS GET并被Mihomo配置检查接受，不在版本固定规则统计中。

原生完整报告写入忽略目录 `.cache/native-check/latest.json`；本轮构建/离线/原生/红蓝复现日志均在 `.cache/native-completion-*`、`.cache/native-red-*` 与 `.cache/native-blue-*`。六GUI的原生导入、实际数据库UI刷新与MITM仍未实机执行；sing-box无原生ASN/GeoIP，QX/SR/Surge/Loon的剩余域名正则明确不支持，不计为完整。未改本机QX、系统代理、VPN、私人节点、订阅或证书。

蓝方另以真实mixed HTTP对大小写和尾根点作边界核验：sing-box 1.14.4会保留尾根点，源锚定正则可能因此不匹配；这与已规范化输入的表达式语言等价是不同层次。元数据和文档已明确收窄承诺，不虚构宿主自动去根点，也不将源正则放宽为可选尾点。


## 上一批（14a25ff）规则、重写、脚本与工具覆盖

上一批（14a25ff）本地检查：离线423项，419通过、0失败、4项显式原生opt-in跳过；原生套件另实际完成macOS ARM64的4份公开配置检查、117规则编译和192个HTTP/SOCKS路由案例（104基础含24关键词正反例、16anti-AD、32私有完整流程、40远程主配置流程）。两个内核各实际下载114份规则资源，规则刷新与Mihomo节点订阅替换均有真实HTTP/后续请求证据；没有启动公开TUN或修改用户应用。

独立BLUE最终复验936个规则文件、1037项产物完整哈希链及250个当前输入、136项配置路由与1177个本地文档链接；18工具包186个原生URL/固定脚本关系及自有脚本11个VM场景通过。RED关闭两项独立发现，BLUE关闭媒体父集优先级问题；本轮真正的GoogleCN路由回归由内核捕获，保留失败日志后将其改为可选，原预期不变并重跑通过。相关证据在忽略目录.cache/parity-final-*、.cache/parity-google-cn-regression.log、.cache/native-check/latest.json。Linux CI与公开字节在本次推送后按实际提交另验。


从主配置方式修正继续扩展到实质内容：117套规范规则、136,894条；默认114套、29,103条，anti-AD与global作为可选集合。八格式均保留独立规则、默认/standalone及来源许可。新增内容和110类逐项差异见[覆盖清单](coverage.md)。

独立来源核验包含106个DLC集合与六个GPL规则来源；关键词作为第五种真实匹配条件进入八种适配，未当作后缀近似。同步器对显式并集/精确token/区域属性/Hotstar有限展开和classical五类型来源分别验证，未知规则类型失败而非静默删除。全目录同步回放556次固定读取、2,830,258字节，changed:false。

新增47项六端快速搜索、59项六端跳转、两个BiliIntl功能（4模式）、18个外部工具安装包、QX/Loon外部解析器片段、原创Surge正文工具。RED复现并关闭ScriptHub嵌套type误选与搜索值进路径的编码问题，分别独立复验1182与1278例。BLUE抓到媒体聚合被腾讯/Akamai父集合先匹配，补失败用例并修正顺序；unbreak固定DIRECT且仅三个精确探测域名。

9个外部入口脚本均真实TLS GET、字节/SHA与node --check通过；未执行其JS或转换任务。主脚本、宿主GUI/MITM和所有前端/CDN组成的全依赖闭包仍区分记录。定位/正文只有本项目代码在内存VM执行；不把这些替代原生设备验证。


本记录优先列出八客户端 App 主配置修正的验证，随后保留高级内联配置的既有回归。公开配置、私有生成文件和受控测试配置分开记录；没有拿前一提交的 CI 绿灯代替本轮检查。

## 先前41组基线配置与来源

| 项目 | 内容 |
| --- | --- |
| 默认配置 | 8 客户端原生主配置，远程引用 40 组 / 23,476 条；另保留 standalone 内联版 |
| 完整规则目录 | 41 组 / 124,158 条，含可选 anti-AD 100,682 条 |
| 生成产物 | 八客户端主配置、standalone、独立规则、功能资源和私有高级输入示例 |
| CN 数据 | 域名8,387，IPv4 6,174，IPv6 3,475；固定MIT源 |
| 上游定点同步 | 519文件 / 2,506,997字节，dry-run changed:false |
| DNS 在线可达性 | AliDNS / Cloudflare IP DoH POST均200、rcode=0、A答案2；TLS验证开启 |
| Native 版本 | Mihomo 1.19.33 / sing-box 1.14.4，固定官方发行包SHA |

高星完整配置与官方资料交叉核对，来源的 star 快照、仓库活跃时间、实际文件提交时间和许可分别记录于 [profile-references.json](../metadata/profile-references.json)。没有复制无许可仓库脚本、规则、证书或转换器宏。CN来源详见[规则登记](../metadata/upstreams.json)；保留3条精确非可移植表达式，不宣称与完整原生 GeoSite 等价。

## 先前主配置方式修正

先前把逐条规则内联与私有编译器作为默认交付，无法反映用户在 App 中的日常接入流程。现改为原生主配置引用本客户端远程规则；保留中文业务选择、自动测速、六地区组、原生节点/订阅入口及 DNS；QX 使用内置 proxy 并接入 GeoIP，Shadowrocket 使用首页 PROXY。主配置不要求运行 npm，standalone 与私有工具只作为高级选项。

独立红方用官方 QX API、Surge policy including、Loon NameRegex、Egern DNS/policy、Stash rule-set/DNS 与固定内核资料交叉核验；发现并修正国家代码正则漏收 JP01/HK01、USAGE 误收美国、Surge 引号列表解析及 CN IP 资源不应 no-resolve 等问题。不能用 URL 200 代替内容或原生语义验证。

Mihomo/sing-box 新测试使用完整默认规则资源，通过实际 HTTP 下载而非改成内联规则。运行生产同一渲染器，显式替换回环节点、DNS、监听端口，关闭测试配置的 TUN；证明 HTTP/SOCKS 的 LAN、Apple、CN、AI、Google 服务优先与拦截行为，规则更新后后续请求改变、Mihomo 节点订阅 JP-A→JP-B。sing-box 核心没有订阅 provider，使用原生 outbounds；不冒称其存在该能力。

公开主配置包含原生 TUN，固定内核仅做 check/-t，不启动其 TUN。回环运行证据明确 captureTraffic:false，不能算设备 VPN 实测。其余六个客户端未做原生 GUI 导入；QX GeoIP 联网源与 VM 适配器契约通过，不等于 QX App 已实际运行。

先前主配置方式修正结果（不是本轮扩展执行结果）：`npm test` 共309项，305通过、0失败、4项显式native opt-in跳过；`npm run check` 验证八客户端389产物一致。原生套件另实际执行四份公开配置检查（两内核各managed/standalone）、41规则编译、80基础+16anti-AD+32高级私有+32远程主配置路由，共160例通过。远程规则和节点刷新有实际HTTP请求与后续流量证据。默认QX为105行、12,095字节；其standalone为23,548行。

独立蓝方另用手写解码器核对328份规则文件、993,264条跨客户端条目，与规范源等价；核对389项SHA/大小及733项本地资源和README链接。脚本用生成产物验证一次完成与明确策略，不把VM结果写成原生GUI实测。最终日志留在忽略目录 `.cache/managed-final-*`、`.cache/native-check/latest.json`；公开发布及GitHub CI在推送后按实际提交另验。

## 高级内联配置的独立流程与既有回归

八客户端都从私有 JSON 提供原生节点和/或来源，由同一 `npm run profile` 自动连接 Proxy。红方覆盖显式选择第二节点、各自原生订阅引用、DNS配置和规范分流，实际运行 CLI 成功/失败，核对私有输出0600、秘密不进日志、输入不覆盖和失败保留旧文件。

Mihomo/sing-box 使用固定真实内核执行生产生成路径：

~~~text
private/input.json → createPrivateProfile → 完整原生配置
                 → HTTP订阅 → 节点A → 实际请求
                 → A删除/B更新 → 实际请求
                 → bootstrap/local/domestic/remote DNS角色 → HTTP与SOCKS目标
~~~

这一流程保留全部23,476条生产规则和DNS路由，仅通过明确的私有参数将上游地址与监听端口换为回环fixture，不在生成后重写规则/策略/DNS来凑通过。代理节点主机名特意使用属于代理服务组的名称，证明引导解析不依赖自身代理。外国DNS返回文档公网地址，受控SOCKS只转发到回环服务；不会因为所有DNS都回答127而误走LAN直连。

提交版回归包含32个完整私有流程用例：LAN/国内域/服务代理/服务例外优先CN/广告/final，两个协议、两个内核；Mihomo实际HTTP provider A→B刷新并移除旧节点，sing-box实际HTTP拉取展开后刷新重启B节点，空订阅保留旧配置。报告包含公开与私有完整规则SHA、初始/刷新快照、DNS问题、来源请求及实际上游/目标次数。

另保留80个代表性路由和16个可选anti-AD用例，以及两份公开原配置检查、41个sing-box规则编译。这些补充测试各有明确目的，不能把80个代表用例描述成每条规则经过网络测试。

## 独立红蓝发现与修复

红方从用户流程独立写失败用例，蓝方另建fixture复现，不以直接运行实现者测试替代。主要闭环：

| 真实发现 | 修复与证据 |
| --- | --- |
| 节点参数被顶层render丢掉；校验器误拒INI/Egern合法节点、matcher-only组 | 参数透传、原生名称提取、动态来源识别；八客户端私有输入与实际选择回归 |
| 公共REJECT默认与私有实际选择混淆 | 模板默认拒绝契约与通用引用检查分开；本地节点默认/显式选择通过生成参数设置 |
| 空JSON来源可覆盖旧可用配置、脚本伪节点/坏端口可混入 | 空集合拒绝、网络协议/端口校验和有限可执行字段拒绝；软硬链接/并发编辑保护 |
| SS plugin、HY2混淆、VMess TCP header、SOCKS+TLS被静默简化 | 当前未实现的关键特征明确拒绝，要求原生outbounds；原输入/旧输出逐字节保留 |
| WS自定义Authorization被丢弃 | 保留完整合法headers/early-data字段；蓝方用真实sing-box连接要求鉴权的回环HTTP Upgrade服务复验，两来源路径均收到鉴权头 |
| Egern丢失服务DNS优先级，LAN/Apple/google.cn走错解析 | LAN优先、有序逐域forward，REJECT/默认DIRECT组/Proxy分别对应角色；蓝方9个first-match案例独立通过 |
| Mihomo DIRECT解析绕过policy；CN CIDR no-resolve导致兜底失效 | direct-nameserver-follow-policy；CN CIDR允许解析、LAN保留no-resolve；真实内核对临时旧行为变异能抓错 |
| sing-box全局bootstrap会绕过目的DNS分流 | 前置原生resolve动作尊重DNS规则，节点地址独立bootstrap；四角色实际请求和防循环证明 |
| 端口/provider数量早于Mihomo Running，产生502假象 | 官方post-up原子信号与实际provider数量双门禁，无固定sleep或目标请求重试 |

蓝方另外独立完成19项私有保护、32项跨客户端script/program变体、四类有损转换保护和WS网络复测，未操作用户应用。

## 先前内联版本的检查记录

先前内联批次结果（不是本轮远程主配置的执行结果）：离线278项（275通过、0失败、3项显式原生opt-in跳过）；原生套件另在macOS ARM64及隔离Linux x64实际执行，两平台均通过两套公开完整配置、41规则编译、80基础+16可选+32完整私有流程，共128路由用例；四个DNS角色及真实订阅更新有独立证据。公开实际输入SHA与最终成品匹配。对应GitHub CI与公开字节在本次提交推送后单独核对。机器证据保存于忽略目录 `.cache/complete-*` 和 `.cache/native-check/latest.json`；运行报告的输入SHA必须对应实际最终文件。不要把本记录的设计说明误读为尚未执行检查已通过。

## 明确的原生边界

用户确认没有额外GUI测试环境，并明确禁止修改本机现用QX。本轮没有导入、写入、替换或切换用户的QX配置，也没有改变节点/订阅/证书/VPN或系统代理。测试仅在仓库、忽略的private目录及独立CLI进程中进行。

QX、Surge、Loon、Shadowrocket、Egern、Stash缺少GUI原生运行证据，按用户要求用官方资料、高星维护完整配置和私有接入流程交叉核对。不会把这些结构/来源验证称作六个应用实机通过。保留客户端格式差异，不因缺少MITM/重写章节就判配置非法；可选功能需要用户主动启用。

## 复现

~~~sh
npm ci
npm test
npm run build
npm run check
npm run sync -- --dry-run
npm run test:native
~~~

完整私有节点/订阅/DNS的填写和支持范围见[接入说明](profile-setup.md)，来源许可见[第三方声明](../THIRD_PARTY_NOTICES.md)。
