# 构建与验证规格

状态：已批准；当前执行结果由 [验证记录](../validation.md)单独保存，不能从此规格推断全部检查已完成。

## 构建接口

~~~sh
npm ci
npm test
npm run build
npm run build -- --check
npm run build -- --base-url https://raw.githubusercontent.com/luckiestultra/netatlas/main
npm run validate
npm run validate -- --rules
npm run validate -- --client mihomo
npm run test:native
npm run test:live
~~~

使用自定义公开地址时，构建、比较与验证使用相同参数：

~~~sh
npm run build -- --base-url https://example.test/netatlas-fork
npm run build -- --check --base-url https://example.test/netatlas-fork
npm run validate -- --base-url https://example.test/netatlas-fork
~~~

`npm run check` 使用仓库默认公开地址；自定义地址使用上面两条显式比较与验证命令。

Node.js 限定为 24.x，依赖从 lockfile 安装。构建全量生成八个客户端，支持 --check 和 --base-url；不提供 --client 构建模式。--check 只比较预期产物，不写入工作树。validate 可筛选规则或客户端。

默认主配置只保留原生设置、节点/订阅入口、策略和本客户端远程规则引用；独立资源需要与主配置一同发布并验证路径及原生语义。standalone 内联同一默认数据供离线或高级接入使用。公开 URL 必须存在于相应发布提交；本地构建成功不能证明公网已更新。验证主配置的资源顺序、目标策略和引用闭包，另验证 standalone 的逐条规范语义。

tools/build.mjs 负责统一生成与原子发布 clients/；失败不能只替换一部分目标。相同输入必须得到相同字节。清单记录输入、输出校验值、来源版本、目标格式和验证边界，不写入随当前时钟漂移的内容。

## 验证层级

1. 输入：源格式、许可、固定提交、域名/CIDR、输入校验值和逐条排除说明。
2. 语义：转换前后正反例、根域名/子域名边界、IPv4/IPv6、规则顺序、默认策略与引用。
3. 原生格式：固定 Mihomo 1.19.33、sing-box 1.14.4 内核检查；其余六个应用只做已实现的结构检查并标记 manual-import-required。
4. 运行行为：本地测试服务的真实路由、原生应用导入、GeoIP 实时响应和重写结果分别记录，未运行不能标通过。

原生二进制版本、下载资产及 SHA-256 在 metadata/native-tools.json。临时缓存和诊断输出位于被忽略目录，不进入发布产物或 fixture。

## CI

.github/workflows/ci.yml 在 main 分支推送、pull_request 和手动触发时，用 Linux 和 Node 24 执行 npm ci、npm test、构建 --check、validate 和 test:native。实时 GeoIP 查询不作为离线回归门禁。工作流只授予 contents: read，不提交、推送、创建 PR 或发布站点。

官方 Actions 固定到已核对的完整提交，而不是运行时可变标签：

| Action | 核对版本 | 固定提交 |
|---|---|---|
| [actions/checkout](https://github.com/actions/checkout/releases/tag/v7.0.1) | v7.0.1 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| [actions/setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0) | v7.1.0 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | v7.0.2 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |

## 上游检查与发布

upstream-check.yml 只由 workflow_dispatch 手动触发。它在临时 checkout 获取候选上游、运行检查、生成差异与 review artifact，不自动 commit、push 或创建 PR。失败任务产生的 artifact 仅用于诊断，不能视为候选已验证。

维护者审查来源、许可、精确排除项、规则差异和测试后，再决定是否把候选应用到仓库。工作流没有发布授权。分支保护、远程 Actions 运行和公开下载链接仍需在实际 GitHub 仓库设置及运行中核对，本地解析 YAML 不代表远程 CI 已运行。
