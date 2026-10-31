# 验证方法与记录

本记录对应 2026-10-31 的本地扩展批。发布和远程 Linux CI 必须核对对应提交的 [Actions](https://github.com/luckiestultra/netatlas/actions/workflows/ci.yml)，不能拿先前已发布版本的绿灯代替这批代码。

## 内容与证据范围

| 项目 | 本批结果 |
| --- | --- |
| 默认配置 | 八客户端，38 组 / 5,459 条，规则内联 |
| 可选 anti-AD | 100,682 个后缀，不进入默认主配置 |
| 完整规则目录 | 39 组 / 106,141 条；八种原生导出 |
| 生成文件 | 357 个，确定性构建及清单哈希通过 |
| 离线测试 | 180 项：178 通过、0 失败、2 项显式原生测试跳过 |
| 实际固定内核 | macOS ARM64 / Linux x64 Mihomo 1.19.33、sing-box 1.14.4 |
| 完整默认配置检查 | 两套通过，报告明确 embeddedRulesets=38 |
| sing-box 独立规则编译 | 39/39 通过，包括完整 anti-AD |
| 真实基础路由 | 80/80，通过 HTTP 与 SOCKS5 实际请求 |
| 真实可选 provider | 16/16，通过完整 anti-AD 本地镜像及两个内核 |
| GeoIP 实时源 | IPinfo、ipwho.de HTTP 200；生成 QX 脚本 VM 契约通过 |

两个显式原生测试由 `npm run test:native` 独立执行，同一套断言已实际通过；跳过它们的离线套件不冒充原生结果。六个 GUI 客户端尚未导入，结构检查、JavaScript VM 和模拟数据不等于设备运行。

## 红蓝职责与对抗方式

红方在独立上下文中只拿代码及验收契约，查原生格式、错误输入、路径边界、许可、来源和发布语义。蓝方另外编写 fixture，不以直接运行红方脚本替代独立复现；修复后还核对旧数据、外部目录整树和权限，避免只看抛错就算通过。

用户选择独立 Agent 红蓝验证；本批没有启动额外外部模型 CLI。研究、实现、攻击与交叉复现分开，不声称这些 Agent 使用了不同模型架构。

| 攻击/缺口 | 修复和复核 |
| --- | --- |
| 域名带 `/path`、`?query`、`#fragment` 被 IDNA 入口静默截断 | 原始输入先拒绝 URL/控制字符。完整同步负例验证旧规则与 metadata 逐字节不变；DLC 的合法 `#` 注释与 JSON 源中的坏 fragment 分开测试 |
| metadata 父目录 symlink 可覆盖仓库外文件；build cache 可在外部写批次 | 检查所有受管父路径；蓝方证明外部整个文件树、旧规则和 clients 不变 |
| native 安装/报告路径 symlink 可能先下载或执行再拒绝 | 13 项独立红测要求下载/执行次数均为零、外部字节与权限不变，修后全部通过 |
| HTTPS 固定投影可重复条目或换入未登记规则 | 校验精确主机集合、唯一性、原文行、origin/destination 及规范化路径边界。蓝方 2 正例/7 负例交叉复测 |
| Apple/GitHub 父域可能吞掉 TV/Copilot/npm 子组 | 调整顺序，并在真实内核中令父组 DIRECT、子组走本地 SOCKS。只在临时副本反转顺序时，Mihomo 用例按预期失败 |
| 原生检查可能读取旧成品却标记新目录 | published profile/规则/可选安装片段必须逐字节匹配当前渲染结果，否则先明确要求 build，不调用内核假通过 |
| 多来源 `--revision` 可能把同一 SHA 误用于另一仓库 | 多来源必须指定 `--repository`，在任何下载或恢复写入前拒绝歧义。未选来源保持原版本和输出；真实双源定点 dry-run 不漂移 |

## 实际 provider 运行，避免假阳性

首次实际大集测试失败：Mihomo listener 已开放，但 `/providers/rules` 显示 `ruleCount=0`，所有请求都是 502，前两个预期拒绝因此曾表现为假阳性。相同进程加载到 100,682 后，根域/子域明确命中 `RuleSet` 使用 REJECT，两个边界对照命中 `Match` 使用 DIRECT。

测试现在先读取真实 provider 状态，要求数量完整加载，之后才发断言请求；不盲加 sleep 或把 502 当作拦截成功。临时控制接口只绑定随机回环地址并使用随机 nonce，主配置没有因此增加管理端口。状态门禁另测零规则、错误数量/类型、401、缺 provider、坏 JSON、进程退出，均不能误判就绪。

首次发布提交 `0858b5f` 的 Linux CI 又暴露第二个启动窗口：provider 数量完整后仍可能立即关闭外部连接。固定 Mihomo 源码顺序为 `loadProvider → runtime.GC → tunnel.OnRunning`；因此 provider 完整不代表 tunnel 已进入 Running。[官方配置生命周期](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/hub/executor/executor.go) 与 [TCP 入口](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/tunnel/tunnel.go) 直接说明这个窗口。

修复同时要求 [CLI `-post-up`](https://github.com/MetaCubeX/mihomo/blob/v1.19.33/main.go) 完成信号与真实 provider 数量。`post-up` 仅在完整 `hub.Parse` 返回后执行；其输出会被捕获，所以使用临时受管目录内的随机原子 marker 文件。官方 hook 的真实 FIFO 受控实验确认：provider 已完整时新门禁仍未返回，收到释放事件并生成 marker 后才继续；没有给路由请求加重试或固定 sleep。另加 5 组单测覆盖先到、后到、缺失、错误标记、进程退出和参数边界。失败诊断保留 DNS/目标次数和内核日志尾部，并隐去临时控制密钥。

本地隔离 Linux x64 旧批也曾单次通过，说明 CI 失败是时序敏感问题；不能把一次成功当成启动条件充分的证明。后续发布结果须核对修复提交自身的 CI。

真实可选测试使用发布规则文件及安装片段，只将远程 URL 换为等价本地文件；根域/子域拒绝，近似域与 `.invalid` 对照放行，目标 HTTP 服务恰好收到 8 次请求。默认路由另外验证 80 个用例和实际 SOCKS 上游连接，不依赖自家 decoder 推导命中。

所有路由 fixture 的 DNS、HTTP、SOCKS 和控制接口仅在回环地址；不访问这些广告/应用域名的真实服务器，不切换系统代理，不读取用户正在运行的客户端配置。

## 来源与可复现性

- DLC 固定 `1daade8c4bb957d21d1f5c09c2b050d699e8e96c`；新增 23 个服务，原 15 组文件 SHA 与原 9 次显式排除保持不变。
- anti-AD 固定 `cafc2bfb031a9e5ee4461721afc65b82430f2c15`。使用原生 Surge DOMAIN-SET，不从 plain 文本猜匹配类型；后缀根集合与固定 Clash 文件双向一致。直接来源声明 MIT，原许可与聚合 credits 保留。
- 同步普通文件限 1 MB，该登记源限 3 MB、硬上限 4 MB、总预算 24 MB。固定版与真实单源 revision CLI 重放均 `changed:false`，235 文件 / 2,240,318 字节。
- HTTPS-upgrade 保留完整固定 GPL-2.0 原文、许可、修改说明及源 SHA，仅选择六个同主机升级；不是 MIT，也不是完整上游 Redirect 模块。六站 HTTPS HEAD 证书校验通过，不代表每条路径或原生截获已实测。
- DualSubs 部分 bundle 的根 SPDX 与依赖许可不一致，且对应 protobuf 源不可公开读取；未导入这些 bundle 或宽权限偏好 API。Sub-Store 的订阅存储、自动上传和 AGPL 需独立方案。星标与近期 repo 提交不是直接入库的充分条件。

来源、SHA、许可和版本见 [规则登记](../metadata/upstreams.json)、[功能登记](../metadata/features.json)、[HTTPS 来源](../metadata/https-upgrade.json) 及 [第三方声明](../THIRD_PARTY_NOTICES.md)。

## 复现与报告

~~~sh
npm ci
npm test
npm run build
npm run check
npm run sync -- --dry-run
npm run test:native
npm run test:live
~~~

确定性清单记录生成阶段的结构/引用/语义结果，`native:not-run` 仅描述构建阶段。真实报告位于忽略的 `.cache/native-check/latest.json`，含时间、固定二进制 SHA、默认/可选数量、输入与检查副本 SHA、provider 就绪记录、实际请求及 DNS 证据。构建前后输入快照变化、源/许可校验值错误、手改产物或清单均阻止覆盖；旧批次以移动保留备份。

六 GUI 的真实导入、合并优先级、证书/设备资源影响仍是明确缺口；本批没有在用户客户端安装证书、启用可选功能或更改配置。公开直链及远程 CI 需要发布后按新提交另行核验。
