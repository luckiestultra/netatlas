// The module passes an existing policy name. This affects only this lookup request.
(function () {
  var policy = typeof $argument === 'string' && $argument.replace(/^\s+|\s+$/g, '') ? $argument.replace(/^\s+|\s+$/g, '') : 'Proxy';
  var completed = false;
  function finish(result) {
    if (completed) return;
    completed = true;
    $done(AtlasGeoIP.formatSurgePanel(result, { policy: policy }));
  }
  setTimeout(function () {
    finish(AtlasGeoIP.parseGeoResponse(null, { error: 'GeoIP request timeout' }));
  }, 6000);
  try {
    $httpClient.get({ url: 'https://ipinfo.io/json', policy: policy, timeout: 5 }, function (error, response, body) {
      finish(AtlasGeoIP.parseGeoResponse({
        statusCode: response && response.status,
        body: body,
      }, { error: error }));
    });
  } catch (error) {
    finish(AtlasGeoIP.parseGeoResponse(null, { error: error && error.message ? error.message : String(error) }));
  }
}());
