# Identifier snapshots used by the entity crosswalk.
# These files are small and are committed. Large WDI/WPP blobs are gitignored.

## Sources

| File | Authority | Join keys |
| --- | --- | --- |
| `un-m49.csv` / `un-m49.json` | [UNSD M49 overview](https://unstats.un.org/unsd/methodology/m49/overview/) | `m49`, `isoAlpha2`, `isoAlpha3` |
| `un-members.json` | [UN Library current members](https://research.un.org/en/unmembers/currentmembers) | UN short name → M49 `countryOrArea` (same UN terminology, three aliases) |
| `iso-3166-1.json` | ISO 3166-1 via [Debian iso-codes](https://salsa.debian.org/iso-codes-team/iso-codes) | `alpha_2`, `alpha_3`, `numeric` |
| `natural-earth-adm0.json` | Natural Earth 5.1.1 `ne_50m_admin_0_countries` (public domain) | `ADM0_A3`, `ISO_A3_EH` |
| `wikidata-native-names.json` | Wikidata SPARQL `P297`/`P1705` (CC0) | ISO alpha-2 |

Taiwan (M49 158) and Kosovo (statistical M49 412) are absent from the M49 country table as independent areas; they are added from ISO 3166-1 / UNSD FAQ overlays.

RestCountries and other unofficial country APIs are not used.

Native names: Wikidata CC0 (`P1705`). If SPARQL is rate-limited, UN/ISO names ship first and Natural Earth `NAME_*` fields fill scripts. See `scripts/fetch/wikidata-native-names.rq`.
