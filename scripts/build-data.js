#!/usr/bin/env node
// Rebuild the stored data files from NYC Open Data.
//
//   node scripts/build-data.js
//
// Writes parks-names.json (park names used by the location rules) and
// complaints.json (the snapshot the page loads first). Exits with an error,
// and writes nothing, if either download is incomplete.

const fs = require('fs');
const path = require('path');
const S = require('../scope.js');

const ROOT = path.join(__dirname, '..');

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  // 1. Park names
  const parkUrl = S.SOCRATA_PARKS + '?' + new URLSearchParams({
    $select: 'name311,typecategory', $limit: '50000'
  });
  const parkCount = await getJSON(S.SOCRATA_PARKS + '?$select=count(*) as n');
  const parkRows = await getJSON(parkUrl);
  if (parkRows.length !== Number(parkCount[0].n)) {
    throw new Error(`Parks download incomplete: ${parkRows.length} of ${parkCount[0].n}`);
  }
  const names = S.parkNamesFrom(parkRows);
  if (names.length < 500) throw new Error(`Only ${names.length} park names; refusing to write`);
  S.setParkNames(names);
  const parks = {
    g: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    source: 'NYC Parks Properties (enfh-gkve), name311 field',
    types: [...S.PARK_TYPES],
    names
  };

  // 2. Complaints
  const { rows, expected } = await S.fetchAll311({
    onPage: (n, total) => process.stderr.write(`  311: ${n.toLocaleString()} of ${total.toLocaleString()}\n`),
    onRetry: (err, i) => process.stderr.write(`  attempt ${i} failed (${err.message}); retrying\n`)
  });
  const data = S.pack(rows);

  fs.writeFileSync(path.join(ROOT, 'parks-names.json'), JSON.stringify(parks));
  fs.writeFileSync(path.join(ROOT, 'complaints.json'), JSON.stringify(data));

  const ex = data.excluded;
  const open = data.c.filter(r => r[7] === 1).length;
  console.log(`Park names: ${names.length} (from ${parkRows.length} properties)`);
  console.log(`311 records downloaded: ${rows.length} (API count ${expected})`);
  console.log(`Latest complaint date: ${data.latest}`);
  console.log(`Excluded: ${JSON.stringify(ex)}`);
  console.log(`Included: ${data.c.length} (${open} open)`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
