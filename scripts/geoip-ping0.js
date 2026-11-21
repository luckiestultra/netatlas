// Quantumult X geo_location_checker adapter for http://ping0.cc/geo.
(function () {
  function isIPv4(value) {
    var parts = value.split('.');
    return parts.length === 4 && parts.every(function (part) {
      return /^\d{1,3}$/.test(part) && Number(part) <= 255;
    });
  }

  function isIp(value) {
    if (isIPv4(value)) return true;
    if (value.indexOf(':') < 0 || !/^[0-9a-f:.]+$/i.test(value)) return false;

    var address = value;
    if (address.indexOf('.') >= 0) {
      var separator = address.lastIndexOf(':');
      if (!isIPv4(address.slice(separator + 1))) return false;
      address = address.slice(0, separator + 1) + '0:0';
    }

    var halves = address.split('::');
    if (halves.length > 2) return false;
    var groupText = halves.filter(Boolean).join(':');
    var groups = groupText ? groupText.split(':') : [];
    return groups.every(function (group) {
      return /^[0-9a-f]{1,4}$/i.test(group);
    }) && (halves.length === 2 ? groups.length < 8 : groups.length === 8);
  }

  function format(response) {
    var status = Number(response && response.statusCode);
    if (status !== 200) {
      return {
        title: 'Ping0 定位查询失败',
        subtitle: status ? 'HTTP ' + status : '未收到响应',
        ip: '',
        description: '数据源：Ping0',
      };
    }

    // Ping0 returns IP, location, ASN and organization on separate lines.
    var body = typeof response.body === 'string' ? response.body : '';
    var fields = body.trim().split(/\r?\n/).map(function (line) {
      return line.trim();
    });
    var ip = fields[0];
    if (fields.length > 4 || !isIp(ip) || !fields[1] || /[<>]/.test(fields[1])) {
      return {
        title: 'Ping0 暂无定位',
        subtitle: '响应格式异常',
        ip: '',
        description: '数据源：Ping0',
      };
    }

    var location = fields[1].split(/\s+—\s+/)[0];
    var asn = /^AS[1-9]\d{0,9}$/i.test(fields[2] || '') ? fields[2].toUpperCase() : '';
    var organization = fields[3] || '';
    var subtitle = asn && ip.length + asn.length + 1 <= 36 ? ip + '·' + asn : ip;
    var details = ['IP：' + ip, '位置：' + location, '数据源：Ping0'];
    if (asn) details.push('ASN：' + asn);
    if (organization) details.push('运营商：' + organization);
    return { title: location, subtitle: subtitle, ip: ip, description: details.join('\n') };
  }

  var response = typeof $response === 'undefined' ? null : $response;
  return $done(format(response));
}());
