# 能力与验证范围

先按软件选择发布目录，再按用途取用主配置、分流、重写、脚本或功能包。规范规则只维护一份，输出保留各客户端原生格式。

## 客户端能力

| 客户端 ID | 主配置 | 独立分流规则 | 本仓库可选功能 | 原生验证入口 |
|---|---|---|---|---|
| quantumultX | INI .conf | .list | GeoIP、搜索跳转、HTTPS 升级；anti-AD 合并片段 | manual-import-required |
| surge | INI .conf | .list | GeoIP 面板、搜索跳转、HTTPS 升级、anti-AD 模块 | manual-import-required |
| loon | INI .conf | .list | HTTPS 升级插件；anti-AD 合并片段 | manual-import-required |
| shadowrocket | INI .conf | .list | HTTPS 升级与 anti-AD 均为手工合并片段 | manual-import-required |
| egern | 原生 YAML | 原生 *_set YAML | HTTPS 升级与 anti-AD 原生模块 | manual-import-required |
| stash | YAML | classical YAML | HTTPS 升级与 anti-AD 原生覆写 | manual-import-required |
| mihomo | YAML | classical YAML | anti-AD 规则与合并片段；不伪造 HTTP 重写能力 | 固定版本内核可检查 |
| singBox | JSON | 原生 headless JSON | anti-AD 规则与合并片段；不伪造 HTTP 重写能力 | 固定版本内核可检查 |

QX 主配置默认接入 GeoIP 显示，重写、MITM 和其他可选功能不默认启用。默认主配置远程引用 114 组、29,103 条；anti-AD 的100,682条与global的6,985条为可选独立资源。Loon HTTPS-upgrade 要求 3.5.1(978)+；六个图形客户端尚未实际导入，结构和文本验证不等于设备实测。GeoIP 脚本仍仅适配 QX、Surge，不能把新原生规则资源理解成已实现其他宿主的 JS API。客户端来源及目标版本见 [metadata/clients.json](../metadata/clients.json)，当前验证证据见 [验证记录](validation.md)。

Mihomo 固定检查版本为 1.19.33，sing-box 为 1.14.4；二进制资产及 SHA-256 登记在 [native-tools.json](../metadata/native-tools.json)。其余六个应用必须在实际应用中导入后另行记录，结构检查和 JS VM 测试不能替代这一步。

## 内容入口

| 用途 | 路径 |
|---|---|
| 主配置 | clients/<client>/profiles/ |
| 按具体应用或服务订阅分流 | clients/<client>/rules/<id>.<原生扩展名> |
| 纯重写资源 | clients/<client>/rewrites/ |
| 已适配的 JavaScript | clients/<client>/scripts/ |
| 原生功能安装包 | clients/<client>/modules/ |
| 需要手工合并的配置片段 | clients/<client>/fragments/ |
| 输出文件与验证边界 | 对应客户端 README.md、manifest.json |

rules/ 直接放 openai、netflix、github 等具体服务 ID，不增加 ai、media、system 目录。规范源中的 category 只是内部整理标签，不能改变分流策略或规则顺序。

## 实现边界

| 模块 | 拥有的数据与行为 | 接口与规格 |
|---|---|---|
| 规则数据 | 匹配事实、来源、许可、固定版本、内容校验值 | [规则规格](specs/rules.md) |
| 客户端配置 | 原生语法、策略组、DNS 与最终策略 | [配置规格](specs/profiles.md) |
| 功能包 | GeoIP、诊断纯函数、明确适配的重写与脚本 | [功能规格](specs/features.md) |
| 构建验证 | 统一输出、引用检查、内容清单、原生验证入口 | [构建规格](specs/build.md) |

固定策略和规则顺序保存在 [routing.json](../metadata/routing.json)，主配置业务/地区选择层在 [managed-policies.json](../metadata/managed-policies.json)；不从 category 推断路由。更多实现说明见 [架构](architecture.md)、[客户端格式](client-formats.md)和[可选功能](features.md)。

完整八端功能、110类逐项对照和明确剩余差异，统一见[逐项覆盖](coverage.md)。六GUI现有快速搜索、扩展跳转及三个外部工具包；脚本解析器/定位/正文入口按宿主分别登记，不声明各软件功能完全相同。
