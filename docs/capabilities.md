# 能力与验证范围

先按软件选择发布目录，再按用途取用主配置、分流、重写、脚本或功能包。规范规则只维护一份，输出保留各客户端原生格式。

## 客户端能力

| 客户端 ID | 主配置 | 独立分流规则 | 本仓库可选功能 | 原生验证入口 |
|---|---|---|---|---|
| quantumultX | INI .conf | .list | GeoIP 响应解析、搜索重定向 | manual-import-required |
| surge | INI .conf | .list | GeoIP 手动面板、搜索重定向 | manual-import-required |
| loon | INI .conf | .list | 暂无已实现适配器 | manual-import-required |
| shadowrocket | INI .conf | .list | 暂无已实现适配器 | manual-import-required |
| egern | 原生 YAML | 原生 *_set YAML | 暂无已实现适配器 | manual-import-required |
| stash | YAML | classical YAML | 暂无已实现适配器 | manual-import-required |
| mihomo | YAML | classical YAML | 不输出这些 JS/HTTP 功能包 | 固定版本内核可检查 |
| singBox | JSON | 原生 headless JSON | 不输出这些 JS/HTTP 功能包 | 固定版本内核可检查 |

“暂无适配器”描述本仓库的实现范围，不推断客户端完全没有该能力。八个目标均有独立主配置与规则导出；这不等于八个原生应用都已实测。客户端来源及目标版本见 [metadata/clients.json](../metadata/clients.json)，当前验证证据见 [验证记录](validation.md)。

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

默认策略和先后顺序单独保存在 [routing.json](../metadata/routing.json)，渲染器读取它，不从 category 推断路由。更多实现说明见 [架构](architecture.md)、[客户端格式](client-formats.md)和[可选功能](features.md)。
