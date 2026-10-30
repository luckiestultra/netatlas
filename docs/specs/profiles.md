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

使用者需要添加自有节点、把它加入 Proxy 并主动选择。图形应用可能保留旧选择，导入后必须核对实际选项；模板的首项不是应用运行状态证明。category 不参与策略或顺序计算。

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
