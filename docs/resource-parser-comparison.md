# QX 资源解析器逐项对照与差异

基线 NetAtlas `fd60d6b81a9969fb81bf0c3134880de294d9f169`；KOP 公开源码 SHA-256 `1315ad57a31a2431a9fdf3d9fa0c892f7e91b9fa74f1c81bdaac04d521817b67`。2026-11-02 对照41类功能，使用53组同输入 Apple JavaScriptCore 案例定位差异；大型公开文件和本轮最终脚本另作完整复放。大资源限额、分流/重写/hostname字面筛选和HTTP正则外层引号的问题已在本轮修复。下列源码行号以该基线/公开快照为准，工作树改动可能移动行号。

**结论：目前是覆盖常用场景的独立实现，不能称为 KOP 完整替代。** 正常参数仍有拒绝项和静默不同项；有意拒绝的可执行脚本、证书/宿主行为单独列出，不按默认必须支持计。节点对照只使用合成地址/凭据；规则另用用户给出的公开原文。本轮不请求私人订阅，也不操作本地QX或系统代理。

| 类别 | 功能 | 核实差异/状态 | 重要程度 | NetAtlas 证据 | KOP 证据与验证边界 |
| --- | --- | --- | --- | --- | --- |
| 节点格式 | QX原生/标准SS、SSR、VMess JSON、VLESS、Trojan、HTTP、SOCKS、AnyTLS及整体Base64 | 已覆盖主要格式 | 已实现 | nodes.mjs:4,114-247,377-419 | KOP:2646-2749,2819-3040；已有节点回归和此前12组JSC；不意味着所有来源字段均可无损处理 |
| 节点格式 | Surge/Loon节点、Clash YAML、SIP008、sing-box JSON | 已覆盖主要格式 | 已实现 | nodes.mjs:249-349,392-419 | KOP:2819,4064-4395,4704-5010；我方还原生处理sing-box；KOP该格式不能笼统算覆盖 |
| 节点字段 | fp/spx/client-fingerprint、Reality MLKEM true提示 | 已原生适配并说明 | 已实现 | nodes.mjs:34-54,227-288; core.mjs:79-88 | KOP:2635-2643,3242-3314,4966-5007；我方有受限值/来源及固定说明；KOP选择提取字段时忽略其它字段，不保证安全字段等价 |
| 节点格式 | SSD URI | KOP可转，我方unsupported protocol | P2 常用兼容缺口 | nodes.mjs:4,247 | KOP:2693-2694,3428-3463；动态case node-ssd；不建议支持KOP对IPv6直接跳过的旧行为 |
| 节点格式 | Shadowrocket VLESS base64 authority/remarks/obfs/tls别名 | KOP可转，我方拒绝remarks等 | P2 常用兼容缺口 | nodes.mjs:227-246 | KOP:3242-3314；动态case node-shadowrocket-vless |
| 节点格式 | Shadowrocket VMess非JSON URI | KOP可转，我方unsupported VMess URI | P2 旧格式缺口 | nodes.mjs:218-225 | KOP:2906-2960；动态case node-shadowrocket-vmess；传输和AEAD默认仍需分别保持，不能泛化成所有旧VMess |
| 节点格式 | Shadowrocket SOCKS/ssocks及HTTP Base64变体 | 源码有处理，我方不覆盖相同变体 | P3 待分格式验证 | nodes.mjs:227-246 | KOP:2680-2706,2840-2865,2964-3001；动态最小单行样例KOP有原样/异常输出，不能把返回content算正确支持；不列为已确认可直接修复 |
| 节点字段 | tls-verification=证书域名 / cert=domain | KOP提供domain选项，我方bool-only并拒绝hash cert | P2 需先核对原生支持 | nodes.mjs:7,351-355; options.mjs:41-46 | KOP:32-34,614-615,658-676；KOP938+声明；native输入无cert覆盖时KOP可能改为false，不能据此声称无损；需官方接口依据后实施 |
| 筛选 | node in/out：+OR、.AND、\.字面、大小写不敏感 | 双方主要行为一致 | 已实现 | options.mjs:createKeywordMatcher/applyNodeOptions | KOP:3114-3125；动态case node-dot-and |
| 筛选 | rule/rewrite/hostname点号与大小写、source out顺序 | 原实现与fd60存在语义差异，本轮已修 | P1 本轮已修 | rules.mjs:parseRules; rewrites.mjs:parseRewrites | KOP:2226-2227,2272-2295,2320-2325,2348-2362；rules out对源正文CS、in对转换后正文CS；rewrite CI字面；hostname原拼写CS字面。53组当前工作树JSC已确认这些细分 |
| 筛选 | regex / regout 对节点完整行及规则/重写/hostname正则筛选 | KOP支持，我方拒绝参数 | P2 常用漏项 | options.mjs:41-46 | KOP:597-598,2261-2264,2311-2314,3094-3109；动态node-regex/node-regout/rules-regex；这是声明式正则筛选，不能与sfilter源码执行混为一谈，实施需限复杂度/耗时 |
| 命名 | rename字面替换、前后缀、☠️删除、JSON配对 | 主要支持 | 已实现 | options.mjs:88-125,228-242 | KOP:3805-3837；替换值中的JS $替换模板仍有差异，不能说完全相同 |
| 命名 | suffix=1/-1（及0）协议类型标签 | KOP类型标签，我方当文本追加1/-1/0 | P2 静默语义错误 | options.mjs:85-87,228-242 | KOP:1013-1015,1413-1427；动态node-suffix-type/node-prefix-type；最小修法见后文 |
| 命名 | rename中$type/$index/$emoji/$tag占位符 | KOP展开，我方按普通文本写入 | P2 静默语义错误 | options.mjs:88-125,228-242 | KOP:565,1432-1508；动态node-placeholder-type/index/tag；可先明确拒绝保留占位符防假成功，再按固定枚举逐项实现 |
| 命名 | rrname、replace、delreg | KOP支持，我方拒绝参数 | P2/P3 未实现 | options.mjs:41-46 | KOP:596-610,995-1007,2608-2623,3794-3801；rrname/replace为正常名称处理；replace也能改连接字段，不能默认照搬任意覆盖 |
| 命名 | ptn/npt/cap花样字符与大小写样式 | KOP支持，我方拒绝 | P3 外观功能未实现 | options.mjs:41-46 | KOP:628-630,1365-1410；动态node-ptn-npt/node-cap |
| 排序 | sort=1/-1 / name/name-desc | 双方主要升降序可用 | 已实现 | options.mjs:126-128,246-247 | KOP:3713-3739；名称排序与emoji顺序仍不能笼统保证完全一致 |
| 排序 | sort=0、sort=x、sort=JP>HK / sortx | KOP支持none/随机/优先分组，我方仅none/name/name-desc/1/-1 | P2 常用漏项 | options.mjs:126-128 | KOP:616-617,3713-3788；动态node-sort-0/keyword/random；0可无损映射none，关键词优先需独立规范 |
| 名称冲突 | 重名自动编号 / del=1 | KOP重命名或删除；我方整份拒绝原始或最终重名 | P2 不同默认策略 | nodes.mjs:415-417; options.mjs:221-243 | KOP:1279-1341；动态node-duplicate-default/delete；不能悄悄丢节点或改策略引用，需清晰登记 |
| 连接覆盖 | udp/tfo/uot/cert/csha/psha/alpn/aead/host/obfs/tsession/checkurl/tls13 | KOP提供hash覆盖，我方多数仅保留已支持源字段，不提供覆盖hash | P2 有意未实现覆盖 | options.mjs:41-46; nodes.mjs:NATIVE_KEYS | KOP:605-606,614-615,637-651,1568-1639；动态udp/tfo/checkurl；涉及真实连接与安全含义，不应默默照搬默认关闭证书或不等价UoT |
| 流量通知 | info=1 header与受限流量伪节点 | 双方支持主要用途 | 已实现子集 | subscription-info.mjs:3-44 | KOP:1068-1106；我方不复制任意标签/URL进通知；KOPflow=手填流量和STATUS伪节点/返回info结构不完全同 |
| 规则 | 大型antiAD文本配额与out=普通域名 | 旧20k/2Mi限制会拒绝；本轮已改为纯文本8Mi/250k | P1 本轮已修 | core.mjs:MAX_TEXT/convertResource; rules.mjs:MAX_LINES | KOP:Rule_Handle2335-2427无同等20k限制；真实公开原文已在隔离引擎复放；不能用缩小样本冒充完整 |
| 规则 | 裸域名/IP/CIDR混合列表与Clash域名payload | KOP启发式默认suffix；我方要求显式domain-set/domain-mode，混合裸IP不直接识别 | P2 不同输入约定 | rules.mjs:domainLine,clash/headless branches | KOP:1218-1225,2506-2567；动态rules-bare-list；直接复刻suffix推断会改变语义，必须区分格式而非默认扩大匹配 |
| 规则 | GEOIP/ASN、基础host/IP/UA/classical、DOMAIN-SET | 主要支持并校验 | 已实现 | rules.mjs:7-12,90-136 | KOP:Rule_Policy2430-2503；数据库类别实际取决于所用MMDB；不能算完整任意条件转换 |
| 规则 | 简单任意DOMAIN-REGEX | KOP转换有限简单语法，我方仅登记的确切表达式 | P2 正则子集差异 | rules.mjs:61-76 | KOP:2454-2465；动态rules-simple-domain-regex；不要求复刻复杂regex到glob的近似，应先补有证明的锚定字面子集 |
| 规则 | {# note #}行首说明 | KOP按宿主版本保留/剥除，我方失败 | P2 正常元数据缺口 | core.mjs:structured detection; rules.mjs:classical | KOP:1119-1142,1169,2431-2438；动态rules-notes；946时KOP剥注释后规则可用 |
| 规则 | 禁用行 / hide=0 | KOP能输出或忽略禁用行，我方拒绝负号条件/hash hide | P2 常用预览/迁移缺口 | rules.mjs:classical; options.mjs:41-46 | KOP:2387,2409,2415；动态rules-hide/rules-disabled-native；必须保持禁用，不得恢复活动规则 |
| 规则 | pset / replace / fcr / via / relay | KOP支持按条件改策略/文本/网络标记或节点转规则，我方hash拒绝 | P2 正常扩展未实现 | options.mjs:41-46; rules.mjs:extras handling | KOP:1518-1528,2416-2422,2572-2623；动态rules-pset/replace/network-flags；连接/接口改变必须显式使用，不能自动激活 |
| 规则 | no-resolve/pre-matching/extended-matching及特殊REJECT策略 | KOP移除或折为reject；我方默认拒绝，allow-resolve/policy可显式声明变义 | 有意语义边界 | rules.mjs:95-106 | KOP:2446-2451；动态rules-no-resolve；不计为默认必须忽略的字段 |
| 重写 | QX基础重写/302/307/四种静态reject体/HTTP脚本引用/jsonjq原生 | 主要支持 | 已实现子集 | rewrites.mjs:88-147 | KOP:2092-2203,3602-3707；KOP L2102/L3668-3669常删除行首^http的锚点，本实现保留来源锚点与内部pattern，不宣称转换后正则逐字相同；不能据此宣称整个Surge/Loon模块兼容 |
| 重写 | 成对引号包裹HTTP URL pattern | 旧实现保留引号；本轮去外层包装引号，保留内部转义与非HTTP字面词 | P2 本轮已修 | rewrites.mjs:pattern/native/foreignRewrite | KOP:3545-3570,3639,3699；动态rewrite-quoted-pattern及新增回归；不复制KOP对http_status等非scheme词的过宽处理；未作QX原生流量命中测试 |
| 重写 | Loon JSON-JQ / JSON del / JSON replace DSL | KOP转原生jsonjq；我方仅收原生jsonjq动作 | P2 常用转换缺口 | rewrites.mjs:102-104,132-147 | KOP:1771-2090,3644-3652；动态rewrite-jq；这是数据变换DSL，不等于来源JS eval |
| 重写 | Surge Map Local的简单内联静态正文 | KOP可转{}、[]、空文本/tiny-gif等；我方拒绝整个Map Local section | P2 常用转换缺口 | rewrites.mjs:153-155 | KOP:1640-1704,3635-3642；动态rewrite-map-local，{}→reject-dict；只应补可证明保留的静态子集 |
| 重写 | 重写资源混合原生分流 | KOP844+可混合；我方只接受rewrite而拒绝host行 | P2 常用模块差异 | core.mjs:detect; rewrites.mjs:149-168 | KOP:653,3623-3626,3673-3675；动态rewrite-mixed-filter；需有宿主版本支持依据和明确资源类型 |
| 重写 | echo-response本地Data文件 | KOP有条件保留本地文件引用；我方拒绝该动作 | P2/P3 显式依赖边界 | rewrites.mjs:88-104 | KOP:3691-3697；动态rewrite-native-echo-local；不应把远程URL或内联正文错当本地文件，也不能自动部署文件 |
| 重写 | header-replace/URL-REGEX→rewrite/dst | KOP有专门转换，我方未覆盖相同DSL/hash | P2 待逐型验证 | rewrites.mjs:132-147; options.mjs:41-46 | KOP:1722-1757,2148-2165；首个裸header样例KOP原样返回，不能算验证转换正确；带section需另验 |
| 重写 | 跨宿主脚本API、cron、CA、timeout/argument/binary-body/max-size | KOP可映射/忽略部分；我方声明兼容且仅限可表达字段，否则拒绝 | 有意安全/语义边界 | rewrites.mjs:107-130,153-163 | KOP:2119-2185,3689；动态rewrite-script-simple/qx-declared；不把执行源代码或私钥导入算默认必须支持 |
| 宿主 | helper UI与类型aliases、local首行参数 | 我方支持规范参数子集；未知项保留但转换会报错 | 已实现子集 | helper.mjs:1-34; core.mjs:53-64; options.mjs:59-69 | KOP:115-510,561-565,1196-1217；完整KOP schema字段不等于我方已实现；不能只有UI选项没有运行语义 |
| 宿主 | UA=1重试、扫码订阅引导、profile=111批量导入 | KOP支持host retry/URL Scheme通知；我方仅content/error | P2/P3 可选host功能 | core.mjs:completeResource; metadata/resource-parsers.json | KOP:535-552,811-832,948-977,1145-1164；动态node-user-agent-retry返回retry而非自行网络；此功能额外宿主行为需明确实现范围 |
| 宿主 | cnt/dbg/ntf/flow/b64等诊断及返回格式选项 | KOP有多个提示/返回info选项；我方受控本地用量通知、纯native文本返回 | P3 不同接口 | options.mjs:41-46; subscription-info.mjs:3-44 | KOP:603-649,1030-1106；不应回显真实订阅、节点凭据或来源原文来追求所有debug功能 |
| 执行扩展 | sfilter/srename Base64脚本 | KOP eval用户脚本；我方明确禁止 | 有意安全边界 | core.mjs:1-2; options.mjs:41-46 | KOP:3158-3177,3844-3860；不算默认必须支持，不能用任意JS执行填“完整” |

## 仍未实现与不同语义

上述矩阵里的“未实现”“不同输入约定”和“静默语义错误”均保留为真实缺口，不能计为已完成。特别是旧 KOP 的 numeric suffix 和 rename 占位符，在目前 NetAtlas 中仍按字面名称处理；这不是本轮已修复内容。SSD、旧式 Shadowrocket URI、regex/regout、关键词优先排序、pset、规则说明/禁用行、Loon JSON DSL 与 Map Local 等需要各自的格式依据和同输入回归，不能仅把参数放进白名单。

本轮不改这些节点名称或连接覆盖语义，避免在修复广告分流时扩大变更；普通 suffix 字符串与原创 JSON 字面替换接口继续保持现有合同。任意脚本执行、证书/私钥导入、不等价的安全或DNS字段丢失，不作为补全默认行为。

若曾依照旧NetAtlas说明把分流或hostname筛选的域名点号写成 `ads\.example`，应改回字面 `ads.example`；节点名称筛选中的 `\.` 仍用于字面点。本轮不增加任何模式开关。

## 本轮真实公开资源

截图原文为 [anti-ad-quanx.txt](https://github.com/privacy-protection-tools/anti-AD/blob/86b500b98c7a5f982e7da9ce13aa1bb0ed5b73bc/anti-ad-quanx.txt)，SHA-256 `a24d2a010cc6d6e777ce4caef6f97bd01b593adc2fe051b1b28a011c9f4b4be9`：3,868,444个ASCII字节，101,518条规则（另4行注释），`VER=20261101054604`。

```text
https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-quanx.txt#out=mycleanmymac.com+wxs.qq.com+mcs.zijieapi.com
```

旧KOP完整原文输出101,515条活动规则，仅删除三个指定域名，保留 `wxsnsad.tc.qq.com`、`wxsnsdy.tc.qq.com`、`wxsnsdy.video.qq.com`。旧NetAtlas先因2Mi/20k限额拒绝；10条缩样又复现6条近似误删。最终公开脚本的同输入逐行/顺序复核及全套检查记录见[验证记录](validation.md)。不会使用实际私人订阅作为公共夹具，也没有操作用户本地QX。

## 依据与复现

- 原始参考为 [KOP固定源码](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js)，SHA-256见页首；只参考接口行为，没有复制脚本实现。表中KOP行号均指此快照，NetAtlas旧行号指页首基线。
- 常用筛选语义依据：[节点Scheck](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L3114)、[分流Rule_Handle](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L2335)、[重写Rcheck与hostname](https://github.com/KOP-XIAO/QuantumultX/blob/f0177f5ea2f62681ab2592a4ed54677dfbbc4b78/Scripts/resource-parser.js#L2272)。
- 离线稳定回归：[大型规则](../tests/scripts/resource-parser-large-rules.test.mjs)、[字面筛选与引号边界](../tests/scripts/resource-parser-literal-filter.test.mjs)；真实公开文件在隔离Apple JavaScriptCore执行，离线CI不依赖会变化的公网数据。
- 53组审计覆盖每类最小样例，不等于穷举全部输入；KOP偶有仅返回原文或异常内容，不能把存在content当正确转换。QX App原生导入和实际远端流量未在本轮执行。
