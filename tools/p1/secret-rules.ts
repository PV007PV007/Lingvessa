/** Conservative source gate. Diagnostics never return matching secret values. */
export function secretRuleIds(text: string): string[] {
  const rules: [string, RegExp][] = [
    ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['cloud-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['provider-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
    ['credential-url', /(?:postgres(?:ql)?|redis|https?):\/\/[^\s:/]+:[A-Za-z0-9_%+.-]{8,}@/],
    ['assigned-secret', /(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[=:]\s*["'][A-Za-z0-9_+/.=-]{20,}["']/i],
  ];
  return rules.filter(([, rule]) => rule.test(text)).map(([name]) => name);
}
