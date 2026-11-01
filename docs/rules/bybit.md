# Bybit 分流

来源：保留仓库所有者于2026-11-02提供的16条规则；同日经官方资料复核，补入6个专属地区站后缀。当前共22条：20条域名后缀、2条精确主机名。公共源为 `src/rules/finance/bybit.json`，构建为八客户端的 `rules/bybit.<原生扩展名>`，default/standalone均使用独立的 `Bybit` 策略组。

Quantumult X 在 `[filter_remote]` 引用：

```ini
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rules/bybit.list, tag=bybit, force-policy=Bybit, update-interval=86400, opt-parser=false, enabled=true
```

已有配置需要同名 `Bybit` 策略组；仓库主配置已接入该组。自有节点可在组中自行选择，仓库不预设私人节点。精确主机 `bybit-exchange.github.io`、`bybit.ada.support` 不匹配它们的子域，也不扩展到 `github.io` 或 `ada.support`。

## 官方地区站补齐（2026-11-02）

| 新增后缀 | 官方列出的REST主机 |
| --- | --- |
| `bybit.tr` | `api.bybit.tr` |
| `bybit.kz` | `api.bybit.kz` |
| `bybitgeorgia.ge` | `api.bybitgeorgia.ge` |
| `bybit.ae` | `api.bybit.ae` |
| `bybit.eu` | `api.bybit.eu` |
| `bybit.id` | `api.bybit.id` |

依据：[官方REST接入文档](https://bybit-exchange.github.io/docs/v5/guide#authentication)、[官方WebSocket区域表](https://bybit-exchange.github.io/docs/v5/ws/connect#websocket-endpoints)，以及[固定文档源](https://github.com/bybit-exchange/docs/blob/b255af1fd226d187231499b23ce62b110e5a4989/docs/v5/guide.mdx)。这些是独立的地区注册域，既有bybit.com后缀不会覆盖。此处不代表验证了Bybit全部互联网资产。

### 未默认加入的独立场景

- 官方也列出合作品牌的精确主机：api.manepa.jp、api-testnet.manepa.jp、stream.manepa.jp、api.spark-fintech.com、api-testnet.spark-fintech.com、stream.spark-fintech.com。它们不证明整个manepa.jp/spark-fintech.com父域应路由为Bybit，因此没有自动扩大父域；按账户实际入口另行评审。
- [机构专用端点](https://bybit-exchange.github.io/docs/v5/institution/whitelist-ip)可能使用bybit-aws.com下每客户专用域名；文档占位主机不是可直接导入的生产地址。遥测collector也不作为核心服务缺口补入。
- 旧NL/TR入口与陌生品牌域未凭历史清单混入本次补齐。

## 原始16条输入

用户原始QX匹配条件：

```ini
host-suffix, bybit.com, Bybit
host-suffix, bytick.com, Bybit
host-suffix, bycsi.com, Bybit
host-suffix, byapis.com, Bybit
host-suffix, bycbe.com, Bybit
host-suffix, bymj.io, Bybit
host-suffix, byabcde.com, Bybit
host-suffix, byapps.net, Bybit
host-suffix, byd3c3.com, Bybit
host-suffix, bybit.biz, Bybit
host-suffix, bybdc6.com, Bybit
host-suffix, bybit-global.com, Bybit
host-suffix, bybit.cloud, Bybit
host-suffix, bybitglobal.com, Bybit
host, bybit-exchange.github.io, Bybit
host, bybit.ada.support, Bybit
```

验证基线：上一版16条已通过八端条目和匹配边界检查；本次地区域名扩展另经独立官方来源、八端精确/后缀与策略首命中复核。个人配置的策略成员、节点、私有订阅及MITM不属于这个公共规则文件。
