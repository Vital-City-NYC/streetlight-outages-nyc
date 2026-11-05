# 311 streetlight complaint map: methodology and data reference

This document details every data source, filter, calculation and design decision in the streetlight complaint map.

**What the counts mean.** Counts represent service requests, not unique failed lights or separate outage events. Multiple requests may concern the same unresolved condition or different lights near one another. Nothing in the map establishes that a location had repeated outages.

---

## 1. Data source

**Dataset:** NYC 311 Service Requests
**Publisher:** NYC Open Data
**Socrata endpoint:** `https://data.cityofnewyork.us/resource/erm2-nwe9.json`
**Documentation:** https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9

The 311 dataset contains every service request filed through NYC's 311 system. Each record includes a complaint type, descriptor, location (address, borough, community board, latitude, longitude), timestamps and status.

**Date range queried:** Jan. 1, 2024, through the current date (the query uses `created_date >= '2024-01-01T00:00:00'`).

**Fields retrieved per record:**

| Field | Description | Example |
|---|---|---|
| `descriptor` | Specific complaint subtype | "Street Light Out" |
| `created_date` | When the complaint was filed | "2024-06-15T14:23:00.000" |
| `latitude` | Latitude of the complaint | 40.6782 |
| `longitude` | Longitude of the complaint | -73.9442 |
| `incident_address` | Street address | "123 ATLANTIC AVE" |
| `borough` | Borough name | "BROOKLYN" |
| `community_board` | Community board code | "02 BROOKLYN" |
| `status` | Complaint status | "Open" or "Closed" |
| `unique_key` | 311 request number, used to order and check the download | "59896684" |
| `address_type` | How 311 recorded the location | "ADDRESS", "INTERSECTION", "BLOCKFACE" or "PLACENAME" |
| `street_name`, `intersection_street_1`, `intersection_street_2` | Street names 311 recorded | "GRAND CENTRAL PARKWAY" |

**API query (Socrata SoQL):**
```
$where=complaint_type='Street Light Condition' AND created_date>='2024-01-01T00:00:00' AND descriptor in(<the eight descriptors in section 2>)
$select=unique_key,descriptor,created_date,latitude,longitude,incident_address,street_name,intersection_street_1,intersection_street_2,address_type,borough,community_board,status
$order=unique_key
$limit=50000
$offset=[paginated: 0, 50000, ...]
```

The download first asks the API how many records match (`$select=count(*)`), then fetches pages of 50,000 records ordered by request number. A failed page is retried up to three times (after 1, 2 and 3 seconds). The download counts as complete only if the number of records received is at least the count the API reported and no request number appears twice. Otherwise the whole download is attempted again, up to three times, and then treated as a failure. This check is needed: on Nov. 5, 2026, the same query returned 31,711 records on one call and 32,189 on the next.

The query and these checks live in `scope.js`, which both the page and the build script use.

---

## 2. Filtering: what's included

Only complaints whose `descriptor` field exactly matches one of these eight values are included:

1. Street Light Out
2. Multiple Street Lights Out
3. Street Light Lamp Dim
4. Street Light Lamp Missing
5. Fixture/Luminaire Out Of Position
6. Fixture/Luminaire Damaged
7. Fixture/Luminaire Missing
8. Flood Light Lamp Out

All eight fall under the umbrella complaint type "Street Light Condition." Other descriptors in the same category (e.g., "Street Light Cycling" or "Lamppost Leaning") are not included.

The eight descriptors are broader than confirmed lights-out incidents. They include dim lamps and damaged, missing or displaced fixtures. In the Nov. 5, 2026, snapshot, 67,073 of the 71,997 included requests are "Street Light Out."

**What these descriptors mean:** These are complaints about pole-mounted streetlights that illuminate public streets and sidewalks. Traffic signals and pedestrian signals have separate 311 categories ("Traffic Signal Condition") and are not included.

---

## 3. Filtering: what's excluded

The map focuses on ordinary streets and sidewalks. We seek to exclude other facility types to keep that scope consistent; the exclusions do not imply that all such lights are maintained by a different agency. (NYC311 routes streetlight complaints on park paths, playgrounds, public-park parking lots and golf courses to the Department of Transportation; see [NYC311's streetlight guidance](https://portal.311.nyc.gov/article/?kanumber=KA-02463).)

Earlier versions removed any complaint whose address contained words such as "park," "beach," "island," "river" or "Bruckner." That also removed ordinary streets, including Park Avenue, Beach 129th Street, Coney Island Avenue, Eastern Parkway, Kings Highway and Bruckner Boulevard. The word list has been replaced. A complaint is now excluded for one of five reasons, checked in this order:

1. **Placeholder address.** The `incident_address` begins with `999 ` (for example "999 Nostrand Avenue"). This rule is unchanged from earlier versions. It is an editorial decision: we treat these as likely placeholders rather than building addresses, but we have not verified every such address.
2. **Place name.** 311 recorded the location as a place name (`address_type = 'PLACENAME'`) rather than a street address, intersection or block face. These are mostly parks, playgrounds, bridges, rivers, waterfront paths and schoolyards (for example "Central Park," "Hudson River," "Queensboro Bridge"). This uses 311's own classification. A few place names are street-like, such as "City Island Circle."
3. **Parks property.** The location, with no house number, is the name of a NYC Parks property: the street name 311 recorded matches the `name311` field (the name 311 uses for that property) in the [Parks Properties dataset](https://data.cityofnewyork.us/Recreation/Parks-Properties/enfh-gkve). Only parks and park facilities count: flagship, community and neighborhood parks, playgrounds (including jointly operated ones), nature areas, fields and courts, waterfront facilities, historic house parks, cemeteries, gardens and Parks buildings. Malls, strips, triangles, plazas, parkways, lots and undeveloped land are not used, because many share a name with the street they sit on, and names ending in a street word ("Ida Court") are dropped. The list of names is stored in `parks-names.json`.
4. **Limited-access highway.** The location, with no house number, is on one of these highways (after expanding abbreviations such as EXPY and PKWY): FDR Drive, Harlem River Drive, Henry Hudson Parkway, Major Deegan, Cross Bronx, Bruckner, Sheridan and Throgs Neck expressways, Bronx River and Hutchinson River parkways, New England Thruway, Brooklyn-Queens, Gowanus and Prospect expressways, Belt, Shore, Laurelton and Southern State parkways, Grand Central Parkway, Long Island, Queens Midtown, Clearview, Van Wyck, Nassau and Whitestone expressways, Cross Island, Jackie Robinson and Interboro parkways, Staten Island and West Shore expressways, and Korean War Veterans and Richmond parkways. For intersections, either cross street can match. House-numbered addresses on these roads (for example "130-30 Van Wyck Expressway") are on service roads and stay in, as do boulevards and avenues that share a name, such as Bruckner Boulevard, Horace Harding Expressway, Eastern Parkway and Ocean Parkway.
5. **Bridge or tunnel roadway.** The location, with no house number, is a street name ending in "Bridge" or "Tunnel" (for example "Williamsburg Bridge"). "Bridge Street" does not match.

**Counts, Nov. 5, 2026, snapshot:** Of 82,189 records downloaded, 3,970 have no map coordinates and are dropped. Of the rest, 212 are excluded as placeholders, 3,136 as place names, 1,268 as Parks properties, 1,536 as highways and 70 as bridges, leaving 71,997. The page shows these counts.

**Effect of the change:** Applied to the same records (filed Jan. 1, 2024, through March 28, 2026), the old word list keeps 50,741 and the new rules keep 51,932.

**Known limitations:**
- Complaints filed with an ordinary street address or intersection that are actually about lights inside a park are still counted.
- Place names that 311 did not tag as place names and that don't match a Parks name exactly stay in. In the Nov. 5, 2026, snapshot, three of the top 10 addresses are of this kind: "Cadman Plaza" (the Parks name is "Cadman Plaza Park"), "Ridgeood Veterans Triangle" (a triangle, a type we keep because most triangles sit in the street) and "Tremont Park."
- The highway list is a judgment about which roads are limited-access. Shore Parkway is on it, though some unnumbered complaints filed there may concern its service roads.
- These exclusions can still shift neighborhood comparisons and rankings, especially near large parks and highways.

---

## 4. Location clustering

The 311 data provides latitude and longitude to ~6 decimal places. Complaints about the same spot can have slightly different coordinates, so the app rounds coordinates to a grid to group nearby complaints.

**Rounding formula:**
```
roundedLat = (Math.round(lat * 2000) / 2000).toFixed(4)
roundedLng = (Math.round(lng * 2000) / 2000).toFixed(4)
```

This rounds to the nearest 0.0005 degrees, which equals roughly **55 meters (180 feet) north-south** and roughly **42 meters (138 feet) east-west** at NYC's latitude (~40.7 degrees N).

Each unique `roundedLat,roundedLng` pair becomes one "location." These are grid cells, not individually identified lamps or street blocks. All complaints that round to the same grid point are grouped together. The displayed position for each cluster is the **average** of all complaint coordinates in that group (not the rounded center), so dots appear at the true centroid of reports.

**This clustering is used in:**
- The "all spots" view (point layer)
- The "locations with repeated complaints" views (10+ and 20+)
- The "repeat locations" stat in the summary box

The address ranking (section 6a) uses a different grouping, by address text.

---

## 5. Views and how they work

### 5a. Hex grid

Uses Uber's H3 hexagonal spatial indexing library at **resolution 8**.

**What resolution 8 means:** Each hexagonal cell has an average area of approximately **0.74 square kilometers (0.29 square miles)** and an average edge length of approximately **531 meters (1,740 feet)**, per the [H3 cell statistics](https://h3geo.org/docs/core-library/restable/). Actual cell dimensions vary by location.

**How it works:** For each complaint, the app calls `h3.latLngToCell(lat, lng, 8)` to assign it to a hex cell. It then counts complaints per cell and draws each cell as a polygon on the map.

**Color scale (fill colors by complaint count in that hex cell):**

| Complaints | Fill color | Opacity |
|---|---|---|
| 1-7 | Dark olive | 0.08 |
| 8-19 | Muted olive | 0.20 |
| 20-39 | Dark amber | 0.35 |
| 40-64 | Amber-orange | 0.50 |
| 65-89 | Red-orange | 0.70 |
| 90-119 | Deep red | 0.85 |
| 120+ | Bright red | 0.95 |

These breakpoints were set manually after examining the distribution of complaints per hex cell in an earlier snapshot (p10=7, p25=20, p50=42, p75=68, p90=94, max=189). They have not been reset for the current data.

**Popup contents (click a hex cell):** Total complaints, neighborhood name, borough, number still open in 311 and the top 3 addresses within that cell.

### 5b. All spots (point layer)

Plots every clustered location (see section 4) as a circle marker.

**Point size by complaint count:**

| Complaints | Radius (pixels) |
|---|---|
| 1 | 2.5 |
| 2-3 | 4 |
| 4-9 | 6 |
| 10+ | 8 |

**Point color by complaint count:**

| Complaints | Color |
|---|---|
| 1 | #f0b429 (amber) |
| 2-3 | #db6d28 (orange) |
| 4-9 | #f85149 (red) |
| 10+ | #da3633 (dark red) |

Points with 3+ complaints also get a slightly thicker white stroke (1.5px vs. 0.5px).

**Popup contents:** Address, neighborhood, borough, complaint count, open/closed status, and breakdown by complaint descriptor.

### 5c. Locations with repeated complaints (10+ and 20+)

These views show only grid cells where the total complaint count meets the threshold (10 or more, or 20 or more). They use the same location clustering as the point layer (section 4).

The threshold is a count and nothing more. It does not require complaints separated in time or a confirmed repair between reports, so a location in this view may reflect one unresolved problem reported many times, several nearby lights or separate failures. Earlier versions called these "chronic dark spots"; that label claimed more than the data shows.

**Visual treatment:**
- **Pulsing ring:** Each location has an animated expanding ring that fades out, creating a radar-pulse effect. The pulse speed varies by complaint count: faster pulse = more complaints.
  - Pulse speed formula: `Math.max(0.6, 2.5 - (count - 4) * 0.08)` seconds per cycle
  - Range: 2.5 seconds (slow, ~10 complaints) down to 0.6 seconds (fast, ~28+ complaints)
  - Two rings are staggered at half the period for a continuous effect.
- **Solid circle:** Radius scales with count: `Math.min(3 + count * 0.3, 10)` pixels, capped at 10.
- **Color:** #da3633 (dark red) for 15+ complaints, #f85149 (red) for 8-14, #db6d28 (orange) for fewer.
- **White stroke:** 2px, for visibility against the dark basemap.

**Toggle behavior:** The 10+ and 20+ buttons act as toggles. Clicking "10+ complaints" switches to that view; clicking it again returns to whichever base view (hex grid or all spots) was previously active.

**Popup contents:** Same as the point layer, plus a "repeated complaints" label and a list of which years have complaints at that location.

---

## 6. Rankings

### 6a. By address

Groups complaints by three things together: the `incident_address` text from the 311 data, the borough and the neighborhood name mapped from the community board (section 8a). It does not use the rounded coordinates. Lists the top 15 groups by complaint count, showing only those with 2+ complaints. Complaints with no `incident_address` (mostly intersections; 31,640 in the Nov. 5, 2026, snapshot) are not in this ranking. Clicking an address flies the map to the first complaint with that address.

### 6b. By census tract

Groups all complaints by their assigned 2020 census tract (see section 7 below). Lists the top 20 tracts by total complaint count. Each entry shows the tract number, NTA (Neighborhood Tabulation Area) name, and count. Clicking flies to the average coordinate of complaints in that tract.

### 6c. Per square mile (by census tract)

Same as 6b, but instead of raw count, ranks by **complaints per square mile**:

```
density = complaint_count / tract_area_in_square_miles
```

Where `tract_area_in_square_miles = shape_area / 27,878,400` (since the `shape_area` field from NYC Open Data is in square feet, and 1 square mile = 27,878,400 square feet).

**Noise filter:** Tracts with fewer than 3 complaints are excluded from this view to prevent tiny tracts with 1-2 complaints from producing misleadingly high per-square-mile rates.

---

## 7. Census tract assignment

### 7a. Data source

**Dataset:** 2020 Census Tracts
**Publisher:** NYC Open Data
**Socrata endpoint:** `https://data.cityofnewyork.us/resource/63ge-mke6.geojson`
**Documentation:** https://data.cityofnewyork.us/City-Government/2020-Census-Tracts/63ge-mke6

The raw GeoJSON was downloaded in three paginated batches (1,000 records each, 2,325 tracts total), then simplified and saved as a static file (`census-tracts.json`) hosted in the repository.

**Simplification steps applied to the raw data:**
1. Coordinate precision reduced from ~15 decimal places to 4 decimal places (~11 meter accuracy).
2. Point reduction: every third point in each polygon ring is kept (minimum 4 points per ring), with the ring always properly closed.
3. Only four property fields are retained per tract: `ctlabel` (tract number), `boroname` (borough), `ntaname` (Neighborhood Tabulation Area name), and `shape_area` (area in square feet).

**Result:** 1.5 MB static file vs. ~9 MB raw, loads in under a second from GitHub Pages CDN.

### 7b. Spatial assignment algorithm

Each complaint is assigned to a census tract using a two-step process:

**Step 1: Bounding box filter.** For each of the 2,325 census tracts, a bounding box (min/max latitude and longitude) is pre-computed when the tract data loads. For each complaint, only tracts whose bounding box contains the complaint's coordinates are tested further. This typically reduces the candidate set from 2,325 to 5-15 tracts per complaint.

**Step 2: Ray-casting point-in-polygon test.** For each candidate tract, the algorithm casts a horizontal ray from the complaint's coordinates and counts how many times it crosses the tract's polygon boundary. If the count is odd, the point is inside the polygon.

The ray-casting algorithm (from the code):
```
for each polygon in the MultiPolygon:
  for each ring in the polygon:
    inside = false
    for each edge (i, j) in the ring:
      xi = ring[i][latitude], yi = ring[i][longitude]
      xj = ring[j][latitude], yj = ring[j][longitude]
      if the ray crosses this edge:
        inside = !inside
    if inside: return true
```

**What gets stored on each complaint after assignment:**
- `_tract`: Tract label (e.g., "234")
- `_tractBoro`: Borough name from the tract data
- `_tractNta`: NTA name (e.g., "Brownsville")
- `_tractArea`: Area in square feet

**Complaints that don't match any tract:** Some complaints fall in water, on jurisdiction boundaries or in areas not covered by census tracts. These are silently excluded from tract-based rankings but still appear in all other views.

---

## 8. Neighborhood names

Two different neighborhood name systems are used:

### 8a. Community board neighborhoods (hex grid, points, repeated-complaint locations)

Derived from the `community_board` field in the 311 data (e.g., "02 BROOKLYN"). A built-in lookup table maps all 59 community boards to common neighborhood names. For example:
- "03 BROOKLYN" = Bedford-Stuyvesant
- "05 BROOKLYN" = East New York/Cypress Hills
- "10 MANHATTAN" = Central Harlem

When multiple community boards appear in a hex cell or cluster, the one with the most complaints is used.

### 8b. NTA names (census tract rankings)

The census tract data includes NTA (Neighborhood Tabulation Area) names directly from the Census Bureau / NYC Department of City Planning. These are more granular than community board names and are used in the "census tract" and "per sq mi" rankings.

---

## 9. Summary statistics

The four stat cards at the top of the panel:

1. **Total complaints:** Count of all complaints that pass the descriptor and location filters.
2. **Repeat locations:** Count of clustered locations (section 4) that have 2 or more complaints.
3. **Still open:** Count of complaints where `status === 'Open'` in the 311 data.
4. **Address with the most complaints:** The top group in the address ranking (section 6a), shown with its neighborhood name.

All four update when you change the borough filter.

---

## 10. Borough filter

The dropdown filters all views by the `borough` field in the 311 data. Options: All boroughs, Bronx, Brooklyn, Manhattan, Queens, Staten Island. When a borough is selected, the hex grid, point layer, repeated-complaint layers and all rankings are rebuilt using only complaints from that borough.

---

## 11. Data loading and freshness

The page loads in two steps.

1. **Stored snapshot.** It first loads `complaints.json`, a file in the repository built by `scripts/build-data.js` with the same query, completeness checks and location rules as the page. The file records when it was retrieved (`g`) and the latest complaint date it contains (`latest`). The current snapshot was retrieved Nov. 5, 2026, and runs through complaints filed Nov. 4, 2026.
2. **Live refresh.** It then downloads the full current data from the NYC Open Data API in the background (section 1). If that download is complete, it replaces the snapshot, whether the total went up, down or stayed the same, so status changes and corrections show up too. If any part fails, the snapshot stays on screen.

The panel always says which data is showing: the date range of the complaints, and either the time of the last successful live update or the date the stored snapshot was retrieved. If the live update fails, the panel says so.

There is no browser cache beyond the browser's normal handling of these files.

**Census tract file:** Loaded from `census-tracts.json` in the same directory. Census tract boundaries don't change between censuses.

**Rebuilding the snapshot:** run `node scripts/build-data.js` (Node 18 or later). It refuses to write anything if either download is incomplete.

---

## 12. Technical stack

| Component | Library/service | Version | Purpose |
|---|---|---|---|
| Map | Leaflet.js | 1.9.4 | Map rendering, markers, popups |
| Basemap tiles | CARTO dark_all | - | Dark-themed street map tiles |
| Hex grid | H3-js | 4.1.0 | Hexagonal spatial indexing |
| Fonts | Google Fonts (Inter) | - | UI typography |
| Hosting | GitHub Pages | - | Static file hosting |
| Data API | NYC Open Data (Socrata) | - | Live 311 complaint data; Parks Properties names |

The application is a static page with no server-side code. `index.html` and `scope.js` run in the browser; the only build step is the optional data rebuild in section 11.

---

## 13. Files in this repository

| File | What it is | How it was generated |
|---|---|---|
| `index.html` | The page | Hand-coded |
| `scope.js` | Shared query, completeness checks, location rules and data packing | Hand-coded |
| `complaints.json` | Stored snapshot of in-scope 311 complaints, with retrieval date, latest complaint date and exclusion counts | `scripts/build-data.js` |
| `parks-names.json` | Park names used by exclusion rule 3 | `scripts/build-data.js`, from Parks Properties (`enfh-gkve`) |
| `census-tracts.json` | Pre-simplified 2020 census tract boundaries (2,325 tracts, 1.5 MB) | Downloaded from NYC Open Data endpoint `63ge-mke6.geojson` in 3 paginated batches, then coordinates simplified to 4 decimal places with point reduction, non-essential properties stripped |
| `scripts/build-data.js` | Rebuilds the two data files | Hand-coded |
| `about.md` | Short project summary | Hand-written |
| `methodology.md` | This document | Hand-written |

---

## 14. Known limitations and caveats

1. **311 complaints reflect who has called, not where problems exist.** Complaint volume is a measure of reporting behavior, not an objective inventory of streetlight outages. Neighborhoods differ in their propensity for using the 311 system, and many outages are never reported. Areas with lower complaint counts may have just as many dark streetlights as areas with higher counts — they may have fewer residents who know to call 311 or who believe it will make a difference. This data is a signal of where residents see a problem, but it is subject to reporting bias and should not be treated as a complete picture of dark streets.

2. **Location filtering is imperfect.** See the known limitations in section 3. The map still omits some complaints that may concern ordinary streets and still includes some that concern parks or other facilities.

3. **Counts are requests, not outages.** Several requests may describe one unresolved problem, and one request may describe several lights. The included descriptors also cover dim lamps and damaged fixtures.

4. **Location clustering is approximate.** The ~50-meter grid may group complaints about different streetlights that happen to be near each other, or may separate complaints about the same light that straddle a grid boundary.

5. **"Still open" is a 311 status.** A complaint marked "open" in 311 may have already been fixed but not yet closed in the system. Conversely, a "closed" complaint may have been closed without the light actually being repaired.

6. **Census tract assignment can miss edge cases.** Complaints on tract boundaries or in water/unmapped areas won't be assigned to any tract. These still appear in hex grid and point views but are absent from census tract rankings.

7. **Data freshness.** If the live refresh fails, the page shows the stored snapshot and says so. The snapshot is rebuilt by hand, not on a schedule.

8. **Census tract geometry is simplified.** Coordinates are rounded to 4 decimal places (~11m) and polygon rings are point-reduced. This means tract boundaries are approximate to within about 10-15 meters, which can misassign a small number of complaints near tract edges.

9. **No population normalization.** The "per square mile" ranking normalizes by area but not by population. A dense residential tract and an industrial tract of the same area are treated equally. Population-weighted analysis would require linking to American Community Survey data, which is not currently included.

10. **311 data has broader quality problems.** A research paper on the NYC 311 dataset documents undocumented values and inconsistent conventions for missing data (David Tussey and Jun Yan, "Principles for Open Data Curation: A Case Study with the New York City 311 Service Request Data," [arXiv:2502.08649](https://arxiv.org/abs/2502.08649), 2025). It is cited here for those general caveats only; it does not address addresses beginning with "999."
