# 规格：客户端配置（client-configs）

状态：待评审。依赖 `rule-data` 与 `feature-packages` 的明确接口。

## 目标

用户先选软件，再获得主配置、规则、可选模块与已适配脚本。目标覆盖 Quantumult X、Surge、Loon、Shadowrocket、Egern、Stash、Mihomo 和 sing-box；兼容等级分别记录，不能用空配置宣称支持。

## 结构与接口

- `src/profiles/<软件>/` 保存原生模板，决定 DNS、策略、规则顺序与最终策略。
- `metadata/clients.json` 登记客户端能力、固定目标版本、官方文档和验证方式。
- `tools/adapters/<软件>/` 将规范规则转换为原生规则；不能近似替换或静默跳过不可表达的规则。
- `clients/<软件>/{profiles,rules,modules,scripts}/` 为发布入口，具体内容由实际支持决定。
- `clients/<软件>/manifest.json` 为每项产物记录状态与验证结果；`README.md` 给出具体导入步骤与限制。

示例稳定路径：`clients/quantumult-x/profiles/default.conf`、`clients/surge/rules/ai/openai.list`。稳定服务 ID 在不同客户端之间一致，但扩展名与内容使用各自原生格式。

## 风格与命令（实现后提供）

不建立万能配置 DSL。保留可读的原生模板，用明确适配器生成；命名使用小写与短横线。模板中的订阅输入由用户本地提供，不能混入真实个人数据。

```sh
npm run build -- --client quantumult-x
npm run build -- --client mihomo
npm run validate -- --client sing-box
npm run test:profiles
```

## 测试与验收

- 八个目标都有可生成的完整主配置与核心规则适配；sing-box 必须是非空且结构有效的 JSON，不接受 `{}` 占位。
- 规则集引用、策略组引用、最终策略、模板输入与输出路径全部可解析，不能引用不存在的节点、策略或文件。
- 分别验证精确域名、后缀匹配、IPv4/IPv6；规则转换前后用相同正反例检查语义。
- Mihomo 的 behavior 与文件 format 分开处理；sing-box 的源规则集版本、SRS 编译与配置版本匹配。
- 支持脚本或重写的软件逐项适配；不支持这些能力的软件不生成伪模块。
- 本地节点通过不提交的配置输入注入；测试使用专门的示例节点和本地服务，不包含用户真实订阅。
- 基础格式与引用检查为所有目标执行。可用的真实内核执行原生检查；闭源软件记录实际导入是否验证。未做的验证明确标记，不能伪造通过。

## 边界

不读取、覆盖、自动导入或重启用户当前客户端配置。增加新的目标软件、改变默认分流行为、放宽局域网监听或扩大 MITM 作用域，需要明确说明影响。未经验证的能力不标记为稳定支持。
