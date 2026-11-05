// Shared data rules for the 311 streetlight complaint map.
//
// Used by index.html (live refresh in the browser) and by
// scripts/build-data.js (the stored snapshot), so both apply the same query,
// the same completeness check and the same location rules.
//
// The map covers ordinary streets and sidewalks. A complaint is left out when:
//   placeholder  its address begins with "999 " (kept as an editorial rule)
//   place        311 recorded the location as a place name rather than a street
//                address or intersection (address_type = PLACENAME): parks,
//                playgrounds, bridges, waterfront paths, schoolyards and so on
//   park         its location is the name of a NYC Parks property, taken from
//                the Parks Properties dataset's name311 field (the name 311
//                uses for that park), with no house number
//   highway      it sits on a named limited-access highway, with no house
//                number (house-numbered addresses are on service roads)
//   bridge       it sits on a bridge or tunnel roadway, with no house number
// Ordinary streets whose names contain words like Park, Beach, Island or
// Bruckner are not matched by word and stay in.

(function (root) {
  const SOCRATA_311 = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';
  const SOCRATA_PARKS = 'https://data.cityofnewyork.us/resource/enfh-gkve.json';
  const START_DATE = '2024-01-01T00:00:00';
  const PAGE_SIZE = 50000;

  const DESCRIPTORS = [
    'Street Light Out', 'Multiple Street Lights Out', 'Street Light Lamp Dim',
    'Street Light Lamp Missing', 'Fixture/Luminaire Out Of Position',
    'Fixture/Luminaire Damaged', 'Fixture/Luminaire Missing', 'Flood Light Lamp Out'
  ];

  const WHERE = `complaint_type='Street Light Condition' AND created_date>='${START_DATE}'` +
    ` AND descriptor in(${DESCRIPTORS.map(d => `'${d}'`).join(',')})`;
  const SELECT = 'unique_key,descriptor,created_date,latitude,longitude,incident_address,' +
    'street_name,intersection_street_1,intersection_street_2,address_type,borough,community_board,status';

  // Parks property types that are parks or park facilities. Malls, strips,
  // triangles, plazas, parkways and lots are left out of this list because
  // many of them share a name with the street they sit on.
  const PARK_TYPES = new Set([
    'Flagship Park', 'Community Park', 'Neighborhood Park', 'Playground',
    'Jointly Operated Playground', 'Nature Area', 'Recreational Field/Courts',
    'Waterfront Facility', 'Historic House Park', 'Cemetery', 'Garden',
    'Buildings/Institutions'
  ]);

  // Limited-access highways in New York City, spelled as normStreet() leaves them.
  const HIGHWAYS = new Set([
    'FDR DRIVE', 'HARLEM RIVER DRIVE', 'HENRY HUDSON PARKWAY',
    'MAJOR DEEGAN EXPRESSWAY', 'CROSS BRONX EXPRESSWAY', 'BRUCKNER EXPRESSWAY',
    'SHERIDAN EXPRESSWAY', 'BRONX RIVER PARKWAY', 'HUTCHINSON RIVER PARKWAY',
    'THROGS NECK EXPRESSWAY', 'NEW ENGLAND THRUWAY',
    'BROOKLYN QUEENS EXPRESSWAY', 'GOWANUS EXPRESSWAY', 'PROSPECT EXPRESSWAY',
    'BELT PARKWAY', 'SHORE PARKWAY', 'LAURELTON PARKWAY', 'SOUTHERN STATE PARKWAY',
    'GRAND CENTRAL PARKWAY', 'LONG ISLAND EXPRESSWAY', 'QUEENS MIDTOWN EXPRESSWAY',
    'CLEARVIEW EXPRESSWAY', 'CROSS ISLAND PARKWAY', 'VAN WYCK EXPRESSWAY',
    'NASSAU EXPRESSWAY', 'WHITESTONE EXPRESSWAY', 'JACKIE ROBINSON PARKWAY',
    'INTERBORO PARKWAY', 'STATEN ISLAND EXPRESSWAY', 'WEST SHORE EXPRESSWAY',
    'KOREAN WAR VETERANS PARKWAY', 'RICHMOND PARKWAY'
  ]);

  const ABBREV = [
    [/&/g, ' AND '],
    [/[.'’,]/g, ''],
    [/\s+/g, ' '],
    [/\bEXPY\b|\bEXPWY\b|\bEXPRWY\b/g, 'EXPRESSWAY'],
    [/\bPKWY\b|\bPKY\b/g, 'PARKWAY'],
    [/\bDR\b/g, 'DRIVE'],
    [/\bISL\b/g, 'ISLAND'],
    [/\bRVR\b/g, 'RIVER'],
    [/\bBKLYN\b|\bBRKLYN\b/g, 'BROOKLYN'],
    [/\bBRG\b/g, 'BRIDGE'],
    [/\bPLGD\b/g, 'PLAYGROUND'],
    [/\b(PS|IS|JHS|MS|HS)\s?(\d+)/g, '$1 $2'],
    [/^H HUDSON\b/, 'HENRY HUDSON'],
    [/^HUTCH\b/, 'HUTCHINSON'],
    [/^F D R\b/, 'FDR'],
    [/\bINTERBOROUGH\b/, 'INTERBORO']
  ];

  function normStreet(s) {
    let t = String(s || '').toUpperCase();
    for (const [re, rep] of ABBREV) t = t.replace(re, rep);
    return t.trim();
  }

  function hasHouseNumber(addr) {
    return /^-?\d[\d-]*[A-Z]?\s/.test(String(addr || '').trim());
  }

  // Build the set of park names from Parks Properties rows.
  function parkNamesFrom(rows) {
    const streetEnding = /\b(AVENUE|AVE|STREET|ST|PLACE|PL|ROAD|RD|BOULEVARD|BLVD|PARKWAY|DRIVE|LANE|TERRACE|COURT|CT|WAY|CONCOURSE)$/;
    const names = new Set();
    for (const r of rows) {
      if (!r.name311 || !PARK_TYPES.has(r.typecategory)) continue;
      const n = normStreet(r.name311);
      if (!n || n === 'PARK' || streetEnding.test(n)) continue;
      names.add(n);
    }
    return [...names].sort();
  }

  let parkNames = new Set();
  function setParkNames(list) { parkNames = new Set(list); }

  function streetKind(s) {
    const t = normStreet(s);
    if (!t) return null;
    if (HIGHWAYS.has(t)) return 'highway';
    if (/\b(BRIDGE|TUNNEL)$/.test(t)) return 'bridge';
    if (parkNames.has(t)) return 'park';
    return null;
  }

  // Returns null when the complaint is in scope, or the reason it is left out.
  function exclusionReason(c) {
    const addr = c.incident_address || '';
    if (/^999\s/i.test(addr)) return 'placeholder';
    if (c.address_type === 'PLACENAME') return 'place';
    if (hasHouseNumber(addr)) return null;
    const first = streetKind(c.street_name || addr);
    if (first) return first;
    if (c.address_type === 'INTERSECTION') {
      for (const s of [c.intersection_street_1, c.intersection_street_2]) {
        const k = streetKind(s);
        if (k === 'highway' || k === 'bridge') return k;
      }
    }
    return null;
  }

  async function getJSON(url, fetchFn, tries) {
    let lastErr;
    for (let i = 0; i <= tries; i++) {
      try {
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (i < tries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw lastErr;
  }

  // Download every matching 311 record. Throws unless the number of rows
  // received equals the count the API reports for the same query, so a
  // partial download is never mistaken for a complete one. The API sometimes
  // returns a short page for a query that a moment later returns in full, so
  // a mismatch triggers a fresh attempt before giving up.
  async function fetchAll311(opts = {}) {
    const attempts = opts.attempts || 3;
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try { return await fetchAll311Once(opts); }
      catch (err) { lastErr = err; if (opts.onRetry) opts.onRetry(err, i + 1); }
    }
    throw lastErr;
  }

  async function fetchAll311Once(opts) {
    const fetchFn = opts.fetch || fetch;
    const onPage = opts.onPage || (() => {});
    const q = p => SOCRATA_311 + '?' + Object.entries(p)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

    const countRows = await getJSON(q({ $select: 'count(*) as n', $where: WHERE }), fetchFn, 3);
    const expected = Number(countRows[0] && countRows[0].n);
    if (!Number.isFinite(expected) || expected <= 0) throw new Error('311 count query returned no total');

    const rows = [];
    for (let offset = 0; offset < expected; offset += PAGE_SIZE) {
      const page = await getJSON(q({
        $select: SELECT, $where: WHERE, $order: 'unique_key',
        $limit: PAGE_SIZE, $offset: offset
      }), fetchFn, 3);
      rows.push(...page);
      onPage(rows.length, expected);
      if (page.length < PAGE_SIZE) break;
    }
    // Records filed while the download ran can push the total up by a few.
    if (rows.length < expected) {
      throw new Error(`Incomplete download: ${rows.length} of ${expected} rows`);
    }
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.unique_key)) throw new Error(`Duplicate record ${r.unique_key}: paging shifted during download`);
      seen.add(r.unique_key);
    }
    return { rows, expected };
  }

  const BORO_CODES = { BRONX: 'BX', BROOKLYN: 'BK', MANHATTAN: 'MN', QUEENS: 'QN', 'STATEN ISLAND': 'SI' };

  // Apply the scope rules and pack the in-scope records into the compact
  // row format stored in complaints.json.
  function pack(rows, meta = {}) {
    const excluded = { placeholder: 0, place: 0, park: 0, highway: 0, bridge: 0, no_coordinates: 0 };
    const out = [];
    let latest = '';
    for (const r of rows) {
      const day = String(r.created_date || '').slice(0, 10);
      if (day > latest) latest = day;
      const lat = parseFloat(r.latitude), lng = parseFloat(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { excluded.no_coordinates++; continue; }
      const why = exclusionReason(r);
      if (why) { excluded[why]++; continue; }
      const d = DESCRIPTORS.indexOf(r.descriptor);
      if (d < 0) continue;
      out.push([
        Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, d, day,
        r.incident_address || '', BORO_CODES[r.borough] || r.borough || '',
        r.community_board || '', r.status === 'Open' ? 1 : 0
      ]);
    }
    return Object.assign({
      g: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      latest,
      fetched: rows.length,
      excluded,
      d: DESCRIPTORS,
      b: { BX: 'BRONX', BK: 'BROOKLYN', MN: 'MANHATTAN', QN: 'QUEENS', SI: 'STATEN ISLAND' },
      c: out
    }, meta);
  }

  function unpack(data) {
    return data.c.map(r => ({
      latitude: String(r[0]),
      longitude: String(r[1]),
      descriptor: data.d[r[2]],
      created_date: r[3],
      incident_address: r[4],
      borough: data.b[r[5]] || r[5],
      community_board: r[6],
      status: r[7] === 1 ? 'Open' : 'Closed'
    }));
  }

  const api = {
    SOCRATA_311, SOCRATA_PARKS, START_DATE, PAGE_SIZE, DESCRIPTORS, WHERE, SELECT,
    PARK_TYPES, HIGHWAYS, normStreet, hasHouseNumber, parkNamesFrom, setParkNames,
    streetKind, exclusionReason, fetchAll311, pack, unpack
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StreetlightScope = api;
})(this);
