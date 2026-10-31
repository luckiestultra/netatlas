# Native ASN / GeoIP support

- sing-box 1.14.4 has no native ASN matcher and removed the GeoIP database matcher in 1.12.0.
- Remote CIDR rule-set refresh remains available but is not ASN or dynamic GeoIP, so no fake compatible resource is generated.

- <https://github.com/SagerNet/sing-box/blob/v1.14.4/docs/configuration/route/geoip.md>
- <https://github.com/SagerNet/sing-box/blob/v1.14.4/option/rule.go>
- <https://sing-box.sagernet.org/migration/#migrate-geoip-to-rule-sets>
