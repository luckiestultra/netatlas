# 能力地图

目录方向已由用户确认：**先按软件找可用内容**。维护源与发布产物分开，是为了避免同一个规则修改八份。

| 模块 ID | 职责 | 依赖 |
|---|---|---|
| `rule-data` | 规则事实、分类、来源登记、版本与许可 | — |
| `feature-packages` | GeoIP、网络诊断、重写等可选功能及各客户端实现 | — |
| `client-configs` | 各客户端原生配置、策略和功能组合；规则格式适配 | `rule-data`、`feature-packages` |
| `build-validation` | 生成、检查、来源清单和客户端发布产物 | 前三个模块 |

依赖为接口关系，不要求一次完成整个模块才做验证。实施时以一个客户端和一个完整用例打通，再扩展已验证范围。

## 用户看到的边界

| 要做的事 | 入口 |
|---|---|
| 导入某个软件的主配置 | `clients/<软件>/profiles/` |
| 单独订阅某类规则 | `clients/<软件>/rules/<分类>/` |
| 开启一个可选功能 | `clients/<软件>/modules/` |
| 使用某软件支持的脚本 | `clients/<软件>/scripts/` |
| 判断是否已验证 | 对应 `README.md` 与 `manifest.json` |

## 维护者看到的边界

- `src/rules/` 只存匹配事实，不存代理组名和最终策略。
- `src/profiles/<软件>/` 保存该软件的原生配置模板。
- `src/features/<功能>/<软件>/` 保存明确适配该软件的模块与脚本。
- `metadata/` 集中保存来源、许可、客户端能力和目标版本。
- `tools/` 承担构建与校验；`tests/` 保存真实回归场景；`docs/` 解释使用方式。

规格入口分别为 `SPEC-rule-data.md`、`SPEC-feature-packages.md`、`SPEC-client-configs.md`、`SPEC-build-validation.md`。本地图不宣称这些能力已经实现。
