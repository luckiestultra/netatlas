# Quantumult X：本地入口与远程资源

目标是保留现有配置的节点、策略和证书，把适合共享的正文放进仓库。本页是拆分说明，不是可覆盖私人配置的主配置，不调用任何导入URL Scheme。

## 原生边界

| 内容 | GitHub可维护 | 仍保留在本地主配置或客户端 |
| --- | --- | --- |
| 分流 | 原生rules/*.list，放filter_remote | 引用顺序、force-policy映射、私人域/IP例外、final和策略组 |
| 重写 | 原生rewrites/*.snippet；部分modules也是同一种资源 | 启停、顺序、MITM开关与证书；新增hostname需单独审查 |
| JavaScript | 重写/任务/backend引用的JS正文；GeoIP/parser脚本URL | 触发条件、任务时间、参数、私有状态；不把带Cookie/令牌的正文公开 |
| 节点订阅 | server_remote支持远程节点资源 | 私人订阅URL、节点凭据、个人节点、组成员与选择不能公开 |
| general / dns / policy | 可保存无秘密的模板作离线参考 | 当前公开官方语法没有通用的这些段的独立remote/include入口，实际声明继续在主配置 |
| task / http_backend | JS本体可远程 | cron/event、backend的path/host/启停声明继续本地 |
| MITM | rewrite资源可声明所需hostname | p12、passphrase、信任与全局MITM设置只本地 |

官方依据：[sample.conf](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/sample.conf)、[rewrite语法](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/rewrite.md)、[JS任务示例](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/sample-task.js)。公开sample头版本早于当前App版本；这里说明已公开的原生接口，没有声称穷尽闭源App的未文档化能力。

不要创造policy_remote/dns_remote/mitm_remote、通配include或通用模块；文件名叫module或conf不会增加QX语法能力。现有fragments/*.conf是手工合并说明，不是可直接订阅整段的模块。官方旧[托管文档](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/remote-managed-configuration.md)已标Removed，不能据旧教程承诺整份配置热更新。

## 沿用现有目录

```text
clients/quantumultX/
  rules/       原生分流，给filter_remote
  rewrites/    原生重写，给rewrite_remote
  modules/     可选工具的重写安装资源，仍按QX真实资源类型接入
  scripts/     JS正文，由对应触发字段引用
  fragments/   手工合并说明
  profiles/    独立完整示例，不覆盖已有私人配置
```

如果已有静态组名为Bybit，只接入规则文件，保持这个组及其成员：

```ini
# 合并到现有[filter_remote]；其他段不变。
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rules/bybit.list, tag=bybit, force-policy=Bybit, update-interval=86400, opt-parser=false, enabled=true
```

force-policy应指向原有策略组，不应改成该组当前选中的某个节点/地区组。即使当前出口相同，绕过组后，未来维护这个组时规则不会再跟随。

本仓库openai/netease-music等文件内策略使用规范服务ID；已有配置若使用OpenAI/NetEaseMusic等不同组名，应在引用层显式映射，不能仅换URL。合并包含direct和reject等多种策略的自定义资源时，不设置全局force-policy，保留每条动作。

## 可审阅迁移顺序

1. 先取得原始纯文本配置并在本地备份；富文本编辑器的可访问性摘要不是可无损写回的源文件。记录启停、顺序、inserted-resource、原策略组与选择。
2. 私人节点/订阅、IP/内网/私人关键词、DNS、策略组、任务时间表与CA继续本地；不把完整配置上传公共仓库。
3. 先核对公开规则条件、精确/后缀边界、动作和策略引用，再准备少量原生远程资源。停用项可以整理成本地备忘，未经确认不删除旧功能。
4. 不用本仓库default.conf替换已有配置；不同来源的同名规则不保证集合相同，需先比对差集。
5. 从local移remote可能改变相对优先级。客户端成功获取资源并完成原生匹配验收后，才移除对应本地重复项；不一律开启inserted-resource绕过所有本地例外。
6. 单独处理旧资源误链、策略绑定差异、原始JS与重写资源混用等功能修复，不夹带在纯整理里。

官方[URL Scheme](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/url-scheme.md)明确update-configuration?remote-resource=会替换已有远程资源，不能作为保留原配置的快捷安装方式；add-resource也需先审阅具体新增项。本方案不调用它们。

GitHub文件更新需等客户端成功重新获取才会生效；保存主配置不等于脚本缓存已经更新。无秘密公共文件可以普通main链接维护，不能以HTTP成功代替QX实际匹配验收。
