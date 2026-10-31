# Complete client configuration acceptance

User scope (2026-10-31): finish node input, subscription input, DNS and routing for all eight native clients, verify actual user workflows with independent red/blue agents, then commit and push main. High-star maintained configurations are design references; source file recency, licensing and documented syntax are checked separately. No additional device is available beyond this Mac/QX and CLI kernels.

## Contract

- Public profiles contain complete routing/DNS and real native node/subscription entry points, no active dummy server or subscription. Empty input fails closed; local/private inputs automatically connect nodes and sources to Proxy.
- A local profile command reads client-specific native nodes and subscription URLs from an ignored private JSON file. It writes a private native profile with restrictive permissions; credentials and URLs are never printed, committed or uploaded to third-party converters. Inputs are never overwritten.
- Native subscriptions use the client's own mechanism when available. For sing-box/Shadowrocket, a local importer materializes supported subscription payloads to native nodes. Unsupported formats fail explicitly; no fictional providers.
- DNS separates bootstrap, domestic/direct and remote/proxy roles where native semantics permit; bootstrap must not depend on Proxy resolving its own hostname. LAN names stay local. DNS endpoints are explicit and TLS verification remains enabled.
- Rules run LAN/privacy first, specific services before broad parent services, complete CN domain + IPv4/IPv6 fallback, then final Proxy. Exact nonportable upstream expressions are recorded and are not silently approximated.
- Profiles remain organized by client. Source/license records and representative maintained full-profile references are included. Optional rewrites/MITM remain explicit opt-in.

## Verification

1. RED user-flow tests: local node -> Proxy -> service/final; subscription -> fetched native payload -> Proxy; DNS role queries; CN domain/IP direct, foreign proxy, ads reject; malformed/empty/failed source preserves previous output.
2. Actual fixed Mihomo/sing-box profiles are rendered through the same private command and tested against loopback subscription, DNS, SOCKS and nonce HTTP services. The harness changes only endpoint parameters, not route/group/DNS structure after rendering.
3. User later explicitly prohibited local QX configuration changes and confirmed no other GUI device is available. All six GUI clients are therefore cross-checked against official documentation and fixed high-star maintained native profiles plus private-input workflow tests. No local QX import, current-profile switch or tunnel change is performed; unavailable GUI runtime is never called passed.
4. Independent red agents attack the concrete final result. Blue agents recreate candidate findings independently and verify old/private data preservation.
5. Build/check/tests/native CI/remote bytes verify the final commit. User has authorized commit and push for this scope; no PR, release or history rewrite.
