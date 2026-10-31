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

共享纯核心 src/features/geoip/core.mjs 支持 IPinfo、ipwho.de、ip-api 响应格式。外部字段必须校验类型；空 ASN、空组织、无城市、无数据、错误 JSON、API 错误状态、限流和传输超时不得导致未完成回调。

结果保留来源给出的地理信息，不推断物理机房，不硬编码某国或某个用户 IP，不填入虚构城市或运营商。收到响应、定位成功和网络整体正常是不同事实。

QX 原生适配器只解析 $response，不再联网或更改节点。生成的 fragments/geoip.conf 是 [general] 合并片段，不是重写订阅；它的脚本 URL 只有对应文件推送到公开提交后才能使用。

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

本轮增加原创47动作快速搜索、固定GPL完整59动作跳转与独立BiliIntl参数资源（六GUI）；三类官方工具18个可选安装包；QX/Loon两个外部解析器片段；原创Surge正文替换。安装格式、许可、入口权限、直接依赖固定范围和nativeApp:not-run分别登记，不以核心不支持的格式伪造Mihomo/sing-box模块。完整机器清单为metadata/features.json、metadata/integrations.json、metadata/resource-parsers.json和metadata/coverage.json。

## QX 正则缺口的可选兼容处理

严格源正则覆盖保持14/24，不给兼容资源计无损覆盖。两个独立原生分流资源只解决ChatGPT Azure端点与ViuTV/Now E CDN的实际策略归类，明确额外匹配非数字及可能跨标签主机名，默认/standalone均不启用。接入片段要求手工前置资源、选择正确业务策略并关闭App分流匹配优化；不编造配置字段或改本机设置。Google已有普通后缀覆盖，不新增近似的CN直连集合。

Speedtest广告只提供独立HTTP及HTTPS重写，保留源主机名正则、完整authority边界和有效端口；HTTP版无MITM，HTTPS版单独列出所需hostname与人工CA信任前提，不能算作DNS、UDP、HTTP/3或任意TCP域名规则恢复。无脚本、证书、私人节点、定时任务或自动启用。源表达式、扩大范围反例、默认关闭、策略/顺序和逐URL正反例必须测试，六GUI实测边界继续保留。
