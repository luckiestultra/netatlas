# 客户端配置规格

状态：已批准；八个目标使用独立原生适配。能力范围见 [能力表](../capabilities.md)，语法来源见 [客户端格式](../client-formats.md)。

## 输入与输出

客户端 ID 固定为 quantumultX、surge、loon、shadowrocket、egern、stash、mihomo、singBox。服务和功能 ID 使用小写英文与短横线。

`tools/lib/managed-profiles.mjs` 导出 `renderManagedProfile(client, {rulesets, baseUrl, ...options})`，结果为 `path`、`content`、`format`，生成公开默认配置 `profiles/default.<原生扩展名>`。默认配置使用 40 个本仓库远程规则资源和客户端原生节点/订阅入口，日常接入在 App 中完成，不要求用户运行生成器。`baseUrl` 决定同一仓库发布根地址；规则 URL 指向 `clients/<client>/rules/<id>.<原生扩展名>`。

`tools/lib/profiles.mjs` 的 `renderProfile(client, {rulesets, baseUrl, ...options})` 与 `profileFormats` 保留为高级内联接口。它仍返回 `profiles/default.*` 形式的内部结果路径；构建器将这份内容另存为 `profiles/standalone.<原生扩展名>`，同时保留默认远程资源配置。内联文件不依赖远程规则 URL；私有 CLI 继续按指定输出路径生成内联配置。

公开路径按用途组织：

~~~text
clients/<client>/
├── profiles/default.<原生扩展名>
├── profiles/standalone.<原生扩展名>
├── rules/<具体应用或服务ID>.<原生扩展名>
├── rewrites/
├── scripts/
├── modules/
├── fragments/
├── README.md
└── manifest.json
~~~

不支持或尚未实现的可选功能不生成占位文件。相同扩展名不代表相同 schema；Egern 的规则集、Mihomo classical YAML 和 sing-box headless JSON 分别生成并验证。

`rules/` 按具体 App/服务 ID 平铺，不按业务、类别或地区增加路径层级。规则内容更新由 App 独立刷新，默认远程间隔一天；Loon 使用 App 自身的规则刷新机制。策略、DNS 或功能配置变化属于主配置升级。生成和本地检查不等同于远程发布完成，发布时必须让主配置引用的规则与脚本路径实际可用。

## 路由与初始选择

`metadata/routing.json` 保留规则默认值与顺序，`metadata/managed-policies.json` 定义默认 App 配置的中文业务映射和地区匹配器。默认配置约定：

- lan、china 明确 DIRECT，adblock 明确 REJECT。
- “苹果服务”初始指向 DIRECT；AI服务、谷歌服务、微软服务、开发服务、即时通讯、游戏平台、国外媒体、国外网站初始指向“节点选择”。
- lan、adblock 排在前面；google、microsoft 排在后面；其他服务按稳定 ID 排序，保留具体服务优先于宽泛集合的安排。
- 最终策略为“漏网之鱼”，初始跟随“节点选择”。多数客户端的“节点选择”以 REJECT 为首项，DIRECT 可明确选择；QX、Shadowrocket 初始使用 App 内置 `proxy`/`PROXY`，不能脱离 App 的实际节点与选择状态推断连通性。没有虚构的活动节点或订阅。
- 提供“自动选择”以及香港、台湾、日本、韩国、新加坡、美国六个地区组。地区按节点名称筛选，只使用真实匹配节点；不承诺空地区组会自动回退到其他地区。

原生接入方式各自独立：QX 在 App 中添加节点资源，Shadowrocket 使用首页订阅与内置 PROXY；Loon 使用 Remote Proxy 和 Remote Filter；Surge 使用 policy-path 来源组并显式连接选择组；Egern 编辑“节点订阅”的 urls，自动/地区组以 flatten/filter 展开；Stash、Mihomo 填写原生 proxy-providers 并连接 use/include-all。sing-box 内核没有通用原生订阅 provider，需填写真实 outbounds 以及 selector/urltest 成员，也可由支持订阅合并的图形壳或可选高级工具完成。各 App 可能保留既有选择，不以首项推断当前状态。

高级内联配置保留英文 `Proxy` 及原有服务组。使用者可在私有 JSON 中提供本客户端原生 nodes 和/或 subscriptions，工具生成并连接 Proxy。显式 selectedProxy 决定私有节点选择，未指定且有本地节点时使用第一个；只有原生 URL 来源时由应用加载后手选。无私人输入的内联文件以 REJECT 初始化。

`private-profile.mjs` 与 `tools/profile.mjs` 作为高级工具，负责本地订阅的受限拉取、原生节点 materialize、权限和输入/旧输出保护。六种客户端保留原生订阅；sing-box/Shadowrocket 不伪造 provider，支持格式在本地展开。复杂未实现的握手字段明确失败而非静默删除。输入/输出仅限忽略目录 private/，不触碰用户现用客户端配置。格式、协议范围、失败保护与命令见[完整接入](../profile-setup.md)。

DNS 与 CN 分流是完整配置的一部分。40 个默认资源包含 29,103 条规范规则；当前 CN 含 8,387 域名、6,174 IPv4、3,475 IPv6，在具体服务后作为兜底。基础设施 resolve 动作单独验证，不当作规范规则；CN CIDR 允许主动解析而 LAN CIDR 保留 no-resolve。DNS 独立处理 bootstrap、国内、远端与 LAN，代理自己的地址不通过自身代理递归解析。默认配置通过原生规则资源参与 DNS 分类，不再批量内联同一批域名；高级 standalone 保留完整内联。细节见[完整接入](../profile-setup.md)。

校验器区分默认 App 配置与高级内联配置，以及 REJECT 初始选择、App 内置节点选择和私有实际节点；识别本地节点、原生来源/匹配器及必要基础设施规则。闭源 GUI 无环境时使用官方与固定高星配置交叉验证，并明确没有原生运行证据。

## 原生边界

- 主配置不自动安装证书、开启 MITM、读取当前配置或切换系统代理；可选功能另行导入。
- QX 默认主配置已接入 GeoIP 查询脚本，独立片段继续用于其他已有配置。重写默认关闭，只有用户选用的客户端功能才按各自原生入口启用；GeoIP 不能推导为其他宿主已有同等脚本 API。
- Mihomo、sing-box 的本地代理入口仅绑定回环地址；其他入口边界按客户端原生配置与应用设置分别说明。
- 四类规则不能表达的能力不做近似转换。脚本、重写、执行时机与请求路由按客户端单独适配。
- sing-box 使用固定目标版本的现代路由与 DNS schema；不把历史迁移印象代替当前官方定义。
- 不把本地 fixture 节点或测试服务写入发布主配置。

## 命令与验收

~~~sh
npm run build
npm run build -- --check
npm run validate -- --client quantumultX
npm run validate -- --client singBox
npm run test:profiles
~~~

构建统一生成八个目标，不提供单客户端 --client 构建开关。验证器支持 --client 筛选。

default 与 standalone 都必须非空、结构可解析、策略引用存在、规则顺序明确。默认配置须引用同一构建实际生成的规则文件，并独立检查远程拉取和更新路径；standalone 须检查完整内联规则。八种目标都执行结构与语义检查；Mihomo、sing-box 另用固定版本内核检查和受控流量验证。其余六个应用标记 manual-import-required，未实际导入或未观察真实流量时，不将文档交叉核对、解析测试或字段断言宣称为 GUI 验证通过。

扩展规则、五种匹配类型及可选工具来源见[覆盖清单](../coverage.md)。
