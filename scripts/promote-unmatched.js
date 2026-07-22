/**
 * Promote all entries from unmatched-venues.json into known-venues.json.
 * Run after reviewing unmatched entries. Prints what it will do — review first.
 *
 * Usage: node scripts/promote-unmatched.js
 */
import { readFile, writeFile } from "fs/promises";

async function main() {
  const unmatched = JSON.parse(await readFile("public/unmatched-venues.json", "utf-8"));
  if (unmatched.length === 0) {
    console.log("No unmatched venues to promote.");
    return;
  }

  const known = JSON.parse(await readFile("public/known-venues.json", "utf-8"));

  console.log(`Promoting ${unmatched.length} venue(s):\n`);

  for (const u of unmatched) {
    known.push({
      name: u.venueName.replace(/,\s*$/, "").trim(),
      city: u.city,
      address: u.address,
      aliases: [u.scrapedName],
    });
    console.log(`  + ${u.venueName.replace(/,\s*$/, "").trim()}`);
    if (u.city) console.log(`    city: ${u.city}`);
    if (u.address) console.log(`    addr: ${u.address}`);
    console.log();
  }

  known.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile("public/known-venues.json", JSON.stringify(known, null, 2));
  await writeFile("public/unmatched-venues.json", "[]");

  console.log(`Done. Known venues: ${known.length}`);
}

main().catch(console.error);
