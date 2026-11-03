// Generated from the portable GeoIP core and an explicit native adapter.
/* Chinese territory labels: Unicode CLDR 48 (Unicode-3.0).
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 2004-2025 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.

SPDX-License-Identifier: Unicode-3.0
*/
var AtlasGeoIP = (function createGeoIP() {
  // Territory display data: Unicode CLDR 48, Unicode-3.0.
  // Copyright (c) 1991-2025 Unicode, Inc. License and pinned source/projection:
  // https://github.com/luckiestultra/netatlas/tree/main/src/features/geoip/localization
  var countries = {"AC":"阿森松岛","AD":"安道尔","AE":"阿拉伯联合酋长国","AF":"阿富汗","AG":"安提瓜和巴布达","AI":"安圭拉","AL":"阿尔巴尼亚","AM":"亚美尼亚","AO":"安哥拉","AQ":"南极洲","AR":"阿根廷","AS":"美属萨摩亚","AT":"奥地利","AU":"澳大利亚","AW":"阿鲁巴","AX":"奥兰群岛","AZ":"阿塞拜疆","BA":"波斯尼亚和黑塞哥维那","BB":"巴巴多斯","BD":"孟加拉国","BE":"比利时","BF":"布基纳法索","BG":"保加利亚","BH":"巴林","BI":"布隆迪","BJ":"贝宁","BL":"圣巴泰勒米","BM":"百慕大","BN":"文莱","BO":"玻利维亚","BQ":"荷属加勒比区","BR":"巴西","BS":"巴哈马","BT":"不丹","BV":"布韦岛","BW":"博茨瓦纳","BY":"白俄罗斯","BZ":"伯利兹","CA":"加拿大","CC":"科科斯（基林）群岛","CD":"刚果（金）","CF":"中非共和国","CG":"刚果（布）","CH":"瑞士","CI":"科特迪瓦","CK":"库克群岛","CL":"智利","CM":"喀麦隆","CN":"中国","CO":"哥伦比亚","CP":"克利珀顿岛","CQ":"萨克岛","CR":"哥斯达黎加","CU":"古巴","CV":"佛得角","CW":"库拉索","CX":"圣诞岛","CY":"塞浦路斯","CZ":"捷克","DE":"德国","DG":"迪戈加西亚岛","DJ":"吉布提","DK":"丹麦","DM":"多米尼克","DO":"多米尼加共和国","DZ":"阿尔及利亚","EA":"休达及梅利利亚","EC":"厄瓜多尔","EE":"爱沙尼亚","EG":"埃及","EH":"西撒哈拉","ER":"厄立特里亚","ES":"西班牙","ET":"埃塞俄比亚","EU":"欧盟","EZ":"欧元区","FI":"芬兰","FJ":"斐济","FK":"福克兰群岛","FM":"密克罗尼西亚","FO":"法罗群岛","FR":"法国","GA":"加蓬","GB":"英国","GD":"格林纳达","GE":"格鲁吉亚","GF":"法属圭亚那","GG":"根西岛","GH":"加纳","GI":"直布罗陀","GL":"格陵兰","GM":"冈比亚","GN":"几内亚","GP":"瓜德罗普","GQ":"赤道几内亚","GR":"希腊","GS":"南乔治亚和南桑威奇群岛","GT":"危地马拉","GU":"关岛","GW":"几内亚比绍","GY":"圭亚那","HK":"香港","HM":"赫德岛和麦克唐纳群岛","HN":"洪都拉斯","HR":"克罗地亚","HT":"海地","HU":"匈牙利","IC":"加纳利群岛","ID":"印度尼西亚","IE":"爱尔兰","IL":"以色列","IM":"马恩岛","IN":"印度","IO":"英属印度洋领地","IQ":"伊拉克","IR":"伊朗","IS":"冰岛","IT":"意大利","JE":"泽西岛","JM":"牙买加","JO":"约旦","JP":"日本","KE":"肯尼亚","KG":"吉尔吉斯斯坦","KH":"柬埔寨","KI":"基里巴斯","KM":"科摩罗","KN":"圣基茨和尼维斯","KP":"朝鲜","KR":"韩国","KW":"科威特","KY":"开曼群岛","KZ":"哈萨克斯坦","LA":"老挝","LB":"黎巴嫩","LC":"圣卢西亚","LI":"列支敦士登","LK":"斯里兰卡","LR":"利比里亚","LS":"莱索托","LT":"立陶宛","LU":"卢森堡","LV":"拉脱维亚","LY":"利比亚","MA":"摩洛哥","MC":"摩纳哥","MD":"摩尔多瓦","ME":"黑山","MF":"法属圣马丁","MG":"马达加斯加","MH":"马绍尔群岛","MK":"北马其顿","ML":"马里","MM":"缅甸","MN":"蒙古","MO":"澳门","MP":"北马里亚纳群岛","MQ":"马提尼克","MR":"毛里塔尼亚","MS":"蒙特塞拉特","MT":"马耳他","MU":"毛里求斯","MV":"马尔代夫","MW":"马拉维","MX":"墨西哥","MY":"马来西亚","MZ":"莫桑比克","NA":"纳米比亚","NC":"新喀里多尼亚","NE":"尼日尔","NF":"诺福克岛","NG":"尼日利亚","NI":"尼加拉瓜","NL":"荷兰","NO":"挪威","NP":"尼泊尔","NR":"瑙鲁","NU":"纽埃","NZ":"新西兰","OM":"阿曼","PA":"巴拿马","PE":"秘鲁","PF":"法属波利尼西亚","PG":"巴布亚新几内亚","PH":"菲律宾","PK":"巴基斯坦","PL":"波兰","PM":"圣皮埃尔和密克隆群岛","PN":"皮特凯恩群岛","PR":"波多黎各","PS":"巴勒斯坦","PT":"葡萄牙","PW":"帕劳","PY":"巴拉圭","QA":"卡塔尔","QO":"大洋洲边远群岛","RE":"留尼汪","RO":"罗马尼亚","RS":"塞尔维亚","RU":"俄罗斯","RW":"卢旺达","SA":"沙特阿拉伯","SB":"所罗门群岛","SC":"塞舌尔","SD":"苏丹","SE":"瑞典","SG":"新加坡","SH":"圣赫勒拿","SI":"斯洛文尼亚","SJ":"斯瓦尔巴和扬马延","SK":"斯洛伐克","SL":"塞拉利昂","SM":"圣马力诺","SN":"塞内加尔","SO":"索马里","SR":"苏里南","SS":"南苏丹","ST":"圣多美和普林西比","SV":"萨尔瓦多","SX":"荷属圣马丁","SY":"叙利亚","SZ":"斯威士兰","TA":"特里斯坦-达库尼亚群岛","TC":"特克斯和凯科斯群岛","TD":"乍得","TF":"法属南部领地","TG":"多哥","TH":"泰国","TJ":"塔吉克斯坦","TK":"托克劳","TL":"东帝汶","TM":"土库曼斯坦","TN":"突尼斯","TO":"汤加","TR":"土耳其","TT":"特立尼达和多巴哥","TV":"图瓦卢","TW":"台湾","TZ":"坦桑尼亚","UA":"乌克兰","UG":"乌干达","UM":"美国本土外小岛屿","UN":"联合国","US":"美国","UY":"乌拉圭","UZ":"乌兹别克斯坦","VA":"梵蒂冈","VC":"圣文森特和格林纳丁斯","VE":"委内瑞拉","VG":"英属维尔京群岛","VI":"美属维尔京群岛","VN":"越南","VU":"瓦努阿图","WF":"瓦利斯和富图纳","WS":"萨摩亚","XA":"伪地区","XB":"伪双向语言地区","XK":"科索沃","YE":"也门","YT":"马约特","ZA":"南非","ZM":"赞比亚","ZW":"津巴布韦","ZZ":"未知地区"};
  // These are name translations only. Never infer a missing region from a city.
  var regions = {
    US: { 'California': '加利福尼亚州', 'New York': '纽约州', 'Texas': '得克萨斯州', 'Washington': '华盛顿州', 'District of Columbia': '哥伦比亚特区', 'Virginia': '弗吉尼亚州', 'Oregon': '俄勒冈州', 'Illinois': '伊利诺伊州', 'Florida': '佛罗里达州', 'New Jersey': '新泽西州', 'Nevada': '内华达州', 'Arizona': '亚利桑那州', 'Georgia': '佐治亚州', 'Massachusetts': '马萨诸塞州', 'Colorado': '科罗拉多州' },
    JP: { 'Tokyo': '东京都', 'Tokyo-to': '东京都', 'Osaka': '大阪府', 'Osaka-fu': '大阪府', 'Saitama': '埼玉县', 'Kanagawa': '神奈川县', 'Chiba': '千叶县' },
    GB: { 'England': '英格兰', 'Scotland': '苏格兰', 'Wales': '威尔士', 'Northern Ireland': '北爱尔兰' },
    CA: { 'Ontario': '安大略省', 'British Columbia': '不列颠哥伦比亚省', 'Quebec': '魁北克省', 'Alberta': '艾伯塔省' },
    AU: { 'New South Wales': '新南威尔士州', 'Victoria': '维多利亚州', 'Queensland': '昆士兰州' },
    HK: { 'Hong Kong': '香港' }, MO: { 'Macao': '澳门', 'Macau': '澳门' }, SG: { 'Singapore': '新加坡' }
  };
  var cities = {
    US: { 'Los Angeles': '洛杉矶', 'San Jose': '圣何塞', 'San Francisco': '旧金山', 'New York': '纽约', 'Seattle': '西雅图', 'Chicago': '芝加哥', 'Dallas': '达拉斯', 'Ashburn': '阿什本', 'Washington': '华盛顿', 'Washington, D.C.': '华盛顿特区', 'Washington D.C.': '华盛顿特区', 'Miami': '迈阿密', 'Phoenix': '凤凰城', 'Las Vegas': '拉斯维加斯', 'Atlanta': '亚特兰大', 'Boston': '波士顿', 'Denver': '丹佛', 'Portland': '波特兰', 'Santa Clara': '圣克拉拉', 'Fremont': '弗里蒙特', 'San Diego': '圣迭戈', 'Secaucus': '锡考克斯' },
    JP: { 'Tokyo': '东京', 'Osaka': '大阪', 'Saitama': '埼玉', 'Chiba': '千叶', 'Yokohama': '横滨' },
    KR: { 'Seoul': '首尔', 'Busan': '釜山' }, GB: { 'London': '伦敦', 'Manchester': '曼彻斯特' },
    DE: { 'Frankfurt am Main': '法兰克福', 'Frankfurt': '法兰克福', 'Berlin': '柏林', 'Munich': '慕尼黑' },
    FR: { 'Paris': '巴黎', 'Lyon': '里昂' }, NL: { 'Amsterdam': '阿姆斯特丹' },
    CA: { 'Toronto': '多伦多', 'Vancouver': '温哥华', 'Montreal': '蒙特利尔' },
    AU: { 'Sydney': '悉尼', 'Melbourne': '墨尔本', 'Brisbane': '布里斯班' }, NZ: { 'Auckland': '奥克兰', 'Wellington': '惠灵顿' },
    HK: { 'Hong Kong': '香港', 'Kowloon': '九龙' }, MO: { 'Macao': '澳门', 'Macau': '澳门' }, SG: { 'Singapore': '新加坡' },
    TW: { 'Taipei': '台北', 'Taichung': '台中', 'Kaohsiung': '高雄', 'New Taipei': '新北' }
  };
  function text(value) {
    if (typeof value !== 'string') return '';
    var normalized = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/^\s+|\s+$/g, '');
    if (normalized.length > 300) {
      normalized = normalized.slice(0, 300);
      if (/[\ud800-\udbff]$/.test(normalized)) normalized = normalized.slice(0, -1);
    }
    return normalized;
  }
  function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function validIPv4(value) {
    var parts = value.split('.');
    if (parts.length !== 4) return false;
    for (var index = 0; index < parts.length; index += 1) {
      if (!/^\d{1,3}$/.test(parts[index]) || Number(parts[index]) > 255) return false;
    }
    return true;
  }
  function validIP(value) {
    if (validIPv4(value)) return true;
    if (value.indexOf(':') === -1 || !/^[0-9a-f:.]+$/i.test(value)) return false;
    var normalized = value;
    if (value.indexOf('.') !== -1) {
      var tail = value.slice(value.lastIndexOf(':') + 1);
      if (!validIPv4(tail)) return false;
      normalized = value.slice(0, value.lastIndexOf(':') + 1) + '0:0';
    }
    var halves = normalized.split('::');
    if (halves.length > 2) return false;
    var groups = [];
    for (var half = 0; half < halves.length; half += 1) {
      if (halves[half]) groups = groups.concat(halves[half].split(':'));
    }
    for (var part = 0; part < groups.length; part += 1) {
      if (!/^[0-9a-f]{1,4}$/i.test(groups[part])) return false;
    }
    return halves.length === 2 ? groups.length < 8 : groups.length === 8;
  }
  function ip(value) {
    var candidate = text(value);
    return validIP(candidate) ? candidate : '';
  }
  function countryCode(value) {
    var code = text(value).toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }
  function asn(value) {
    var candidate = (typeof value === 'number' && isFinite(value) ? String(value) : text(value)).replace(/^AS/i, '');
    return /^\d{1,10}$/.test(candidate) && Number(candidate) > 0 ? 'AS' + candidate : '';
  }
  function splitAS(value) {
    var organization = text(value);
    var match = organization.match(/^AS(\d+)(?:\s+(.*))?$/i);
    return match ? { asn: asn(match[1]), organization: text(match[2]) } : { asn: '', organization: organization };
  }
  function statusCode(response) {
    var value = object(response) ? Number(response.statusCode || response.status || 0) : 0;
    return value >= 100 && value <= 599 && value % 1 === 0 ? value : 0;
  }
  function errorText(options) {
    var error = options && options.error;
    return object(error) ? text(error.message || error.name) : text(error);
  }
  function diagnoseHttpResponse(response, options) {
    var code = statusCode(response);
    if (code) return { state: 'response', statusCode: code, responseReceived: true };
    return {
      state: /timeout|timed?\s*out|abort/i.test(errorText(options)) ? 'timeout' : 'network-error',
      statusCode: 0,
      responseReceived: false,
    };
  }
  function source(data) {
    if (!object(data)) return 'unknown';
    if ('query' in data && 'status' in data) return 'ip-api';
    if ('success' in data || 'connection' in data || object(data.timezone)) return 'ipwho.is';
    if ('country_name' in data || 'as_desc' in data || 'city_name' in data) return 'ipwho.de';
    if ('ip' in data && ('country' in data || 'country_code' in data || 'asn' in data || 'as_name' in data)) return 'ipinfo';
    return 'unknown';
  }
  function blank(state, code, message) {
    return {
      state: state, statusCode: code, source: 'unknown', ip: '',
      countryCode: '', country: '', region: '', city: '', asn: '',
      organization: '', timezone: '', message: message || '',
    };
  }
  function apiMessage(data) {
    if (!object(data)) return '';
    if (object(data.error)) return text(data.error.message || data.error.title);
    return text(data.message || data.error);
  }
  function parseGeoResponse(response, options) {
    var diagnostic = diagnoseHttpResponse(response, options);
    if (!diagnostic.responseReceived) return blank(diagnostic.state, 0, errorText(options) || '未收到 HTTP 响应');
    var code = diagnostic.statusCode;
    var body = response.body;
    var data = null;
    var empty = body === undefined || body === null || (typeof body === 'string' && !body.replace(/\s/g, ''));
    var invalid = false;
    if (!empty) {
      try {
        data = typeof body === 'string' ? JSON.parse(body) : body;
        invalid = !object(data);
      } catch (_error) {
        invalid = true;
      }
    }
    var message = apiMessage(data);
    var result = blank('no-data', code, message);
    result.source = source(data);
    if (object(data)) result.ip = ip(data.ip || data.query);
    var failed = object(data) && ((result.source === 'ip-api' && data.status !== 'success') || (result.source === 'ipwho.is' && data.success !== true) || data.status === 'fail' || data.success === false || Boolean(data.error));
    if (code === 429 || (failed && /rate.?limit|quota|too many|exceed/i.test(message))) {
      result.state = 'rate-limited';
      result.message = message || '定位服务请求次数已达上限';
      return result;
    }
    if (code < 200 || code >= 300) {
      result.state = 'http-error';
      result.message = message || '定位服务返回 HTTP ' + code;
      return result;
    }
    if (invalid) {
      result.state = 'invalid-response';
      result.message = '定位服务响应不是有效的 JSON 对象';
      return result;
    }
    if (empty || failed || !object(data)) {
      result.message = message || '定位服务未返回位置数据';
      return result;
    }
    var network;
    if (result.source === 'ip-api') {
      network = splitAS(data.as);
      result.countryCode = countryCode(data.countryCode);
      result.country = text(data.country);
      result.region = text(data.regionName);
      result.city = text(data.city);
      result.asn = network.asn;
      result.organization = text(data.org) || text(data.isp) || network.organization;
      result.timezone = text(data.timezone);
    } else if (result.source === 'ipwho.is') {
      var connection = object(data.connection) ? data.connection : {};
      result.countryCode = countryCode(data.country_code);
      result.country = text(data.country);
      result.region = text(data.region);
      result.city = text(data.city);
      result.asn = asn(connection.asn);
      result.organization = text(connection.org) || text(connection.isp);
      result.timezone = object(data.timezone) ? text(data.timezone.id) : '';
    } else if (result.source === 'ipwho.de') {
      result.countryCode = countryCode(data.country_code);
      result.country = text(data.country_name);
      result.city = text(data.city_name);
      result.asn = asn(data.asn);
      result.organization = text(data.as_desc);
    } else if (result.source === 'ipinfo') {
      network = splitAS(data.org);
      var lite = 'country_code' in data || 'asn' in data || 'as_name' in data;
      result.countryCode = countryCode(lite ? data.country_code : data.country);
      result.country = text(data.country);
      result.region = text(data.region);
      result.city = text(data.city);
      result.asn = lite ? asn(data.asn) : network.asn;
      result.organization = lite ? text(data.as_name) || network.organization : network.organization;
      result.timezone = text(data.timezone);
    }
    if (result.ip && (result.countryCode || result.country || result.city || result.region)) {
      result.state = 'ok';
      result.message = '';
    } else {
      result.message = '定位服务未返回可用的位置数据';
    }
    return result;
  }
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCharCode(0xd83c, 0xdde6 + code.charCodeAt(0) - 65, 0xd83c, 0xdde6 + code.charCodeAt(1) - 65);
  }
  function label(state) {
    var labels = {
      ok: '正常', 'rate-limited': 'GeoIP 查询限流', 'no-data': 'GeoIP 暂无定位',
      'http-error': 'GeoIP HTTP 错误', 'invalid-response': 'GeoIP 响应无效',
      'network-error': 'GeoIP 网络错误', timeout: 'GeoIP 查询超时',
    };
    return labels[state] || 'GeoIP';
  }
  function lines(values) {
    return values.filter(function (value) { return Boolean(value); }).join('\n');
  }
  function countryName(result) {
    return countries[result.countryCode] || result.country || result.countryCode;
  }
  function translated(table, result, value) {
    var names = table[result.countryCode];
    return names && Object.prototype.hasOwnProperty.call(names, value) ? names[value] : value;
  }
  function locality(result) {
    var country = countryName(result), values = [];
    var region = translated(regions, result, result.region);
    var city = translated(cities, result, result.city);
    // Display aliases only; the normalized source and full details stay unchanged.
    var shortRegions = { US: { '加利福尼亚州': '加州' }, JP: { '东京都': '东京', '大阪府': '大阪' } };
    var aliases = shortRegions[result.countryCode];
    if (aliases && Object.prototype.hasOwnProperty.call(aliases, region)) region = aliases[region];
    [region, city].forEach(function (value) {
      if (value && value !== country && values.indexOf(value) === -1) values.push(value);
    });
    return values.join(' ');
  }
  function networkLine(result) {
    var value = [result.asn, result.ip].filter(Boolean).join(' · ');
    // Long IPv6 uses the line alone; QX still controls the native label width.
    if (value.length > 36) return result.ip;
    // Original display field: timezone, not ISP/organization. Try whole timezone,
    // then the final slash component, then its prefix; never invent a label.
    var timezone = text(result.timezone).replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
    var slash = timezone.lastIndexOf('/');
    var candidates = slash < 0 ? [timezone] : [timezone, timezone.slice(slash + 1), timezone.slice(0, slash)];
    for (var index = 0; index < candidates.length; index += 1) {
      if (candidates[index] && candidates[index].length + 3 + value.length <= 36) return candidates[index] + ' · ' + value;
    }
    return value;
  }
  function details(result) {
    return lines([
      result.ip ? 'IP: ' + result.ip : '',
      '状态: ' + label(result.state), '数据源: ' + (result.source === 'unknown' ? '未知' : result.source),
      countryName(result) ? '国家/地区: ' + countryName(result) : '',
      result.region ? '州/省: ' + translated(regions, result, result.region) : '',
      result.city ? '城市: ' + translated(cities, result, result.city) : '',
      result.asn ? 'ASN: ' + result.asn : '',
      result.organization ? '运营商: ' + result.organization : '',
      result.timezone ? '时区: ' + result.timezone : '',
      result.statusCode ? 'HTTP: ' + result.statusCode : '', result.message,
    ]);
  }
  function formatQuantumultX(result) {
    var success = result.state === 'ok';
    var heading = success ? lines([flag(result.countryCode), countryName(result), locality(result)]).replace(/\n/g, ' ') : label(result.state);
    return {
      title: success ? heading : lines([heading, result.ip]).replace('\n', ' · '),
      subtitle: success ? networkLine(result) : lines([result.ip, result.message]).replace('\n', ' · '),
      ip: result.ip, description: details(result),
    };
  }
  function formatSurgePanel(result, options) {
    var policy = text(options && options.policy) || 'Proxy';
    return {
      title: result.state === 'ok' ? 'GeoIP · ' + (result.city || result.country || result.countryCode) : label(result.state),
      content: 'Policy: ' + policy + '\n' + details(result),
      style: result.state === 'ok' ? 'info' : 'alert',
    };
  }
  return {
    parseGeoResponse: parseGeoResponse, diagnoseHttpResponse: diagnoseHttpResponse,
    formatQuantumultX: formatQuantumultX, formatSurgePanel: formatSurgePanel,
  };
})();
// Quantumult X supplies the HTTP response. This adapter never fetches or changes a policy.
(function () {
  var response = typeof $response === 'undefined' ? null : $response;
  // The built-in checker consumes the final evaluation value, not a callback side effect.
  return $done(AtlasGeoIP.formatQuantumultX(AtlasGeoIP.parseGeoResponse(response)));
}());
