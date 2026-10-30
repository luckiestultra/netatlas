// Generated from the portable GeoIP core and an explicit native adapter.
var AtlasGeoIP = (function createGeoIP() {
  function text(value) {
    if (typeof value !== 'string') return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/^\s+|\s+$/g, '').slice(0, 300);
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
    if ('country_name' in data || 'as_desc' in data || 'city_name' in data) return 'ipwho.de';
    if ('ip' in data && 'country' in data) return 'ipinfo';
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
    if (!diagnostic.responseReceived) return blank(diagnostic.state, 0, errorText(options) || 'No HTTP response received');
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
    var failed = object(data) && ((result.source === 'ip-api' && data.status !== 'success') || data.status === 'fail' || data.success === false || Boolean(data.error));
    if (code === 429 || (failed && /rate.?limit|quota|too many|exceed/i.test(message))) {
      result.state = 'rate-limited';
      result.message = message || 'GeoIP service rate limit';
      return result;
    }
    if (code < 200 || code >= 300) {
      result.state = 'http-error';
      result.message = message || 'GeoIP service returned HTTP ' + code;
      return result;
    }
    if (invalid) {
      result.state = 'invalid-response';
      result.message = 'GeoIP response is not a JSON object';
      return result;
    }
    if (empty || failed || !object(data)) {
      result.message = message || 'GeoIP service returned no location data';
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
    } else if (result.source === 'ipwho.de') {
      result.countryCode = countryCode(data.country_code);
      result.country = text(data.country_name);
      result.city = text(data.city_name);
      result.asn = asn(data.asn);
      result.organization = text(data.as_desc);
    } else if (result.source === 'ipinfo') {
      network = splitAS(data.org);
      result.countryCode = countryCode(data.country);
      result.country = result.countryCode;
      result.region = text(data.region);
      result.city = text(data.city);
      result.asn = network.asn;
      result.organization = network.organization;
      result.timezone = text(data.timezone);
    }
    if (result.ip && (result.countryCode || result.country || result.city || result.region)) {
      result.state = 'ok';
      result.message = '';
    } else {
      result.message = 'GeoIP service returned no usable location data';
    }
    return result;
  }
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCharCode(0xd83c, 0xdde6 + code.charCodeAt(0) - 65, 0xd83c, 0xdde6 + code.charCodeAt(1) - 65);
  }
  function label(state) {
    var labels = {
      'rate-limited': 'GeoIP rate limited', 'no-data': 'GeoIP no location',
      'http-error': 'GeoIP HTTP error', 'invalid-response': 'GeoIP invalid response',
      'network-error': 'GeoIP network error', timeout: 'GeoIP timeout',
    };
    return labels[state] || 'GeoIP';
  }
  function lines(values) {
    return values.filter(function (value) { return Boolean(value); }).join('\n');
  }
  function details(result) {
    return lines([
      'State: ' + result.state, 'API: ' + result.source,
      result.ip ? 'IP: ' + result.ip : '',
      result.country ? 'Country: ' + result.country : '',
      result.region ? 'Region: ' + result.region : '',
      result.city ? 'City: ' + result.city : '',
      result.asn ? 'ASN: ' + result.asn : '',
      result.organization ? 'Organization: ' + result.organization : '',
      result.timezone ? 'Time zone: ' + result.timezone : '',
      result.statusCode ? 'HTTP: ' + result.statusCode : '', result.message,
    ]);
  }
  function formatQuantumultX(result) {
    var place = result.city || result.region || result.country || result.countryCode;
    return {
      title: result.state === 'ok' ? lines([flag(result.countryCode), place]).replace('\n', ' ') : label(result.state),
      subtitle: result.state === 'ok' ? lines([result.ip, result.asn, result.organization]).replace(/\n/g, ' · ') : result.message,
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
  $done(AtlasGeoIP.formatQuantumultX(AtlasGeoIP.parseGeoResponse(response)));
}());
