import routing from '../../metadata/routing.json' with { type: 'json' };

export function policyForRuleset(ruleset) {
  return routing.fixed[ruleset.id] || ruleset.id;
}

export function policyGroupsFor(rulesets) {
  const groups = [{ name: 'Proxy', choices: ['REJECT', 'DIRECT'] }];
  const used = new Set(['Proxy', 'DIRECT', 'REJECT']);
  for (const ruleset of orderedRulesets(rulesets)) {
    const name = policyForRuleset(ruleset);
    if (used.has(name)) continue;
    groups.push({ name, choices: routing.initialSelection[ruleset.id] === 'DIRECT' ? ['DIRECT', 'Proxy'] : ['Proxy', 'DIRECT'] });
    used.add(name);
  }
  return groups;
}

export function orderedRulesets(rulesets) {
  const priority = ruleset => routing.first.includes(ruleset.id) ? routing.first.indexOf(ruleset.id) : routing.last.includes(ruleset.id) ? 100 + routing.last.indexOf(ruleset.id) : 50;
  return [...rulesets].sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id, 'en'));
}
