# 第三方声明与规则来源

本仓库包含多种许可。原创通用代码采用根目录 MIT 许可；HTTPS-upgrade 功能代码及其生成资源采用 GPL-2.0-only，不以根 MIT 许可替代。各组件与产物的许可见对应来源、文件头和清单。

## anti-AD

- 项目：[privacy-protection-tools/anti-AD](https://github.com/privacy-protection-tools/anti-AD)
- 固定版本：`cafc2bfb031a9e5ee4461721afc65b82430f2c15`。
- 使用 `anti-ad-surge2.txt` 的 100,682 个明确域名后缀，严格解析每行的 `.` 前缀；与同提交 Clash 规则的后缀集合双向一致。
- 这是可选规则集，不内联默认主配置；完整源 SHA-256、许可 SHA-256、匹配类型、原始来源与核验依据登记在 `metadata/upstreams.json`。
- 原始 [MIT 许可](src/vendor/anti-ad/LICENSE) 和 [README/credits](src/vendor/anti-ad/README.md) 原样保留，包括其聚合来源说明。本项目按直接来源的许可声明记录，不声称所有被聚合项目均采用 MIT。

## HTTPS-upgrade

- 来源：[blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)，固定 `0b6897dc17e0c513d25449c935a9694818e32f0c`。
- 仅选择 6 个同主机的 HTTP→HTTPS 规则，并增加严格主机、路径和查询保留；其他跳转、地区替换、HTTP 降级和 MITM 配置不进入生成资源。
- 完整 [GPL-2.0 许可](src/features/https-upgrade/LICENSE)、[原文](src/features/https-upgrade/upstream/Redirect.conf.txt)、[修改说明](src/features/https-upgrade/NOTICE.md) 与 [来源元数据](metadata/https-upgrade.json) 均保留。适配器、数据和相关生成资源均标明 GPL-2.0-only，不应标为 MIT。
- 仓库维护时间与规则文件头更新时间分别记录；不拿仓库近期提交冒充所有规则刚刚更新。

## Domain list community

- 项目：[v2fly/domain-list-community](https://github.com/v2fly/domain-list-community)
- 固定版本：`1daade8c4bb957d21d1f5c09c2b050d699e8e96c`（2026-10-30）
- 许可：[MIT License](https://github.com/v2fly/domain-list-community/blob/1daade8c4bb957d21d1f5c09c2b050d699e8e96c/LICENSE)
- LICENSE 文件 SHA-256：`b9d84a22870d3f21c91a4c6e410c9cc51d00902f5233ad0c84011479244bf7d2`
- 使用范围：`metadata/upstreams.json` 登记的具体域名列表及其显式 `include:`；没有执行上游代码。

每个规则集的清单记录来源文件 URL、文件字节 SHA-256、固定提交、作者、许可、生成 JSON 文件字节 SHA-256、规则数量和已应用排除项。`updatedAt` 使用上游固定提交时间；本项目自有事实列表使用明确登记的整理日期。重复同步不会写入当前时钟产生的时间戳。保留以下完整许可声明：

```text
MIT License

Copyright (c) 2018-2019 V2Ray

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 可移植规则的范围

这份目录是上游数据的**可移植投影**，不是完整 DLC/geosite 编译产物：

- `domain:` 和裸域名转换为域名后缀；`full:` 转换为精确域名。
- 显式包含会递归展开，`@属性` 和 `@-属性` 的包含过滤遵循上游说明。
- 不执行全仓库的 `&目标列表` 反向聚合；只使用登记文件及显式包含的内容。
- 八种客户端不能无损共享任意 Go 正则。已审查的个别表达式只能通过清单中“文件 + 确切表达式 + 原因”的显式排除处理，原文、行号、原因和数量都保留在 `appliedExclusions`。不把正则近似放大成后缀。
- **任何新增、没有登记的正则或关键词表达式会阻止该批同步。** 不静默跳过，也不会发布半批新数据。
- 排除的动态主机名可能需要其他规则或最终策略处理；本项目不声称覆盖被排除表达式原本匹配的全部范围。

## 本项目自有事实列表

- `lan`：根据 RFC 1918、4193、4291、6598、6762、8375 和 IANA 地址登记选择常见本地、私有及特殊目的地址。不是完整 IANA 特殊用途表。
- `china`：本项目手工维护的常见服务域名便利集，不是完整中国域名或 IP 数据库，也不是地理定位断言。
- 这些列表采用本项目 MIT 许可，其参考链接在来源清单中逐项登记。

## 同步与恢复

```sh
npm run sync -- --dry-run             # 核对当前固定版本，不改源文件
npm run sync                         # 重建当前固定版本
npm run sync -- --latest --dry-run    # 检查上游分支最新提交，但不发布
npm run sync -- --repository <来源ID> --revision <完整SHA>  # 经审查后只切换所选来源
```

下载限制包括 15 秒请求超时、普通单文件 1 MB；anti-AD 登记上限为 3 MB，硬上限为 4 MB。总计 24 MB、最多 512 个文件和 20 层包含；禁止包含循环。同步先验证所有输入，再发布规则目录和来源清单；网络失败、许可变化或新不可移植表达式会保留旧数据。已有托管规则若被手工修改，校验值不符会阻止覆盖；下载期间发生的本地改动也会在发布前再次核对。

本地上一个目录和中断记录保存在被 Git 忽略的 `.cache/sync/` 中，不自动删除。若目录交换期间进程被强制终止，下一次普通同步会先恢复上一批；`--dry-run` 只报告待恢复状态，不修改它。
