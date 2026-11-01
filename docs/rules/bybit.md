# Bybit 分流

来源：仓库所有者于2026-11-02提供的16条规则。保留14条域名后缀、2条精确主机名，不扩充或合并上级域。公共源为 `src/rules/finance/bybit.json`，构建为八客户端的 `rules/bybit.<原生扩展名>`，default/standalone均使用独立的 `Bybit` 策略组。

Quantumult X 在 `[filter_remote]` 引用：

```ini
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rules/bybit.list, tag=bybit, force-policy=Bybit, update-interval=86400, opt-parser=false, enabled=true
```

已有配置需要同名 `Bybit` 策略组；仓库主配置已接入该组。自有节点可在组中自行选择，仓库不预设私人节点。精确主机 `bybit-exchange.github.io`、`bybit.ada.support` 不匹配它们的子域，也不扩展到 `github.io` 或 `ada.support`。

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

验证：八客户端导出均为同一组16个条件；30个根域/子域正例及6个边界反例通过，default/standalone策略引用校验通过。配置与导出相关248项测试通过，构建校验为八客户端119个规则集、1145份产物。本次未读取或修改用户正在运行的QX配置。
