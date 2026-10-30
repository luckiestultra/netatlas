// Quantumult X supplies the HTTP response. This adapter never fetches or changes a policy.
(function () {
  var response = typeof $response === 'undefined' ? null : $response;
  $done(AtlasGeoIP.formatQuantumultX(AtlasGeoIP.parseGeoResponse(response)));
}());
