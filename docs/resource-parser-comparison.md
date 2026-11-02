# QX 资源解析器逐项对照与差异

本页对照固定 [KOP 快照 `f0177f5e`](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js)，其源码 SHA-256 为 `1315ad57a31a2431a9fdf3d9fa0c892f7e91b9fa74f1c81bdaac04d521817b67`。历史 NetAtlas 基线为 `fd60d6b81a9969fb81bf0c3134880de294d9f169`；早期 41 类功能、53 组 Apple JavaScriptCore 同输入案例用于发现差异。下表按本轮源码和回归重新登记，不再把已经补齐的 SSD、旧 URI、命名、规则和重写功能写成未实现。

NetAtlas 已补齐原表列出的常用格式与声明式参数，并保留可检查的原生边界。它是独立实现，不宣称任意 KOP 输入、JavaScript 扩展或其他客户端的脚本 API 都可等价运行。节点夹具使用合成地址和凭据；公开资源另做完整原文验收。本轮没有读取私人订阅、操作本地 QX 或修改系统代理。

| 类别 | 功能 | 当前实现与差异 | 主要证据 |
| --- | --- | --- | --- |
| 节点格式 | QX 原生、SS/SSR、VMess JSON、VLESS、Trojan、HTTP、SOCKS、AnyTLS、整体 Base64 | 已实现；逐字段验证，未知传输或不可表达的安全字段整份拒绝 | [节点转换](../src/features/resource-parser/nodes.mjs)、[节点回归](../tests/scripts/resource-parser-nodes.test.mjs)；KOP 2646–3040 |
| 节点格式 | Surge/Loon、Clash YAML、SIP008、sing-box JSON | 已实现登记的字段和传输子集；sing-box UoT 版本独立映射，不把其他客户端的字段默认丢弃 | [节点转换](../src/features/resource-parser/nodes.mjs)、[原生偏好回归](../tests/scripts/resource-parser-native-preferences.test.mjs)；KOP 4064–5010 |
| 节点格式 | SSD URI | 已实现默认值继承、逐服务器覆盖和 IPv6；每个展开节点都校验，插件及总量限制仍生效 | [扩展节点回归](../tests/scripts/resource-parser-extended-nodes.test.mjs)；KOP 3428–3463 |
| 节点格式 | Shadowrocket VLESS、旧非 JSON VMess、Quantumult CSV VMess | 已支持 Base64 authority、命名及 TLS/WS/HTTP-header 别名；旧 VMess 保留自身 AEAD 默认，非零 alter ID、复用和不等价传输仍拒绝 | [扩展节点回归](../tests/scripts/resource-parser-extended-nodes.test.mjs)；KOP 2906–2960、3242–3314 |
| 节点格式 | SOCKS/ssocks、HTTP(S) Base64 变体 | 已实现已验证的整个 authority/endpoint 形式；仅解码一次，保留字面凭据、IPv6、TLS 和名称 | [扩展节点回归](../tests/scripts/resource-parser-extended-nodes.test.mjs)；KOP 2840–2865、2964–3001 |
| 节点字段 | fp/spx/client-fingerprint、Reality MLKEM true 提示 | 保留原生握手字段，并用固定说明登记 QX 原生指纹、缺失的 spider-path 和 MLKEM 提示；不宣称保留来源指纹选择 | [原生偏好回归](../tests/scripts/resource-parser-native-preferences.test.mjs)、[Reality 回归](../tests/scripts/resource-parser-reality-mlkem.test.mjs) |
| 节点字段 | 证书校验域名 | 已支持原生 `tls-verification=example.com` 和显式 `cert=example.com`，独立于 SNI；要求 QX 1.7.0 build 938+。这里的 domain 是 FQDN 占位，不是字符串枚举 `domain` | [官方 build 938 公告](https://t.me/QuanXNews/415)、[扩展节点回归](../tests/scripts/resource-parser-extended-nodes.test.mjs) |
| 筛选 | 节点 in/out | `+` 为 OR、未转义 `.` 为 AND、`\.` 为字面点，不区分大小写 | [关键字实现](../src/features/resource-parser/options.mjs)、[筛选回归](../tests/scripts/resource-parser-audit-options.test.mjs)；KOP 3114–3125 |
| 筛选 | 规则、重写、hostname 的 in/out | 规则正文区分大小写，out 先匹配源正文、in 匹配转换后正文；重写正文不区分大小写；hostname 保留原拼写、区分大小写。三者的点均为字面点 | [字面筛选回归](../tests/scripts/resource-parser-literal-filter.test.mjs)；KOP 2226–2362 |
| 筛选 | regex/regout | 已作用于节点完整声明、规则、重写及各 hostname；使用有预算的声明式 NFA 子集，不执行用户 JS | [正则实现](../src/features/resource-parser/safe-pattern.mjs)、[组量词与空匹配回归](../tests/scripts/resource-parser-regex-groups.test.mjs)；KOP 597–598、2261–2314、3094–3109 |
| 命名 | rename、rrname、replace、delreg | 已实现顺序处理；rename/rrname 匹配字面文本，替换支持标准 `$` 替换标记；replace 可显式修改完整声明，但结果必须重新通过原生和安全字段验证；delreg 仅改名称 | [选项回归](../tests/scripts/resource-parser-extended-options.test.mjs)、[名称来源回归](../tests/scripts/resource-parser-name-literals.test.mjs)；KOP 995–1007、2608–2623、3794–3837 |
| 命名 | 前后缀、删除、JSON 配对 | 普通文字、`前缀@`、`@后缀`、`字段☠️`、JSON 配对均已实现；原始 `+`/`@` 是操作符，字面字符编码为 `%2B`/`%40` | [选项实现](../src/features/resource-parser/options.mjs)、[Helper 回归](../tests/scripts/resource-parser-extended-helper.test.mjs) |
| 命名 | numeric suffix 与占位符 | `suffix=1/-1/0` 分别追加/前置/不加协议标签；支持 `$type/$index/$emoji/$tag` 及登记样式。索引在排序后展开；源名称、资源 tag 和复制的捕获数据不会被递归解释为模板 | [名称实现](../src/features/resource-parser/name-options.mjs)、[名称来源回归](../tests/scripts/resource-parser-name-literals.test.mjs)；KOP 1413–1508 |
| 命名 | emoji、ptn/npt/cap | 已支持名称旗帜、0–8 字符样式和大小写；只按名称识别地点，不查询 IP 地理位置。使用 Unicode 字母/数字映射，不复制旧表中 q/k、7/8 的笔误 | [名称实现](../src/features/resource-parser/name-options.mjs)、[选项回归](../tests/scripts/resource-parser-extended-options.test.mjs)；KOP 1365–1410 |
| 排序 | none/name/name-desc、0/1/-1/x、关键词、sortx | 已支持保持、升降序、随机、`JP>HK`/`JP<HK` 分组及分组内排序；随机只保证条目集合保持，不保证与另一实现产生同一排列 | [选项回归](../tests/scripts/resource-parser-extended-options.test.mjs)；KOP 3713–3788 |
| 名称冲突 | 自动编号、del=1 | 资源流程默认保留重名节点并编号；`del=1` 仅删除后续同名节点。先预留全部最终名称，避免编号抢占后续原名；直接低层 parseNodes 的严格默认合同不变 | [名称来源回归](../tests/scripts/resource-parser-name-literals.test.mjs)、[扩展节点回归](../tests/scripts/resource-parser-extended-nodes.test.mjs)；KOP 1279–1341 |
| 连接覆盖 | udp/tfo/uot/cert/csha/psha/alpn/aead/host/obfs/tsession/checkurl/tls13 | 已实现显式 hash 覆盖；未选择时不改变连接默认值。字段适用性、指纹格式、引号布尔值和替换后的安全语义都校验；原生限制见下文 | [原生覆盖](../src/features/resource-parser/native-options.mjs)、[选项回归](../tests/scripts/resource-parser-extended-options.test.mjs)；KOP 605–651、1568–1639 |
| 流量 | info、flow、STATUS、返回 info | 支持已有 header、受限伪节点、STATUS 和显式手填日期/流量；合法时返回 bytes_used/bytes_remaining/expire_date。缺失或坏用量不伪造为零，不回显来源正文 | [宿主选项](../src/features/resource-parser/host-options.mjs)、[宿主回归](../tests/scripts/resource-parser-host-options.test.mjs)；KOP 1030–1106 |
| 规则 | 大型 anti-AD、普通域名 out | 纯文本规则限额 8 MiB/250,000 行；out 的域名点按字面匹配。结构化、Base64、节点和重写仍有各自较小限额；正则预算独立计算 | [大型规则回归](../tests/scripts/resource-parser-large-rules.test.mjs)、[限额](../src/features/resource-parser/limits.mjs) |
| 规则 | 裸域名、IP/CIDR 混合列表、Clash payload | 已识别纯列表；裸域名默认 suffix，IP 使用对应地址规则。显式 domain-set 仍把裸域名当 exact；Clash `+.`、`.` 与通配边界分别处理 | [扩展规则回归](../tests/scripts/resource-parser-extended-rules.test.mjs)；KOP 1218–1225、2506–2567 |
| 规则 | GEOIP/ASN、host/IP/UA/classical、DOMAIN-SET | 已实现登记条件并验证；具体 GEOIP 类别仍取决于所用数据库 | [规则实现](../src/features/resource-parser/rules.mjs)；KOP 2430–2503 |
| 规则 | AND 与 DOMAIN-REGEX | AND 只对有证明的域名子集求精确交集；DOMAIN-REGEX 支持可精确编为有限 glob 的字面、分支、正字符集、有限量词和 `.*`/`.+` 子集，拒绝需近似扩大匹配的表达式 | [AND 回归](../tests/scripts/resource-parser-domain-and.test.mjs)、[扩展规则回归](../tests/scripts/resource-parser-extended-rules.test.mjs)、[精确编译](../src/features/resource-parser/domain-regex.mjs) |
| 元数据 | `{# note #}`、禁用行、hide=0 | 说明不参与匹配/替换；build 950+ 保留原生行首说明，较旧或未知 build 输出普通注释。来源禁用项持续禁用；hide=0 把筛除项输出为禁用项，不重新激活 | [元数据实现](../src/features/resource-parser/resource-metadata.mjs)、[规则回归](../tests/scripts/resource-parser-extended-rules.test.mjs)、[重写回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs) |
| 规则覆盖 | policy/pset/replace/fcr/via/relay | 已实现；pset 区分大小写、分别匹配条件值和当前策略；网络标记须显式指定。relay 使用实际代理端点生成 host/IP 规则，不使用伪装域名；冲突与无意义的 FINAL 网络标记拒绝 | [扩展规则回归](../tests/scripts/resource-parser-extended-rules.test.mjs)、[宿主回归](../tests/scripts/resource-parser-host-options.test.mjs)；KOP 1518–1528、2416–2422、2572–2623 |
| 规则边界 | no-resolve、特殊匹配和 REJECT 策略 | 不默认丢弃。不可表达的 no-resolve、pre/extended-matching 和特殊内建策略仍拒绝；allow-resolve/policy 只在用户显式选择时承认变义 | [规则实现](../src/features/resource-parser/rules.mjs)；KOP 2446–2451 |
| 重写 | QX 原生、302/307、静态 reject、HTTP 脚本、jsonjq | 已支持登记动作，保留源 URL pattern 的锚点及内部转义，不重写为另一正则方言 | [重写实现](../src/features/resource-parser/rewrites.mjs)、[转换回归](../tests/scripts/resource-parser-conversion.test.mjs)；KOP 2092–2203、3602–3707 |
| 重写 | JS 前导安装注释、外层 HTTP pattern 引号 | 仅静态读取明确安装段，不扫描 JS 正文字符串或执行脚本；外层包装引号与内部 pattern 分开处理 | [安装注释回归](../tests/scripts/resource-parser-rewrite-installation.test.mjs)、[字面回归](../tests/scripts/resource-parser-literal-filter.test.mjs) |
| 重写 | Loon JSON JQ/del/replace、Surge JQ | 已编译到原生 jsonjq；删除路径和仅更新已存在字段按实际 JSON/jq 结果验证。未把该 DSL 当来源 JS 执行 | [动作转换](../src/features/resource-parser/rewrite-actions.mjs)、[实际 jq 回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs)；KOP 1771–2090、3644–3652 |
| 重写 | Map Local 内联响应 | 已通过固定 script-echo-response 动作适配器表达文本、Base64、tiny-gif、状态码和响应头；隔离运行验证实际返回内容，不用访问上游的正文替换冒充本地响应 | [动作转换](../src/features/resource-parser/rewrite-actions.mjs)、[实际动作回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs)；KOP 1640–1704 |
| 重写 | 本地 echo-response/Data 文件 | 已支持安全的现有 Data 文件名及默认响应设置，不自动上传或创建文件；目录穿越、远程 URL 冒充文件和不可表达的文件响应设置仍拒绝 | [重写回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs)；KOP 3691–3697 |
| 重写 | header add/del/replace/replace-regex | 已转固定动作适配器；对实际大小写不敏感 header map 运行测试。正则仍用共享预算和受限语法，失败不返回部分 header 结果 | [动作转换](../src/features/resource-parser/rewrite-actions.mjs)、[实际动作回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs)；KOP 1722–1757 |
| 重写 | 混合原生分流、URL-REGEX、dst | 可保持混合条目顺序；dst=filter/rewrite 显式提取对应内容。URL-REGEX 仅已登记的 REJECT 转 reject-200，固定说明 connection-close 与 HTTP 响应阻断不同；其他任意 URL 路由策略仍不宣称支持 | [混合回归](../tests/scripts/resource-parser-mixed-modules.test.mjs)、[扩展重写回归](../tests/scripts/resource-parser-extended-rewrites.test.mjs)；KOP 2148–2165 |
| 模块参数 | `#!arguments` 与 hash arguments | 静态代入来源声明的 `{{{name}}}`；hash 接受有界标量 JSON 对象，未声明变量、嵌套对象和危险键拒绝，不执行配置文字 | [模块参数实现](../src/features/resource-parser/module-arguments.mjs)、[Helper 回归](../tests/scripts/resource-parser-extended-helper.test.mjs) |
| HTTP 脚本 | Surge/Loon 声明、requires-body、参数与 API | 普通无额外设置的 HTTP 声明可转换，但不保证来源 JS API。已登记 Maasea YouTube 两个固定源码使用静态适配器处理 JSON argument、max-size、timeout 和 binary；其他带这些设置的来源原子拒绝，不静默丢参数 | [运行时登记](../src/features/script-runtime/registry.mjs)、[原生合同回归](../tests/scripts/script-runtime-native-contract.test.mjs)、[运行时回归](../tests/scripts/script-runtime.test.mjs) |
| 宿主 | Helper UI、类型别名、本地首行参数 | 已实现全部登记参数的编辑、独立函数提取及语义往返；未知/无效原 hash 保留供用户检查，但不会因此被运行时接受。分组排序使用可编辑文本；无未选择项的默认覆盖 | [Helper](../src/features/resource-parser/helper.mjs)、[完整 Helper 回归](../tests/scripts/resource-parser-extended-helper.test.mjs)；KOP 115–510、561–565、1196–1217 |
| 宿主 | UA=1、扫码订阅、profile | UA=1 返回一次 QX 原生 retry 指令，解析器不自行联网；订阅链接及显式 profile 通过本地 add-resource 通知引导用户确认，不自动导入配置 | [宿主选项](../src/features/resource-parser/host-options.mjs)、[宿主回归](../tests/scripts/resource-parser-host-options.test.mjs)；KOP 535–552、811–832、948–977、1145–1164 |
| 宿主 | cnt/dbg/ntf/b64 | 已支持汇总统计、通知开关及显式 Base64 节点输出；debug 不回显订阅地址、节点名、正文或凭据 | [宿主回归](../tests/scripts/resource-parser-host-options.test.mjs)；KOP 603–649 |
| 执行边界 | sfilter/srename、任意 JS/worker、cron、CA | 未执行来源或用户编码的脚本，不自动导入任务、证书、私钥，不给未登记脚本声称通用跨客户端 API 兼容 | [核心](../src/features/resource-parser/core.mjs)、[运行时登记](../src/features/script-runtime/registry.mjs)；KOP 3158–3177、3844–3860 |

## 正则、命名和原生限制

`regex/regout/delreg/replace` 的受限正则与 `DOMAIN-REGEX` 的 glob 编译是两个不同接口。前者支持字面字符、点、锚点、边界、字符集、捕获/非捕获组、分支、贪婪/非贪婪量词，以及组内容不能匹配空串的分组量词。`^`、`$`、`\b`、`a*` 等合法空匹配可以全局替换，每次空匹配后按一个 UTF-16 单位推进，与无 `u` 标记的 JavaScript 全局替换保持一致。回溯引用、环视、可空分组的重复和未登记的转义仍明确拒绝；空的正则参数也拒绝。

该匹配器不调用 eval，也不把整个来源正则交给可回溯的原生引擎。单个字符集使用有界单字符判断。每个表达式最多 512 个 UTF-16 单位、16 个捕获组、16 层分组、1,024 个编译状态；同一资源的筛选、替换、策略选择及排序共用 2,097,152 次状态处理预算。超额受控失败，合法但复杂或很长的正则任务也可能达到预算；这不缩减无正则大型规则的 8 MiB 输入配额，也不是跨设备耗时保证。

名称中的 `$type/$index/$emoji/$tag` 只从用户插入的模板文字展开，源名称、资源 tag、`$&`/`$1` 等复制的源数据继续作为字面数据。`$$` 表示字面美元符。规则/重写的说明文字不参与正则与策略匹配。旧文档中的分流或 hostname 筛选 `ads\.example` 应改为字面 `ads.example`；节点名称 in/out 的 `\.` 仍表示字面点。

连接覆盖依据 [QX 官方 sample.conf](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)，只有显式 hash 或显式 replace 才会改变字段：

- `cert=example.com` 覆盖传统 X.509 证书校验域名，与 SNI 分开，要求 [build 938+](https://t.me/QuanXNews/415)；不接受字面 `cert=domain`。该字段不承诺改变 Reality 自身的认证方式。
- `csha/psha` 不会偷偷开启证书校验；关闭校验、Reality 或优先级冲突导致新指纹无效时拒绝。quoted `"false"` 与未加引号的 false 含义一致。
- `uot=1` 是旧 ShadowsocksR Python framing；`sp.v1`/`sp.v2` 分别显式选择协议版本，不把它们混为 true。SS2022 与旧 Python framing 的组合拒绝。
- AEAD 只作用于 VMess；host/obfs 须满足已有传输约束。Reality 的显式 ALPN、session 设置及开启 TFO 请求拒绝，避免把无效覆盖报成成功。
- `tls13` 已被 QX 废弃，不能关闭 TLS 1.3；显式 hash 输出带固定说明。它是旧字段保留，并非可生效的 TLS 版本控制。

`DOMAIN-REGEX` 只编译可证明精确的域名语言：有限展开最多 2,048 个 glob；不可表达的无限重复字面、反向引用、否定断言或字符集不会近似放宽成后缀。任意 AND/OR/NOT、端口、IP 等混合逻辑也不在域名 AND 子集之内。

## 脚本和宿主边界

转换器只读取资源文本、静态安装声明及已声明模块变量，不下载或执行来源脚本。Map Local/header 动作输出固定的本仓库适配器引用；其状态码、响应头和正文行为已用隔离运行测试验证。文件响应仍依赖用户预先放在 QX Data 中的文件。

跨客户端脚本 API 适配只覆盖[登记的 Maasea YouTube request/response 源码](../src/features/script-runtime/registry.mjs)，固定在 `65075cdb388fc5e3094afd7e7314c67b243f3525`，构建校验来源与许可。登记的源 URL 别名会转为固定本地构建的适配脚本，而不是运行时下载任意 JS。参数、存储、网络、binary body 和完成回调以各自回归合同为准；QX 的预缓冲、空正文与 CPU 限制不能被适配器消除。未登记脚本只可保留已能表达的触发声明；需要保留却无法表达的 argument/max-size/timeout/binary 设置整份拒绝，不把丢参数算兼容。

混合 rewrite/filter 要求 [QX 1.5.2 build 844+](https://t.me/QuanXNews/294)；Helper 独立函数协议要求 1.5.6 build 918+；UA retry 要求 1.5.6 build 921+；行首原生说明使用 build 950+。这些版本条件不能互相替代。扫码订阅/profile 只生成本地待确认导入动作；UA 交给宿主执行一次重试，不由解析器网络请求。

QX App 实际导入、业务脚本效果、播放、MITM 范围和真实流量命中仍为未运行。JavaScriptCore、native jq 或隔离适配器测试证明各自合同，不等于 App 原生流量验收。

## 许可与对照方法

当前没有建立 KOP 主实现的适用再发布许可；其内嵌库的 MIT/BSD 版权头不能覆盖主实现。本轮参考固定接口行为，使用独立代码和合成同输入测试，没有复制、换名、包装或运行时加载 KOP 主实现。具有单独许可并固定登记的 Maasea 静态适配源码是另一项来源，不能用来给 KOP 补授权。

同输入对照只在接口与输入语义成立时比较：不把 KOP 原样返回未知内容当成功，不复制静默弱化证书、略过坏节点或扩大域名匹配的行为。未知字段、坏输入及不支持的原生条件仍原子失败；错误和通知不回显凭据。

## 本轮真实公开资源

截图原文为 [anti-ad-quanx.txt](https://github.com/privacy-protection-tools/anti-AD/blob/86b500b98c7a5f982e7da9ce13aa1bb0ed5b73bc/anti-ad-quanx.txt)，SHA-256 `a24d2a010cc6d6e777ce4caef6f97bd01b593adc2fe051b1b28a011c9f4b4be9`：3,868,444个ASCII字节，101,518条规则（另4行注释），`VER=20261101054604`。

```text
https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-quanx.txt#out=mycleanmymac.com+wxs.qq.com+mcs.zijieapi.com
```

旧KOP完整原文输出101,515条活动规则，仅删除三个指定域名，保留 `wxsnsad.tc.qq.com`、`wxsnsdy.tc.qq.com`、`wxsnsdy.video.qq.com`。旧NetAtlas先因2Mi/20k限额拒绝；10条缩样又复现6条近似误删。最终公开脚本的同输入逐行/顺序复核及全套检查记录见[验证记录](validation.md)。不会使用实际私人订阅作为公共夹具，也没有操作用户本地QX。

## 四个原链接的完整输入回归

保留下面四个原URL，不先替换成手工精简的片段。登记只保存公开URL、输入SHA-256及输出计数，不vendor未建立再发布许可的JS正文；完整未经改写的来源只在真实HTTP验收时作为输入文本使用。回归合同见[来源清单](../metadata/resource-parser-upstreams.json)。

| 原始公开来源 | 完整输入的原生输出合同 | 明确边界 |
| --- | --- | --- |
| [YouTube.Enhance.sgmodule](https://raw.githubusercontent.com/Maasea/sgmodule/refs/heads/master/YouTube.Enhance.sgmodule) | 3条HTTP脚本rewrite、2个hostname | 已登记脚本转固定 Maasea 静态适配器，保留经验证的 JSON argument/max-size/timeout/binary 合同；不外推到未登记来源或业务播放效果 |
| [DragonRead_remove_ads.plugin](https://raw.githubusercontent.com/Moli-X/Tool/176029a3ed5ba84447b9c36af040c225eb170e82/Loon/Plugin/Kelee/DragonRead_remove_ads.plugin) | 21条域名AND精确编为39条wildcard，加26条原filter，共65条filter；另1条URL rewrite | URL-REGEX REJECT转为reject-200并固定说明HTTP响应阻断与connection-close不同；不宣称这一项语义等价 |
| [mgtv.js](https://raw.githubusercontent.com/WeiGiegie/666/main/mgtv.js) | 安装注释中3条rewrite、11个唯一hostname | 只读取明确安装声明，JS正文不执行；原有宽hostname及业务行为不替用户背书 |
| [zhbd.js](https://raw.githubusercontent.com/gjwj666/qx/main/zhbd.js) | 安装注释中5条rewrite、34个唯一hostname | 保留声明顺序、脚本URL与原mask，不执行正文或擅自收窄MITM范围 |

对最终发布成品执行：

```sh
npm run test:parser-upstreams
```

[验收工具](../tools/check-resource-parser-upstreams.mjs)从四个原URL真实GET完整输入，核对固定SHA-256，再运行磁盘上的`clients/quantumultX/scripts/resource-parser.js`成品；不是仅测试源码函数或缩小夹具。隔离环境禁止网络、存储和来源JS执行，检查只完成一次、最终求值对象与完成对象相同，以及原生输出与计数。来源hash变化、HTTP失败或旧成品不能满足合同都会失败，应审查来源/构建后重跑，不把失败写成已通过。

混合分流/重写需要[Quantumult X 1.5.2 build 844或更新版本](https://t.me/QuanXNews/294)；helper UI的1.5.6 build 918要求是另一个接口，不能混用。原业务 JS 可能修改应用状态/凭据，原 hostname 也可能较宽；登记脚本仅具有自己的适配合同，不承诺通用脚本 API、业务效果、播放或原生流量命中。QX App 实际导入与运行仍为 not-run。

## 依据与复现

- 原始参考为 [KOP固定源码](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js)，SHA-256见页首；只参考接口行为，没有复制脚本实现。表中 KOP 行号均指此快照；NetAtlas 以当前函数和链接测试为准，不再引用已漂移的历史行号。
- 常用筛选语义依据：[节点Scheck](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L3114)、[分流Rule_Handle](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L2335)、[重写Rcheck与hostname](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L2272)。
- 离线稳定回归：[大型规则](../tests/scripts/resource-parser-large-rules.test.mjs)、[字面筛选与引号边界](../tests/scripts/resource-parser-literal-filter.test.mjs)；真实公开文件在隔离Apple JavaScriptCore执行，离线CI不依赖会变化的公网数据。
- 初始 53 组用于差异定位；本轮新增格式、参数、完整 Helper 往返、精确规则转换、声明式动作与组量词/空匹配/捕获来源回归。原生 RegExp 差分覆盖正常与病理输入，不能由有限案例推成完整 ECMAScript 正则或任意客户端兼容。QX App 导入和实际远端流量未在本轮执行。
