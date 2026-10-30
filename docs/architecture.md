# 目录与接口设计

## 为什么这样安排

Matrix-io 把配置、规则、模块、图标和脚本分别作为顶层目录，再在其中选择客户端。Proxy Atlas 把用户的选择顺序改为“软件 → 内容”，内部仍保留公共维护源。

```text
proxy-atlas/
├── clients/                         # 用户直接取用；由构建生成
│   ├── quantumult-x/
│   ├── surge/
│   ├── loon/
│   ├── shadowrocket/
│   ├── egern/
│   ├── stash/
│   ├── mihomo/
│   └── sing-box/
├── src/                             # 我们维护的原始内容
│   ├── rules/<分类>/<规则集>.json
│   ├── profiles/<软件>/
│   └── features/<功能>/
│       ├── manifest.json
│       └── <软件>/
├── assets/icons/                    # 自有或已明确许可的图标
├── metadata/
│   ├── upstreams.json               # 来源、许可、固定版本、校验值
│   └── clients.json                 # 能力、目标版本、官方依据
├── tools/
│   ├── adapters/                    # 明确保留规则语义的格式适配
│   ├── build.mjs
│   ├── validate.mjs
│   └── sync.mjs
├── tests/
│   ├── fixtures/                    # 去标识化的接口响应和规则样本
│   ├── rules/
│   ├── scripts/
│   └── profiles/
├── docs/
└── .github/workflows/               # 后续在实现通过后加入
```

这是一张目标结构图，不是当前已有文件清单。只有产生真实内容时才新增相应目录。

## 统一命名

软件标识固定为 `quantumult-x`、`surge`、`loon`、`shadowrocket`、`egern`、`stash`、`mihomo`、`sing-box`。规则、功能和文件采用小写英文与短横线，如 `openai`、`geoip`、`apple-intelligence`。

规则分类先使用 `ai`、`development`、`media`、`social`、`system`、`network`、`privacy`，随真实内容扩展。分类只用于查找，不决定分流优先级。

## 什么可以共享

可以共享的是域名与网段事实、来源信息、功能说明，以及经独立验证的纯解析函数。公共规则首版只接受精确域名、域名后缀、IPv4 CIDR、IPv6 CIDR。

DNS、策略组名、策略选择、规则顺序、最终策略、脚本执行时机和 MITM 要求保留客户端差异。不建立覆盖一切的万能配置语言，不因为文件后缀类似就声明兼容。

## 功能包如何组织

`src/features/geoip/` 可以同时包含 QX 和 Surge 的适配，但只有各自实现与验证存在时才登记支持。Mihomo 和 sing-box 没有相同的客户端脚本显示入口，不为凑目录生成假的同名模块。

每个功能的清单说明：用途、支持的软件和版本、依赖、是否需要 MITM、数据来源、许可、验证等级和输出路径。

## 稳定下载地址

正式发布后，主配置使用固定路径，例如 `clients/quantumult-x/profiles/default.conf`。功能模块和规则集有各自独立路径，不要求导入整个仓库。

主分支提供更新入口，已发布标签或固定提交提供可回退入口。发布清单记录来源提交、输入校验值、输出校验值、构建版本和验证证据。

## 私人内容

自己的节点、订阅、令牌和证书由用户在本地单独提供；不进入公共模板、fixture、日志或构建产物。仓库不读取或上传用户当前客户端配置。
