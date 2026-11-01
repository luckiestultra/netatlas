# 完整配置验证记录

## 2026-11-02：实际失败源中的 Reality ML-KEM 字段

用户授权只读查看当前订阅错误后，界面显示四条资源为 `unsupported field in URI options: [unrecognized name]`。随后用户明确允许只读请求其中一条原有订阅一次。该请求保持 TLS 证书验证、不跟随重定向，返回 HTTP 200；原文只在进程内存处理，不输出或落盘节点、地址、UUID、密码、密钥、令牌，公开回归中没有私源内容。

这次返回的编码订阅中只有一个被本解析器拒绝的 URI 参数名：`support-x25519mlkem768`，值非空。对同一返回内容在内存中仅移除这一字段后，转换成功，故已确认这一条的解析阻塞点；未访问其他失败资源。原文随后销毁，没有在修复后再次请求、保存或重放实际返回内容。

[3x-ui 固定源码](https://github.com/MHSanaei/3x-ui/blob/1a5100ea166361cc2a01d8f245d616fb18baa0dd/internal/sub/service.go#L1243)在 Reality 分支无条件生成该字段的标准 `true` 值，相关 PR 为 [#6712](https://github.com/MHSanaei/3x-ui/pull/6712)。[QX 官方配置说明](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf#L163-L164)及[原生指纹](https://github.com/crossutility/Quantumult-X/blob/master/ios26-safari-fingerprint.txt#L129)表明当前原生 Reality 握手提供 X25519MLKEM768 supported group 和 key share。因此修复是识别当前原生已具备的正值能力提示，不生成虚构 QX 参数，也不把算法协商结果当作已测试事实；需要具备该原生握手能力的 QX 版本。

URI 只在 security=reality 时接受字符串 true/1；Clash VMess/VLESS 的 nested reality-opts 在 TLS 开启时可接受 true、1、"true"、"1"。false/0/空/无效值、非 Reality、顶层错放、原生 QX、sing-box、SIP008 v1（含缺 id 的 VLESS 绕入路径）仍拒绝。pqv/签名、证书 pin、UUID、pubkey/sid、flow、path、现有 TFO/ALPN/证书验证不被丢弃或改变。只发布固定 metadata 和无源值的能力说明；输入对象不变，失败不发布前半份结果或说明。

新增节点10组回归在旧实现全部失败，core整份Base64/Clash正值集成2项先失败，严格负例继续通过。SIP008缺id的具体路径另先复现误接受后补排除guard，保持原有无hint语义不变。修复后相关89项通过，解析器专项175项通过；完整 `npm test` 723项，715通过、0失败、8项原生opt-in跳过。独立红方38项定向与210项合成检查通过，删除Reality前提与删除仅正值guard两项变异均被真实回归捕获。

最终生成脚本在真实 Apple JavaScriptCore 中359/359通过（342资源、17独立抽取helper），另18/18源码模块契约通过，共377项；此前293基线完全保留。覆盖整个编码订阅、公开标准true字段结构、错误类型/空/控制字符、精确格式边界、输入深冻结、metadata去重和失败原子性、固定注释顺序及字段值不泄漏。无网络/存储/eval探针与5个负控保持。测试夹具使用公开上游标准值与合成凭据，不声称已验证用户QX导入、实际TLS协商或旧版QX SDK能力。

`npm run check` 验证8客户端1137产物无漂移及语义/引用/来源/哈希。冻结输入 `333630e0f3dd3a34fd157b9c95c0c6956e9933fb5fa05ca15251f4f792431d15`（296文件）；QX解析器 SHA-256 `cebb21a74fc1c296fe15c9435adf3aae8d33153f185c48df6270d7d4feb537d6`。非清单成品仅QX解析器变化；GeoIP、配置、规则和其他客户端保持字节不变，普通main链接不变。公开字节和Linux CI按推送后提交另核验。本轮对QX仅作只读导航，没有更新资源、修改配置或切换节点/连接。

## 2026-11-02：已登记客户端偏好使用 QX 原生行为

用户在旧 KOP 同输入对照后委托选择简单可用的方式。本次仅对已复现的三个客户端偏好采用 QX 原生行为：VLESS/Trojan/HTTP(S)/SOCKS/AnyTLS URI 的 fp/spx、VMess JSON 的 fp、Clash样式节点对象的 client-fingerprint。输出固定注释说明原生指纹与 spx 省略，不回显源值，不宣称保留 Chrome 指纹，不新增资源参数或模式开关。SS/SSR URI、原生QX字段、显式sing-box与SIP008 v1不套用该处理；证书pin、未知参数、真实path/host、地址、UUID、公钥、short-id、flow和TLS校验规则不被放宽。

适配只在副本上删除有界字符串；每个中间节点仅记录固定枚举元数据。全部节点及重名校验通过后才汇总到内部Set，core在名称变换与筛选成功后添加说明，info通知仍只处理原生节点。无效源、全部筛空、改名错误、未知资源选项均只返回一次错误，不泄露说明或成功通知。通用Clash样式对象保留原有数组/nodes/旧servers接入；独立红方发现SIP008缺id路径也需显式排除，补RED后修复，带/不带id均保持该边界。

新增节点9项回归最初7失败/2既有正例通过，core集成4项最初3失败/1严格负例通过；修复后相关76项通过。最终解析器专项162项通过；完整 `npm test` 710项，702通过、0失败、8项原生opt-in跳过。独立红方52项定向及82个合成挑战通过，去掉控制字符guard、去掉SIP008排除guard两种临时副本变异均被真实回归检出。证书fingerprint/pin、sing-box utls和任意未知字段继续拒绝；同输入删除这三个偏好后的既有NetAtlas结果，与适配后连接字段一致。

最终生成bundle在真实Apple JavaScriptCore中286/286通过（269资源、17独立抽取helper），另7/7测试专用源码模块契约通过；此前228个基线只调整6个已授权行为预期，其余严格和隐私预期保持。覆盖边界长度、C0/C1/U2028/U2029、类型、空值、固定注释、源对象深冻结不变、失败Set不发布、WS Host/path/ALPN/证书验证不变，以及每资源单次完成与最终同对象；网络、存储、eval禁用探针及5个负控保持。未执行用户QX或真实订阅连接，不将这些结果当成其四条订阅已实测成功。

冻结输入 `ee30273c07b2d811352526d73fd45d29844a3397be5b6938911ba6916cf63941`（296个输入文件）；QX解析器 SHA-256 `36374f5f3631c8869e0ddec4c542e77ddd76cb131daf219014630e250c309730`。完整测试后只把来源清单中的URI类型文字写具体，相关清单/原生偏好21项再次通过，最终脚本字节与293项JSC目标完全相同。除构建身份清单外，仅QX解析器成品变化；GeoIP保持前一提交的IP优先布局，主配置、片段、规则和其他客户端内容不变，普通main链接不变。最终 `npm run check` 再次通过8客户端1137产物及完整语义/引用/来源/哈希检查；公开字节与Linux CI按推送后的提交另核验。

## 2026-11-02：旧脚本同输入对照、GeoIP 宽度与安全字段诊断

用户截图显示 GeoIP 的副标题末尾 IP 被原生标签省略，四条订阅同时报 `Node conversion failed: unsupported field`。未请求截图订阅或真实 IP。用户提供的是转换后的原生 VLESS 行；用相同字段结构、合成地址/凭据及精确 `#info=1&out=套餐+重置&emoji=2` 参数验证，该结构在旧 KOP 和本仓库均成功，不能据此推断这次订阅下载的原始内容。

对照原作者公开源码，在真实 Apple JavaScriptCore 执行 12 组旧/新解析器同输入测试（24次执行）：基础 VLESS URI、用户原生结构、套餐伪节点筛选两边均成功；URI 的 fp/spx、Clash client-fingerprint 在 KOP 中被省去，本仓库则按严格校验拒绝，能复现截图同文错误。KOP 对任意未知键和非 vision flow 也可能直接丢弃，不据此放宽全部连接字段。官方 QX [指纹说明](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf#L162-L164) 表明 Reality 使用原生 Safari 指纹，不能将忽略 Chrome 偏好称为无损保留。线上 KOP 源 SHA-256 为 `1315ad57a31a2431a9fdf3d9fa0c892f7e91b9fa74f1c81bdaac04d521817b67`。这些是已复现的格式差异，实际订阅究竟是哪一个字段导致失败仍未取得证据；本次发布不改变字段接受策略。

GeoIP 对照 [旧 IP-API.js](https://github.com/I-am-R-E/Functional-Store-Hub/blob/6ddebd526ed0a7598bd2def84452b76d85fcf1ba/GeoLocationChecker/QuantumultX/IP-API.js)，20个合成响应、两版本、两种完成模式共80次 JSC执行。旧运营商信息仅在 description，其副标题部分地名取自时区。此前本仓库把运营商插入36字符预算，字符数无法代表原生像素宽度；本次只显示 ASN 与完整 IP，组织保留详情，长 IPv6 独占行。源位置/ASN/IP数据和 Surge 输出保持不变，不借时区或节点名称猜城市。旧脚本 SHA-256 为 `42587f7139ae2c3b59fd83d2b8ec2e3898ab20d12bebadea70305e8e5b077d02`。

字段诊断现在给出固定来源上下文与登记的公共字段名，例如 `unsupported field in URI options: fp`、`unsupported field in sing-box TLS: utls`；任意未知key只显示 `[unrecognized name]`，所有值、订阅URL、地址、UUID、密钥和标签均不回显。先记录8项新诊断回归的旧实现7失败/1原生正例通过，再修复；GeoIP新布局回归同样先在旧实现失败。正常转换、接受范围、严格拒绝与单次完成保持。

最终完整 `npm test` 697项：689通过、0失败、8项原生 opt-in跳过；190项 GeoIP/解析器定向检查通过。独立红方对诊断做285组旧新差异检查，接受范围和有效输出不变，泄露原始key的隔离变异被2项隐私测试检出；GeoIP另有240个成功输入与10个错误输入的源数据/Surge/非subtitle输出相等，以及20个生成脚本身份测试。最终实际生成脚本在 Apple JavaScriptCore 中解析器228/228（211资源+17独立抽取helper）、GeoIP8/8通过；不冒充QX设备导入、真实订阅连接或原生像素测量。此次没有本机重跑内核流量套件，连接生成逻辑未改；Linux CI按推送提交另核验。

`npm run check` 验证8客户端1137个产物无漂移，语义、引用、来源和哈希通过。冻结输入 `c702545c51dd9d4561b8cb7caeb622ed50fcab8f61b86812ac4c31627eee8ce1`（296个输入文件）。非清单成品仅 QX GeoIP、嵌入同一核心的 Surge GeoIP和 QX解析器变化，主配置/片段/规则及其余客户端内容不变。普通main链接不变，没有新参数开关、版本摘要、命令修改缓存或对用户QX的读写。

产物 SHA-256：`clients/quantumultX/scripts/geoip.js` = `3388a934e49ac807ad0d9f981e0c40e1377435d4268397f31aca460298800aad`；`clients/quantumultX/scripts/resource-parser.js` = `8892c7fd2bfeaf64101e3fa75fa90a28cf072bc5f7c62eab43930431309f1c43`。

## 2026-11-01：QX 资源解析器审计与常用参数完善

修复本轮九项审计问题，保持原子转换，不用筛选掩盖不支持的来源语义。实现及参数表见 [功能说明](features.md#资源解析器与正文替换)，来源、权限和未实现项见 [机器清单](../metadata/resource-parsers.json)。

| 审计问题 | 修复与验证 |
| --- | --- |
| 条件/执行指令被当注释丢弃 | 节点、分流和重写拒绝 include、requirement、system 与平台限定指令，包括其他配置节内的指令；普通注释与引号边界独立处理。 |
| sing-box UoT 协议及缺省值 | true 对应 QX sp.v2，对象 omitted enabled 保持关闭；未知 enabled/version 错误路径保留。 |
| 旧全文 Base64 SS 密码二次解码 | 保留字面百分号，区分原始 URI userinfo 与 Base64 编码层次；包含真实认证正负控。 |
| Clash VMess/VLESS WSS Host/SNI/ALPN | 按固定源实现使用 Host 补缺省 SNI、HTTP/1.1 ALPN；无法保留的分离名称及 WS+Reality 组合拒绝，其他源/TCP 的既有语义保留。 |
| Surge // 行内注释进入策略名 | 在引号外按边界裁注释；不把普通策略注释带入 QX。 |
| 未锚定 URL 重写被识别为节点 | 正确识别 URL rewrite 行；保留显式类型优先。 |
| [hH] 开头的正则被送入 YAML | 识别重写语法，显式 rewrite 不先解析 YAML。 |
| 印尼/Indiana 误标印度旗 | 地名优先最长匹配，英文词界校验；未知地名不假装为出口定位。 |
| 大写 TAG 伪节点信息漏读 | 大小写均提取受限用量/有效日期，通知仍不含凭据、URL 或任意标签。 |

常用参数只有一套直接写法：in/out 的 OR/AND、转义和大小写，分流/重写正文筛选与独立 hostname 筛选，顺序字面 rename、sort/type 常用别名，本地文件首行参数与显式片段优先级均已实现；没有兼容模式开关。用户原 `#info=1&out=套餐+重置&emoji=2` 保留。合法 GEOIP 类别需要所用数据库确实包含相应数据；不等价内置策略默认报错，只有显式 policy 覆盖后放行。reg/regout、sfilter/srename、任意代码和连接覆盖参数仍明确不支持。

新增39项回归，故障切片先记录旧实现失败，再验证修复结果。独立红方补出并关闭节点名称含 url、重写目标 fragment 误抢类型、节点指令漏校验与原生普通注释截断凭据等问题，最终28个独立源码/bundle探针及8项定向复验通过；隔离重引入 SS 密码二次解码、UoT 缺省开启、提前过滤坏规则三种变异，全部被测试检出。普通原生 password/username/tag 中 //、#、; 及 URI fragment 保留，不能静默改凭据。

独立蓝方在真实 Apple JavaScriptCore 中执行最终生成脚本：183个合成资源案例与17个从生成 bundle 独立抽取的 helper 案例，共200/200通过。每个资源均只调用一次 $done，最终求值为同一结果对象；网络、存储、eval/Function 探针未触发，5个负控确认探针有效。首轮3个测试预期过严已保留记录并修正为语义断言，没有修改产品代码掩盖结果。

完整 `npm test` 共688项：680通过、0失败、8项原生 opt-in 跳过。`npm run test:native` 另实际通过 Darwin/arm64 的328个案例，包括两种最终 QX bundle 生成的 SS 字段接入本地原生 sing-box，完成认证并取得 HTTP 200；重现旧解码得到的错密码被拒绝且目标请求数不增加。其余既有原生路由、DNS、动态 GeoIP/ASN、订阅 TLS 和更新流程全部通过。测试只使用 127.0.0.1 合成服务，不更改系统代理或 TUN；该认证证明不能冒充 QX GUI 导入。

`npm run check` 验证八客户端1137个产物无漂移及语义、策略引用、来源和哈希。冻结输入 `da95fc6b4a2b35738b3be1bde6bbd4c76e36347d0f81d6e13d187d9b8d7b0daf`，296个输入文件；QX parser SHA-256 `75faf8763204dc72bb6a75bb0ead7b7b74055c00827226dd79cdbdafc4aec57d`。除构建身份清单外，仅 QX 解析器成品变化；GeoIP、主配置、片段、规则及其他七客户端成品逐字节不变。普通 main URL 不变，不添加版本参数或固定提交。

本轮未读取、启动或修改用户本地 QX、配置、缓存、节点、真实订阅及连接状态。QX App 实际导入仍未运行；公开 main 字节与 Linux CI 按推送后的实际提交单独核验。原有 main 用户按 App 正常脚本资源更新使用，不要求命令修改缓存，也不承诺 GitHub 推送立即清除客户端缓存。

## 2026-11-01：既有 QX 订阅 info/emoji 参数兼容

用户报告多个订阅出现 `Resource parser options: invalid parameters`，随后提供不含订阅凭据的准确 fragment：`#info=1&out=套餐+重置&emoji=2`。旧版严格白名单只支持 out，缺少 info 与 emoji，导致进入节点转换前整份失败。已用合成订阅和真实旧产物复现同一错误；没有读取、请求或保存用户订阅内容。

参考公开 KOP 参数文档及其原始实现的接口行为，原创补齐 info=0/1 与 emoji=0/1/2/-1；不复制第三方实现，也不忽略参数。out 保持现有名称字面 OR 排除；emoji 仅修饰名称，模式2为国行显示模式；info 成功后只通知已有用量数字与有效到期日期，header 优先，无 header 时从过滤前伪节点取受限字段。未知名称保留既有旗，无旗时用海盗旗；有限地名词表不是完整 KOP 别名集，更不代表 IP 定位。其他未知或无效参数继续拒绝。通知 API 缺失/抛错不损坏有效转换，转换失败不通知或输出半份内容，$done 始终一次且整段返回同一对象。权限登记与 helper 同步更新，TLS、Reality、凭据及下载/存储禁令不变。

首次新增10项回归在修复前9失败、1通过，失败包含精确 fragment、标记行为、通知与 helper。修复后新增13项全部通过；解析器专项102项通过。独立红方另写33项完整bundle/抽取helper探针通过；忽略info的隔离变异使5/13失败，忽略emoji使10/13失败，能抓住仅放行而不执行的假修复。最终实际生成脚本在 Apple JavaScriptCore 中10/10通过，包含精确参数、缺失/异常通知、伪节点、坏信息、原子失败和helper单独加载。

完整 `npm test` 共649项：641通过、0失败、8项原生opt-in跳过；`npm run check` 验证八客户端1137产物无漂移及语义、引用、来源、哈希。冻结输入 `4ec40519a21ea51a2bd8ea655b42912ddd9ebaf72845c0757cf7ec2147553123`，QX parser SHA-256 `8a9acb3940b30ba495aeb81dfcefa6c709962625de2ac7d145fa6bc60d836398`。除构建清单外，仅QX资源解析器成品变化；GeoIP、主配置、片段、分流及其他七客户端成品逐字节不变。公开 main 字节及 Linux CI 在推送后按实际提交另核验。

本轮只使用保留域名、合成凭据与元数据，未读取或操作用户 QX、配置、缓存、节点、订阅、连接或系统设置。JSC/VM与本机回归不等于QX实际订阅导入；未将用户截图错误以外的真实节点内容宣称验证通过。用户原fragment可保留，常规脚本资源更新后使用修复版，不要求命令修改缓存。


## 2026-11-01：QX GeoIP 紧凑地点布局

用户自行备份替换已确认的历史故障缓存后，提供的截图已显示中文地点及完整 IP；此次按其版式反馈去掉标题内重复 IP，标题改为国旗、国家和实际地区/城市。同名地点去重，已登记地区使用短名；第二行优先 ASN 和完整 IP，组织名按剩余文本预算缩略，长 IPv6 可独占第二行。完整字段仍保留在 description 输出中，不保证原生界面展示该字段。蓝色星标由 QX 原生添加，脚本不造星或推断缺失地点。

新增六项布局回归在旧实现上全部失败，修复后通过；独立红方发现 emoji 裁剪保护缺少精确测试，补入第七项，删除保护的隔离变异会失败。完整 `npm test` 共 636 项：628 通过、0 失败、8 项原生 opt-in 跳过。52 项 GeoIP/适配器/交付针对性测试及 Apple JavaScriptCore 的 8 个完整生成脚本案例通过，后者验证最终求值对象身份与一次完成。独立红方 306 组 ASN/IP/emoji 边界检查通过；IP 回塞标题、IPv6 截断、代理对保护删除的针对性变异均被对应回归检出。手动更新工具只用临时文件验证备份、原子发布、拒绝陌生内容及保护符号链接等 7 项，不对用户缓存运行。

`npm run check` 验证八客户端 1137 个产物无漂移及语义、引用、来源、哈希。冻结输入 `4af3aa1dc02c3f56a134aff4e511964fd295b50d1116014ec840c91cf450dd68`，QX GeoIP SHA-256 `037085794011948530507217e2afcdd5971fc9a64116c9ac82c57c79db1f929a`。非清单成品仅 QX/Surge 两份 GeoIP 脚本变化（两端嵌入同一核心）；8 个独立响应案例的规范化数据与 Surge 输出保持不变，QX 错误布局不变。主配置、片段、分流和资源解析器均未改，继续使用普通 main URL。公开字节和 GitHub CI 在推送后按实际提交核验。

本轮未读取或操作用户 QX、配置、缓存、节点、订阅或连接。新布局的 VM/JSC 输出验证不能代替 QX 界面像素宽度验证；36 字符预算不是任意窗口宽度下不省略的保证。新的原生界面效果待用户自行更新并检查，未登记为实机通过。


## 2026-11-01：QX GeoIP 恢复普通 main 链接

按用户要求取消 GeoIP URL 的内容摘要参数，主配置与 GeoIP 片段统一恢复普通 main 链接；未改为短版本参数，也未改用固定提交。GeoIP 与资源解析器脚本字节不变，既有最终求值修复保留。下面的摘要缓存迁移段落属于此前提交的历史记录，不是当前安装要求。

配置回归改为校验普通 main/镜像链接无查询及片段参数、主配置与片段一致、相同地址在明确的缓存刷新后执行新脚本。三条调整后的回归在移除参数前全部失败；移除后 3/3 通过，隔离恢复版本参数后又全部失败。59 项针对性测试通过，完整 `npm test` 为 629 项：621 通过、0 失败、8 项原生内核 opt-in 跳过。`npm run check` 检查八客户端 1137 个产物无漂移及语义、引用、来源和哈希，均通过；独立审查通过。冻结输入 `84fda6a61c66d6043c16b4e9a7db3b60f73a128831490fd6cd783fab1886dee6`。非清单成品仅 QX 主配置和 GeoIP 片段变化；脚本字节不变。缓存刷新案例是依据已记录原生路径建立的模型，不是用户 QX 缓存实测。公开文件和 CI 在推送后单独核验。

本轮不启动、不读取、不修改用户本地 QX、私有配置、脚本缓存、节点或连接开关。普通链接的后续更新由 App 资源刷新管理；不承诺推送后立即丢弃本地缓存。


## 2026-11-01：QX GeoIP 发布地址与缓存迁移

历史记录：本节对应 `636dd07` 当时的摘要方案；当前已取消参数，使用上节的普通 main 地址。

本轮不启动、不读取或操作用户本地 QX、私有配置、脚本缓存、节点和连接开关。使用既有公共程序静态副本、公开 Git 历史及保留地址响应重放。

事实与边界：

- 公开 `main`、`58af662` 和带内容摘要参数的 `main` URL 均返回 HTTP 200、21,568 字节及相同 SHA-256 `4662a65748f8e057a8ee7573ec9c45f1983cb28cd94755750152a9cc8bb1db01`；响应 Cache-Control 为 max-age=300。不能把当前远端字节相同推断为用户当时执行的字节相同。
- 独立红方在 Node 和 Apple JavaScriptCore 各重放五版本、五类输入。真实 `1b065ce` 产物调用 `$done` 一次，但完整求值为 undefined；`5a51608`、`c8c7ade`、`58af662` 与当前 main 均返回同一个四字段对象。旧适配器的外层 return 缺陷已修复，发布地址一直未变。
- QX 946 静态路径：`QTXIPLocationScriptChecker.javascript` 从 MD5(完整 scriptPath) 对应 UTF-8 文件读取，不检查新鲜度（0x100402490、0x10040261C、0x1004027BC）。配置解析保留查询参数（0x100222438–0x100222504），下载正规化仅删除 #fragment（0x1003C56DC），`?v=` 传至请求 URL（0x100437414、0x10024CEF0）。不是假设查询参数一定被宿主保留。
- 最终结果非对象进入 Unknown（0x10043050C、0x1004306DC）；主界面 Unknown handler 清空定位文本并显示连接状态（0x1002FD904–0x1002FD9C0），运行状态键为 VPN_STATUS_RUNNING（0x1003F90C0）。因此“运行中”可只是定位失败后露出的 VPN 状态。
- 自动资源更新另比较缓存修改时间及全局间隔，间隔小于 1 时按 LONG_MAX 处理（0x10043F098、0x10043F330）。缓存尚新时远程脚本跳过下载；空缓存定位只排队下载后发 Unknown，没有立即重试（0x10042FFF4–0x1004300AC）。不能靠 GitHub 推送强制远端用户的旧缓存失效。

修复范围是发布引用的缓存迁移契约：主配置和 GeoIP 片段共享生成函数，以实际脚本字节自动生成 SHA-256 查询参数，保留 main 路径与兼容裸入口。GeoIP 算法、QX/Surge 生成脚本字节、资源解析器及其他客户端配置不因本轮迁移改变。该参数是缓存键版本，不是远端完整性检查；现有用户仍需更新配置引用，不能宣称裸 URL 已被远程清缓存。

三条新回归在修复前全部失败：摘要缺失、URL 键命中旧脚本并得到 undefined、地址未版本化；修复后通过。最终模型明确区分首次空缓存、单独完成下载与后续检查；移除版本参数的隔离变异会使三项全部失败。缓存重放是依据上述原生路径建立的模型，不冒充真实 QX 缓存读取。

最终完整 `npm test` 为 629 项：621 通过、0 失败、8 项显式原生内核 opt-in 跳过。`npm run check` 验证八客户端 1137 个产物无漂移，并通过规则语义、配置结构、引用、来源与哈希校验；冻结输入 `98051195fd09aa1300706c351d74329781edb9b58648a7e5b722116edd4de7a7`。非清单成品仅 QX 主配置和 GeoIP 片段变化，QX/Surge 脚本及解析器字节不变。独立红蓝均审查通过；隔离脚本字节变异自动改变 v 与 URL MD5，Apple Foundation 保留查询参数，CryptoKit 哈希与 Node 一致，Apple JavaScriptCore 返回四字段对象且完成一次。公开配置和 Linux CI 在推送后另核验，不由本地检查推断。

此前获准的两组界面观察使用固定提交脚本：ip-api 与 ipwho.is 均曾显示中文和 IP，后者含 ASN；所选节点不同，不能作为严格同节点对照，随后已恢复原行。本轮未获授权重测带摘要的 main URL，因此具体用户旧缓存字节及新 URL 的原生界面结果仍未验证。

## 2026-11-01：Linux 原生验证的端口与启动信号竞争

七项修复提交 `69db23e` 的首轮 Linux CI 已通过 626 项离线测试及八客户端构建/语义检查，但既有 managed 流程的 lan-name 请求返回 502。在隔离 Linux/x64 的同版本代码中复现了另一条 apple-direct 请求的同类 502，内核明确记录 `reject loopback connection`。固定 Mihomo 的检测键仅含来源 AddrPort；Node 未显式 bind 的 Linux connect 可跨目标复用本地端口。原 CI 没有捕获完整冲突四元组，不将具体 provider/health 连接身份记为已证明。

测试 HTTP、SOCKS、DNS 与 readiness 客户端现在显式绑定 127.0.0.1，先保留唯一来源端口再 connect；规则、许可/拒绝断言与核心自环检测保持不变，无新增重试或等待绕过。错误以保留 cause 的新 Error 携带脱敏诊断，避免修改 message 后原 AssertionError 的缓存 stack 遮住证据。

首次隔离 Linux 全套随后捕获新增 TLS fixture 直接写最终 marker 的竞争，严格 helper 读到空文件即拒绝。TLS 与插件两处生产者已改成 `.pending` 写完后原子 rename，空/错误文件仍拒绝；既有 startup-signal 回归补入空文件案例。没有把此前失败记录算作通过。

最终冻结构建输入 `c1fce437f577b7702c4cc2ebde2281996813fd85ad10a990bf64852a85b554a1`。隔离副本与仓库的最终 managed/TLS/plugin/native 四文件逐字一致。Linux/x64 与 Darwin/arm64 的完整原生套件分别实际通过 326 案例、四份配置与 118 份规则编译；八客户端 1137 产物无漂移及完整语义/引用/来源/哈希检查通过。独立红方网络/错误探针、红蓝 marker 原子发布探针及两平台原始结果复核均 PASS。除构建身份清单外，七项修复的脚本、配置和规则成品字节不变，QX parser SHA 仍为 `30b72d0e01cbeb5e5a330c72dfc1cc9cda088547ffb9d66bf1b631304ec46364`。

Linux 复现只挂载 tracked 公共代码的专用临时副本；合成服务仅监听容器回环，没有挂载私人目录、映射宿主端口、启用特权/TUN或修改宿主 QX/网络/信任设置。后续 GitHub CI 与公开字节按实际后续提交另核验。


## 2026-11-01：七项审计问题修复

先修复两个 P1 并完成针对性验证，再处理五个 P2。独立红方将相同 67 项目标回归放入原始 `c8c7ade` 副本，57 项失败、10 项通过，失败覆盖全部七项；最终实现 67/67 通过。没有用模块加载失败或改动预期代替问题复现。

| 项目 | 修复及回归 |
| --- | --- |
| R1 / P1 | QX 解析器保留 core 和完整脚本两层返回值；identity `$done` 下最终值为同一结果对象。覆盖节点、分流、重写、原子错误、helper 单独加载、重复执行及 host 抛错只完成一次。 |
| R2 / P1 | 不能等价保留的 Clash DER 证书 pin 在发布前明确拒绝，区分 SPKI 与客户端握手指纹；按来源校验并保留 ALPN。真实 TLS pin/ALPN 正负控、失败保留旧文件。 |
| R3 / P2 | Base64 SS 密码不再二次 URI 解码，原始 userinfo 仍做一次解码；百分号、分隔符、Unicode 和整批 Base64 组合及真实认证回归。 |
| R4 / P2 | 私有配置发布前检查最终 outbounds 依赖目标、类型及环；允许跨订阅/本地节点的合法 detour，拒绝被删 selector 导致的悬空引用。真实双跳与拒绝刷新后旧配置继续可用。 |
| R5 / P2 | 结构化 plugin-opts 直接校验映射，保留分号/反斜杠路径和 tls:false；不再拼成 SIP003 文本。 |
| R6 / P2 | Clash v2ray-plugin 默认 Host 保留 bing.com，SIP003 的 cloudfront.com 默认保持独立；通过真实 SS AEAD-over-WS 往返观测源路径/Host，并核对生成的 QX 字段。 |
| R7 / P2 | sync、dry-run、直接 publish 和 recover 全程共用仓库独占锁；跨进程暂停下载/目录交换验证互斥，最终 loadCatalog 校验通过，正常失败释放自己的锁且不抢占陌生锁。 |

冻结构建输入 `cd59d8b8134ffd99797272362799a42e9a6c23741c84b3792d0f1efc78534ee4`，293 个输入文件。完整 `npm test` 626 项：618 通过、0 失败、8 项显式 native opt-in 跳过。`npm run check` 验证八客户端 1137 个产物无漂移及语义、引用、来源、哈希；1128 条非清单成品中仅 QX 解析器内容变化，其余主配置、分流、脚本未漂移。解析器 SHA-256：`30b72d0e01cbeb5e5a330c72dfc1cc9cda088547ffb9d66bf1b631304ec46364`。

独立蓝方使用最终发布文件在 Apple JavaScriptCore 验证 10/10，通过整段求值与回调参数的对象身份、helper 抽取和重复执行。固定 Mihomo 1.19.33 / sing-box 1.14.4 的集成原生套件实际通过 326 个案例（原有 308，新增 TLS 7、SS/依赖 8、插件 3），另检查四份完整配置及编译 118 份规则。独立红蓝还各自在单独临时根目录重跑新增 18 个原生案例。新增三个流程已接入 `npm run test:native`，由 Linux CI 持续执行。当前官方 npm 注册表审计为 0 条已知公告，不据此宣称不存在安全问题。

测试只使用合成证书/密码和回环订阅、DNS、代理与目标，不启动 TUN、不修改系统信任或代理。本轮没有读取或操作用户本地 QX、配置、连接、节点、订阅、证书或系统设置。Mihomo 的插件握手证明源行为，JSC 证明 QX 脚本宿主契约；两者都不等于 QX App 导入或真实节点握手，GUI 状态继续记为未验证。公开字节及 Linux CI 按此次发布提交另核验，不从本地通过推断。

## GeoIP 查询源、字段完整度与 SIP008 兼容补充（2026-10-31）

QX 默认查询源改为 `http://ipwho.is/?lang=zh-CN`，保留本仓库脚本地址。该接口的 HTTP、中文省州/城市与 nested connection/timezone 字段已按官方文档核验，并以服务商公开 IPv4 示例 8.8.4.4 和公开 IPv6 DNS 地址实测：HTTP 200、完整 IP、中文省州/城市、ASN、时区均存在，完整 QX 脚本最终求值为对象。测试没有向新服务发送用户提供的公网 IP。免费端点当前标称每查询方 IP 每日 1000 次、无 SLA；此次采样证明字段可用，不证明数据库一定更准确或长期可用性。

新增解析 ipwho.is 嵌套结构、IPinfo Lite 的国家代码/ASN/组织字段；副标题在完整 IP、地区/城市后增加实际时区。旧 ipwho.de、IPinfo legacy、ip-api 仍支持，空 ASN 不抛错。两个独立审查发现并闭环的边界都有先失败证据：缺失 success 的嵌套响应不能冒充 IPinfo；Lite 可选字段缺失不能丢弃已有国家代码、名称、ASN 或组织。四个 Lite 可选字段的全部 16 种组合覆盖，不推断缺失位置。

资源解析器修正标准 SIP008 v1 servers 中 UUID id 元数据被误拒的问题；只在已确认的格式作用域校验并移除 id，VMess/VLESS id 凭据不变，缺 id 的既有选项仍兼容。不支持版本、未知连接/安全字段继续整份失败。旁置 outbounds 字段不能让另一种格式的非法节点绕过校验。新测试对旧实现先失败，独立蓝方 26 组源码/完整 bundle 反例通过，官方原生样例 91 条通过。

完整离线测试 552 项：547 通过、0 失败、5 项原生 opt-in 跳过。冻结输入 `c5d5172613aec31c6baf76eca8dda3365d34f4733fdb5839604c144ccb1b519f`；最终实际产物在 Apple JavaScriptCore 中 GeoIP 11 例、解析器 9 例通过。八客户端 1137 产物无漂移与语义/引用/来源/哈希检查通过；1128 个非清单产物中仅预期 5 个变化。GeoIP SHA-256 为 `4662a65748f8e057a8ee7573ec9c45f1983cb28cd94755750152a9cc8bb1db01`，QX parser 为 `427374ad6300842ffbcf2b82d36a327d2e30ce575d02a5fecda7d42c936f263d`。

本轮不操作本地 QX、配置、连接、节点、订阅或系统设置。API 实际响应和 JSC/VM 的最终求值验证仍不等于 QX 界面实测；原生界面保持未验证状态。

## QX 内置 GeoIP 最终返回值修复（2026-10-31）

冻结输入 `56aa01baf190db5992e2a615a66bf87367b03a4516b33a1fb94cffbfc19f8cbf`。完整离线测试 544 项：539 通过、0 失败、5 项原生 opt-in 跳过；八客户端 1137 个产物无漂移检查、语义/引用/来源/哈希校验通过。GeoIP 产物 SHA-256 为 `b391998446b08cbc671b23fa4490dc573ff080b54f0460f8525e379971d51fac`。

已确认修复前适配器的外层函数丢弃了 $done 返回值。QX 1.8.0 build 946 的只读静态检查显示，QTXDashboardManager 的 checkServerLocation: 路径先注入 `var $done = function(result) {return result}`，随后消费 evaluateScript: 的最终 JSValue；仅接受对象并读取 title、subtitle、ip。旧适配器最终求值为 undefined，会走定位未知分支。静态依据为安装程序 arm64 薄片（SHA-256 `77ea2dcc2e3e4bea406e799d55d5fb71431061bddbacb02b0a482366ce560abe`）的 Apple dyld_info 反汇编：注入点 0x10042fdd4，脚本执行点 0x100430d2c，对象检查点 0x10043050c。检查未附加进程，也未改变应用运行状态或安装内容。

修复仅让 QX 适配器 return $done(...)，不更换 API 或资源解析器。新增测试运行完整渲染产物，按上述宿主定义检查最终结果，覆盖 ipwho、空 ASN 的 ip-api、IPv6 的 IPinfo、错误 JSON、限流和无响应。新增测试在修复前因 undefined 失败；本机 Apple JavaScriptCore 同样复现了旧产物 undefined、修复产物返回四字段对象的差异。此前只收集 $done 调用副作用的 VM/JSC 测试未覆盖这个宿主契约。

这确认了代码缺陷与原生拒绝结果的路径；QX 界面恢复仍须在重新加载修复脚本后验证。本次未操作用户 QX、私有配置、连接、节点或订阅，没有把静态分析与 JSC 重放记为原生界面实测通过。

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
