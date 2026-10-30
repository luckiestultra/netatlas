# 规格：规则数据（rule-data）

状态：待评审。能力地图见 [CAPABILITY_MAP.md](CAPABILITY_MAP.md)。

## 目标与接口

建立一份可追溯的公共规则源，供八个客户端适配；不在规则数据里掺入代理组、DNS、优先级与最终策略。

首版标准类型为 `domain`、`domain-suffix`、`ip-cidr`、`ip-cidr6`。不支持的输入类型必须报错并定位来源，不静默忽略。域名后缀匹配是否包含根域名有明确测试。

```json
{"version":1,"id":"openai","category":"ai","entries":[{"type":"domain-suffix","value":"openai.com"}]}
```

`id` 是稳定接口；`category` 只用于目录查找。每个规则集另有来源条目，记录原始 URL、作者、许可、固定提交或版本、内容 SHA-256、转换方式和更新时间。

## 结构与技术

- `src/rules/<分类>/<id>.json`：规范规则事实。
- `metadata/upstreams.json`：上游登记；许可不明的内容不可自动导入再发布。
- `tools/sync.mjs`：抓取与标准化；上游代码不作为可执行输入。
- `tests/rules/` 与 `tests/fixtures/`：正反例与不含私人信息的样本。
- 构建环境采用 Node.js 24；JSON 为源格式，YAML 仅用于需要它的客户端输出。

## 命令（实现后提供）

```sh
npm run sync -- --dry-run
npm run validate -- --rules
npm run test:rules
```

## 测试与验收

- 覆盖 AI、开发、媒体、社交、系统、网络与隐私分类；初始目录至少包含 OpenAI、Claude、Gemini、Google、Microsoft、Apple、GitHub、Telegram、YouTube、Netflix、Spotify、Speedtest 与 LAN 的真实规则集，不创建空规则集充数。
- 重复规则规范化后去重；无效域名、错误网段、来源缺失或许可不明阻止该批更新。
- 覆盖根域名、子域名、相似但不同的域名、CIDR 首末地址与外侧地址、IPv6 和 Unicode 域名处理。
- 同一输入重复同步得到相同内容与校验值，不因时间戳产生无意义 diff。
- 失败保留上一批已验证输入，不混合部分成功的更新。

## 边界

始终保留来源与许可。接入新的内容类别、改变规则语义或新增可执行上游依赖前，需要重新评审。禁止导入个人订阅、节点、令牌与证书。候选上游的许可与内容必须在接入时再次核对，本规格不把候选来源当作已经接入。
