# 功能包规格

状态：已批准；实际产物与用法见 [可选功能](../features.md)，登记项见 [features.json](../../metadata/features.json)。

## 模块边界

src/features/ 按功能保存纯逻辑及明确的客户端适配器。tools/lib/features.mjs 导出 renderFeatures(client, {baseUrl})，返回相对于 clients/<client>/ 的 path、content 数组。

- scripts/ 放客户端可执行的 JavaScript。
- rewrites/ 放纯重写资源，即便其原生文件格式是 .sgmodule。
- modules/ 只放组合功能安装包或明确说明如何合并的配置片段。

metadata/features.json 记录用途、支持客户端、执行入口、数据源、MITM 范围、输出路径、官方依据和验证边界。没有实现的客户端返回空产物，不生成假兼容脚本。

## GeoIP 行为

共享纯核心 src/features/geoip/core.mjs 支持 IPinfo、ipwho.de、ip-api 响应格式。外部字段必须校验类型；空 ASN、空组织、无城市、无数据、错误 JSON、API 错误状态、限流和传输超时不得导致未完成回调。

结果保留来源给出的地理信息，不推断物理机房，不硬编码某国或某个用户 IP，不填入虚构城市或运营商。收到响应、定位成功和网络整体正常是不同事实。

QX 原生适配器只解析 $response，不再联网或更改节点。生成的 modules/geoip.conf 是 [general] 合并片段，不是重写订阅；它的脚本 URL 只有对应文件推送到公开提交后才能使用。

Surge generic 面板的一次查询明确指定已有策略名，默认 Proxy。该选项只影响本次查询，不切换策略组、不读取账户偏好，也不代表其他请求采用相同路由。请求、看门狗和晚响应共用一次完成保护。

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
