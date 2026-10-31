# QX 服务兼容补充

这套资源解决部分实际分流/HTTP广告问题，**不是剩余源正则的无损转换**，严格覆盖仍是14/24。它们不会被默认配置或standalone自动加载；本仓库也不改动你现用的QX配置。

| 资源 | 作用 | 明确边界 |
| --- | --- | --- |
| [openai-compat.list](../clients/quantumultX/rules/openai-compat.list) | 让ChatGPT Azure Web PubSub端点使用AI策略 | 非数字结尾、中间多标签等也可能匹配，不等于原正则 |
| [viu-cdn-compat.list](../clients/quantumultX/rules/viu-cdn-compat.list) | 让ViuTV分类下的Now E CDN模式使用媒体策略 | `ewcdnx.nowe.com`、`ewcdn1.extra.nowe.com`也会匹配；域名当前是否仍被播放使用未实测 |
| [speedtest-ads-http.snippet](../clients/quantumultX/rewrites/speedtest-ads-http.snippet) | 按源主机名正则拒绝可见HTTP广告请求 | 仅HTTP，无MITM、证书或脚本 |
| [speedtest-ads-https.snippet](../clients/quantumultX/rewrites/speedtest-ads-https.snippet) | 可选HTTPS版本 | 必须自己开启MITM并信任自己的CA，仍不等于DNS/UDP/普通TCP/HTTP3分流恢复 |

## 先接入需要的服务分流

下面使用NetAtlas主配置的“AI服务”和“国外媒体”。自己的配置没有这些组时，改成已经存在的策略组名（如`PROXY`），不要新增空组。

1. 在QX里手工关闭“分流匹配优化”，并把选中的资源放在`[filter_remote]`最前面。没有设置该App选项的公开配置键，本仓库不会编造一个键或改你的App设置。
2. 前置是为了避免`azure.com`等企业后缀先匹配；如果还有更早的自有规则，以网络活动中的实际命中为准。QX的原生顺序和优化选项没有在现用App中实测。
3. 只复制自己需要的一行，不要把片段当成完整配置导入覆盖现有配置。

~~~ini
[filter_remote]
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rules/openai-compat.list, tag=openai-compat, force-policy=AI服务, update-interval=86400, opt-parser=false, enabled=true
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rules/viu-cdn-compat.list, tag=viu-cdn-compat, force-policy=国外媒体, update-interval=86400, opt-parser=false, enabled=true
~~~

standalone原有服务组名分别是`openai`和`viu-portable`，改用对应`force-policy`；资源内容本身也保留这些源ID。完整可选片段见[regex-compat.conf](../clients/quantumultX/fragments/regex-compat.conf)，其中HTTPS版本故意为`enabled=false`。

## Speedtest 广告按协议选择

先用无需MITM的HTTP版本，在`[rewrite_remote]`添加：

~~~ini
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rewrites/speedtest-ads-http.snippet, tag=speedtest-ads-http, enabled=true
~~~

只有接受HTTPS解密范围、已经使用并信任自己的CA时，才另外主动添加HTTPS版本：

~~~ini
https://raw.githubusercontent.com/luckiestultra/netatlas/main/clients/quantumultX/rewrites/speedtest-ads-https.snippet, tag=speedtest-ads-https, enabled=true
~~~

HTTPS资源带10个固定长度hostname通配模式，范围限定为`speed.coe.ad`或`speed.open.ad`加2至6字符地区段。由于QX的hostname通配不支持字母字符类，这些MITM模式**比实际广告正则宽**：含数字、特殊字符或跨标签但同长度的主机名也可能被解密。重写本身仍只拒绝原正则的`[a-z]{2,6}`主机名。不要把MITM范围扩大成`*.ooklaserver.net`，也不要关闭证书校验；本仓库不提供或安装CA。证书钉扎、HTTP/3等路径不保证可见或能拦截。

## 怎么核对结果

- ChatGPT兼容例：`chatgpt-async-webps-prod-a-1.webpubsub.azure.com`应显示所选AI策略；`chatgpt-async-webps-prod-a-x.webpubsub.azure.com`也会被兼容规则接管，后者就是已披露的扩大范围。这里是测试样例，不表示这些合成域名实际提供服务；实际使用应查看应用发出的真实端点。
- Now E兼容例：`ewcdn123.nowe.com`与`ewcdnx.nowe.com`都会接管；`x.ewcdn1.nowe.com`、`ewcdn1.nowe.com.evil`不会。真实播放是否请求这一域名族，需要查看当前客户端活动。
- 广告正例：可见请求`http://speed.coe.ad.cn.prod.hosts.ooklaserver.net/`匹配拒绝；地区段`c2`、长度1或7、主机名追加`.evil`均不匹配。HTTPS只有满足上面的MITM条件后才适用。
- 先检查策略/重写命中，再判断页面表现。仓库测试证明生成条件与边界，不能替代在QX里的实际导入、策略选择和MITM验证。

## 其余规则怎么处理

Google的两条正则各被`google`、可选`google-cn`引用。现有`xn--ngstr-lra8j.com`后缀落谷歌服务，`googlevideo.com`默认先落YouTube的国外媒体策略；不能把它们称作精确的CN直连恢复。这轮不增加近似的国内直连规则。保留严格14/24和全部10个未支持引用，避免让兼容补充掩盖原生能力差异。

来源与扩大范围例子见[兼容登记](../metadata/qx-compat.json)、[原始表达式与能力](../metadata/regex-routing.json)、[官方QX规则/重写示例](https://github.com/crossutility/Quantumult-X/blob/af6fb594233ec4a3ec6d4ccb3601e9c36b75ea2d/sample.conf)。官方仓库示例自称v1.5.5，商店已列更新版本；没有文档化能力不等于已经逆向证明所有二进制均不存在该能力。
