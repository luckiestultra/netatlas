# Chinese GeoIP display labels

Country/territory display labels are selected from Unicode CLDR 48, fixed commit `acd6d88ae493633240e19a87a721076a8a75c310`, `common/main/zh.xml`. All two-letter entries are retained; explicit short names take precedence.

Copyright © 1991–2025 Unicode, Inc. Data license: Unicode-3.0; the complete license is in [LICENSE-Unicode](LICENSE-Unicode). Source SHA-256: `b1ef8bcadcf19fa8914d9ba812a7bcec124c72fecbf4acea02e4c8bd2fe51866`. These labels translate provider-supplied country codes; they are not an IP geolocation database. The reviewed projection is duplicated inside `createGeoIP` so QX needs no imports or Intl support, and tests require every embedded label to match this projection.
