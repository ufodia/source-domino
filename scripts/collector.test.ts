import { describe, expect, it } from 'vitest';
import { htmlToText, isPublicAddress, validateTarget } from './collector';

describe('collector network boundary', () => {
  it('blocks local, metadata, reserved, multicast and mapped addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.2', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '198.18.0.1', '192.0.2.1', '203.0.113.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1', '2002:7f00:1::', '3fff::1']) expect(isPublicAddress(ip), ip).toBe(false);
  });
  it('accepts ordinary public IPv4 and global-unicast IPv6', () => {
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });
  it('rejects credentials, nonstandard ports, local names and alternate numeric loopback', () => {
    for (const url of ['https://user:pass@example.org', 'http://localhost', 'http://test.local', 'https://example.org:444', 'http://2130706433', 'http://[::1]', 'file:///etc/passwd']) expect(() => validateTarget(url), url).toThrow();
  });
  it('strips scripts and styles, preserves absolute cited URLs, decodes text entities', () => {
    const parsed = htmlToText('<title>Report &amp; results</title><script>secret()</script><style>x{}</style><p>A result &lt; 5</p><a href="/source">Original</a>', 'https://example.org/report');
    expect(parsed.title).toBe('Report & results');
    expect(parsed.content).toContain('https://example.org/source');
    expect(parsed.content).toContain('A result < 5');
    expect(parsed.content).not.toContain('secret()');
  });
});
