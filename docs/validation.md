# 完整配置验证记录

本记录对应八客户端节点、订阅、DNS 和分流补全批。公开配置、私有生成文件和受控测试配置分开记录；没有拿前一提交的 CI 绿灯代替本轮检查。

## 当前配置与来源

| 项目 | 内容 |
| --- | --- |
| 默认配置 | 8 客户端，40 组 / 23,476 条内联规则 |
| 完整规则目录 | 41 组 / 124,158 条，含可选 anti-AD 100,682 条 |
| 生成产物 | 381 个，包含八份私有接入输入示例 |
| CN 数据 | 域名8,387，IPv4 6,174，IPv6 3,475；固定MIT源 |
| 上游定点同步 | 519文件 / 2,506,997字节，dry-run changed:false |
| DNS 在线可达性 | AliDNS / Cloudflare IP DoH POST均200、rcode=0、A答案2；TLS验证开启 |
| Native 版本 | Mihomo 1.19.33 / sing-box 1.14.4，固定官方发行包SHA |

高星完整配置与官方资料交叉核对，来源的 star 快照、仓库活跃时间、实际文件提交时间和许可分别记录于 [profile-references.json](../metadata/profile-references.json)。没有复制无许可仓库脚本、规则、证书或转换器宏。CN来源详见[规则登记](../metadata/upstreams.json)；保留3条精确非可移植表达式，不宣称与完整原生 GeoSite 等价。

## 真实使用流程

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

## 最终统一检查

最终本地统一结果：离线278项（275通过、0失败、3项显式原生opt-in跳过）；原生套件另在macOS ARM64及隔离Linux x64实际执行，两平台均通过两套公开完整配置、41规则编译、80基础+16可选+32完整私有流程，共128路由用例；四个DNS角色及真实订阅更新有独立证据。公开实际输入SHA与最终成品匹配。对应GitHub CI与公开字节在本次提交推送后单独核对。机器证据保存于忽略目录 `.cache/complete-*` 和 `.cache/native-check/latest.json`；运行报告的输入SHA必须对应实际最终文件。不要把本记录的设计说明误读为尚未执行检查已通过。

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
