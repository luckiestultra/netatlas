# Proxy Atlas

面向多个代理客户端的配置、规则、模块与脚本仓库。先选软件，再找需要的内容。

**当前阶段：架构与规格评审。尚未发布可导入配置。** 不把规划中的目录或未验证的配置标记为可用。

## 使用时怎么看

以下是已确认的目录设计；文件随实际实现与验证后发布，不预先创建空配置。

```text
clients/
├── quantumult-x/       # Quantumult X
├── surge/             # Surge
├── loon/              # Loon
├── shadowrocket/      # Shadowrocket
├── egern/             # Egern
├── stash/             # Stash
├── mihomo/            # Mihomo / Clash.Meta
└── sing-box/          # sing-box
```

进入对应软件目录后，按需要取用：

```text
clients/quantumult-x/
├── profiles/          # 主配置
├── rules/             # 分流规则
├── modules/           # 可选功能片段
├── scripts/           # 已适配该软件的脚本
├── manifest.json      # 版本、来源和验证结果
└── README.md          # 导入方式与已知限制
```

并非每个软件都支持这些能力。没有实现、客户端不支持或未达到验证要求的产物不发布。

## 维护时怎么改

公共规则只维护一份，再生成各软件需要的格式。例如添加一个 OpenAI 域名，只修改规则源；构建工具负责更新各客户端产物。DNS、策略组、规则顺序和最终策略保留各客户端原生写法。

```text
src/rules/ ─────┐
src/profiles/ ──┼── 构建与校验 ──→ clients/<软件>/
src/features/ ──┘
```

## 设计与规格

- [模块边界与依赖](CAPABILITY_MAP.md)
- [目录、命名和兼容原则](docs/architecture.md)
- [参考项目与来源审计](docs/upstream-audit.md)
- [规则数据规格](SPEC-rule-data.md)
- [客户端配置规格](SPEC-client-configs.md)
- [功能包规格](SPEC-feature-packages.md)
- [构建与验证规格](SPEC-build-validation.md)

## 边界

- 发布的示例不包含私人节点、订阅地址、访问令牌、证书私钥或账户数据。
- 未明确授权的第三方代码与图标只作为设计参考，不直接复制再发布。
- 规则转换不能悄悄删除不支持的类型，或改变规则的匹配含义。
- 脚本通过响应样本测试，不等于已经在每个客户端中实测。
- 当前没有“全部客户端已支持”的声明；实际支持范围以将来生成的能力与验证清单为准。

原创部分采用 [MIT License](LICENSE)。第三方内容的许可证与声明单独保留。
