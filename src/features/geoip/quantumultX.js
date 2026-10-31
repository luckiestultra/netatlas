// Quantumult X supplies the HTTP response. This adapter never fetches or changes a policy.
(function () {
  var response = typeof $response === 'undefined' ? null : $response;
  // The built-in checker consumes the final evaluation value, not a callback side effect.
  return $done(AtlasGeoIP.formatQuantumultX(AtlasGeoIP.parseGeoResponse(response)));
}());
