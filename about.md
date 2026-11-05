# 311 streetlight complaint map

## What it shows

This interactive map shows 311 service requests about broken, dim or damaged streetlights in New York City since Jan. 1, 2024. Counts are service requests, not unique failed lights or separate outages: several requests may concern the same unresolved condition or different lights near one another.

The map offers several views:

- **Hex grid** shows complaint density across the city using a hexagonal grid. Darker red hexes have more complaints. This is the best view for seeing broad geographic patterns.
- **All spots** plots complaint locations as dots, grouped into grid cells about 55 by 42 meters, with size and color scaled to the number of complaints in each cell.
- **Locations with repeated complaints (10+ and 20+)** isolate the grid cells with the highest complaint totals. These appear as pulsing circles, with faster pulses indicating more complaints. A high count does not show whether the complaints describe one unresolved problem, several nearby lights or separate failures.

Rankings can be viewed three ways:

- **By address** shows the addresses with the most complaints, grouped by address text, borough and neighborhood.
- **By census tract** shows total complaints per 2020 census tract.
- **Per square mile** shows complaints per square mile of census tract area.

Clicking any dot or hex cell shows details including address, neighborhood, complaint count and how many are still open in 311. A closed request does not necessarily mean the light was repaired.

## What's included

The data covers eight complaint descriptors from the 311 "Street Light Condition" category:

- Street Light Out
- Multiple Street Lights Out
- Street Light Lamp Dim
- Street Light Lamp Missing
- Fixture/Luminaire Out of Position
- Fixture/Luminaire Damaged
- Fixture/Luminaire Missing
- Flood Light Lamp Out

These are complaints about pole-mounted streetlights. They include dim lamps and damaged or displaced fixtures, so they are broader than confirmed outages. Traffic signals and pedestrian signals have separate 311 categories and are not included.

## What's excluded

The map focuses on ordinary streets and sidewalks. It leaves out requests that 311 recorded as a place name (parks, playgrounds, bridges, waterfront paths and similar), requests located at a named NYC Parks property, requests on a listed limited-access highway or bridge roadway without a house number, and addresses beginning with "999." This is the project's chosen scope; it does not mean all such lights are maintained by a different agency. Ordinary streets such as Park Avenue, Eastern Parkway and Bruckner Boulevard are included. The [methodology](methodology.md) lists every rule and its limits.

## How it was built

The page is static, with no server-side code.

**Data source:** NYC Open Data's 311 Service Requests dataset (`erm2-nwe9`). The page first loads a stored snapshot (`complaints.json`), then downloads the current data from the Socrata API in pages of 50,000 records. A complete download replaces the snapshot; an incomplete one leaves the snapshot in place, and the page says which one is showing. The snapshot is rebuilt with `node scripts/build-data.js`, which applies the same rules.

**Map:** Built with Leaflet.js on CARTO dark basemap tiles.

**Hex grid:** Uses Uber's H3 spatial indexing library at resolution 8 (average area about 0.74 square kilometers per cell).

**Census tract assignment:** 2020 census tract boundaries from NYC Open Data (`63ge-mke6`), simplified and stored in the repository. Each complaint is assigned to a tract with a point-in-polygon test. Per-square-mile rates use the tract's `shape_area` field (converted from square feet). Tracts with fewer than three complaints are left out of the density view.

**Neighborhoods:** Mapped from community board codes to common neighborhood names using a built-in lookup table covering all 59 community boards.

## In the Nov. 5, 2026, snapshot

- **71,997 requests** filed Jan. 1, 2024, through Nov. 4, 2026, are mapped; 3,880 were open in 311 when the data was retrieved.
- The address with the most requests is **286 Thomas Boyland Street** in Brownsville, with 27.
- These figures change with each refresh, and they describe reporting, not an inventory of dark streets.

## Tools and libraries

- [Leaflet.js](https://leafletjs.com/): mapping
- [H3-js](https://h3geo.org/): hexagonal spatial indexing
- [CARTO](https://carto.com/): dark basemap tiles
- [NYC Open Data](https://opendata.cityofnewyork.us/): 311 complaints, Parks Properties and census tracts
