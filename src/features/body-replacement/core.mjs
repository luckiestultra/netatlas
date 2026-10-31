// SPDX-License-Identifier: MIT
// Original text-body utility; no network, storage, eval or host selection.
export function createBodyReplacer() {
  function parse(argument) {
    if (typeof argument !== 'string' || !argument || argument.length > 32_768) throw new Error('Invalid replacement argument');
    var text = argument;
    if (/^%7b/i.test(text)) text = decodeURIComponent(text);
    var rules;
    if (/^\s*\{/.test(text)) {
      var object = JSON.parse(text);
      if (!object || Object.keys(object).length !== 1 || !Array.isArray(object.rules)) throw new Error('Expected rules array');
      rules = object.rules;
    } else {
      rules = text.split('&').map(function (item) {
        var split = item.indexOf('->');
        if (split < 1) throw new Error('Invalid legacy replacement');
        var pattern = item.slice(0, split), flags = '';
        var literal = /^\/([\s\S]*)\/([gimsuy]*)$/.exec(pattern);
        if (literal) { pattern = literal[1]; flags = literal[2]; }
        return { pattern: pattern, flags: flags, replacement: item.slice(split + 2) };
      });
    }
    if (!rules.length || rules.length > 32) throw new Error('Invalid replacement count');
    return rules.map(function (rule) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule) || Object.keys(rule).some(function (key) { return !/^(pattern|flags|replacement)$/.test(key); })
        || typeof rule.pattern !== 'string' || !rule.pattern || rule.pattern.length > 4096 || typeof rule.replacement !== 'string'
        || rule.flags !== undefined && (typeof rule.flags !== 'string' || !/^[gimsuy]*$/.test(rule.flags))) throw new Error('Invalid replacement rule');
      return { regex: new RegExp(rule.pattern, rule.flags || ''), replacement: rule.replacement };
    });
  }
  function replace(body, argument) {
    if (typeof body !== 'string' || body.length > 1_048_576) return {};
    try {
      // Compile the whole recipe first: a bad later rule must never publish a partial edit.
      var rules = parse(argument), result = body;
      for (var i = 0; i < rules.length; i++) result = result.replace(rules[i].regex, rules[i].replacement);
      return { body: result };
    } catch (_) { return {}; }
  }
  return { replace: replace };
}
