# 客户端配置规格

状态：已批准；八个目标使用独立原生适配。能力范围见 [能力表](../capabilities.md)，语法来源见 [客户端格式](../client-formats.md)。

## 输入与输出

客户端 ID 固定为 quantumultX、surge、loon、shadowrocket、egern、stash、mihomo、singBox。服务和功能 ID 使用小写英文与短横线。

tools/lib/profiles.mjs 导出 renderProfile(client, {rulesets, baseUrl}) 和 profileFormats。结果为 path、content、format；主配置位于 profiles/default.<原生扩展名>。工具按客户端原生格式内联规范规则，因此主配置不依赖尚未发布的远程规则 URL。

公开路径按用途组织：

~~~text
clients/<client>/
├── profiles/
├── rules/<具体应用或服务ID>.<原生扩展名>
├── rewrites/
├── scripts/
├── modules/
├── fragments/
├── README.md
└── manifest.json
~~~

不支持或尚未实现的可选功能不生成占位文件。相同扩展名不代表相同 schema；Egern 的规则集、Mihomo classical YAML 和 sing-box headless JSON 分别生成并验证。

## 路由与初始选择

metadata/routing.json 是策略默认值与顺序的独立来源，当前约定：

- lan、china 明确 DIRECT，adblock 明确 REJECT。
- apple 选择组初始指向 DIRECT；其他普通服务组初始指向 Proxy。
- lan、adblock 排在前面；google、microsoft 排在后面；其他服务按稳定 ID 排序，保留具体服务优先于宽泛集合的安排。
- 最终策略为 Proxy。Proxy 以 REJECT 为首项，DIRECT 是明确可选项，不包含虚构节点或订阅。

使用者在私有 JSON 输入提供本客户端原生 nodes 和/或 subscriptions，工具生成完整原生配置并自动连接 Proxy。显式 selectedProxy 决定私有节点选择，未指定且有本地节点时使用第一个；只有原生 URL 来源时由应用加载后手选。公开无凭据配置仍以 REJECT 初始化。图形应用可能保留既有选择，不以首项推断当前状态。

private-profile.mjs 与 tools/profile.mjs 负责本地订阅的受限拉取和原生节点 materialize、权限、输入/旧输出保护。六种客户端保留原生订阅；sing-box/Shadowrocket 不伪造 provider，支持格式在本地展开。复杂未实现的握手字段明确失败而非静默删除。输入/输出仅限忽略目录 private/，不触碰用户现用客户端配置。

DNS 与 CN 分流是完整配置的一部分。当前 CN 含8,387域名、6,174 IPv4、3,475 IPv6；在具体服务后作为兜底。基础设施 resolve 动作单独验证，不当作规范规则；CN CIDR 允许主动解析而 LAN CIDR 保留 no-resolve。DNS 独立处理 bootstrap、国内、远端与 LAN，代理自己的地址不通过自身代理递归解析。细节见[完整接入](../profile-setup.md)。

校验器区分公开新建组 REJECT 默认与私有实际节点选择，识别本地节点、原生来源/匹配器及必要基础设施规则。闭源 GUI 无环境时使用官方与固定高星配置交叉验证，并明确没有原生运行证据。

## 原生边界

- 主配置不自动安装证书、开启 MITM、读取当前配置或切换系统代理；可选功能另行导入。
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

主配置必须非空、结构可解析、策略引用存在、规则顺序明确，并且不依赖未发布资源。八种目标都执行结构与语义检查；Mihomo、sing-box 另用固定版本内核检查。其余六个应用标记 manual-import-required，未原生导入或未观察真实流量时不宣称通过。
