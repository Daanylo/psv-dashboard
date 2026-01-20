
import * as dotenv from 'dotenv';
dotenv.config();
import { query } from "@/lib/db";
import { createdAtSecondsExpr } from "@/lib/overview-data";

async function run() {
  try {
    // 3 month range roughly
    const start = Math.floor(new Date("2025-10-22").getTime() / 1000);
    const end = Math.floor(new Date("2026-01-19").getTime() / 1000);
    
    console.log("Checking range:", start, end);

    // 1. Count total rows in range (with index)
    console.time("Count Query");
    const countRes = await query(`
      SELECT COUNT(*) as c 
      FROM instagram_comments ic
      WHERE ic.created_at_ts >= ? AND ic.created_at_ts <= ?
    `, [start, end]);
    console.timeEnd("Count Query");
    const totalRows = countRes[0].c;
    console.log("Total rows in date range:", totalRows);

    // 2. Count rows with player_mentioned IS NOT NULL
    console.time("Count Player Mentioned");
    const countPMRes = await query(`
      SELECT COUNT(*) as c 
      FROM instagram_comments ic
      WHERE ic.created_at_ts >= ? AND ic.created_at_ts <= ?
      AND ic.player_mentioned IS NOT NULL
    `, [start, end]);
    console.timeEnd("Count Player Mentioned");
    const totalMentioned = countPMRes[0].c;
    console.log("Rows with mentions:", totalMentioned);

    // 3. Inspect some player_mentioned values
    const samples = await query(`
      SELECT player_mentioned 
      FROM instagram_comments 
      WHERE player_mentioned IS NOT NULL 
      LIMIT 10
    `);
    console.log("Sample mentions:", samples);

    // 4. Test a LIKE query performance
    // Let's pick a player name likely to exist, e.g., "Bakayoko"
    console.time("LIKE Query");
    const likeRes = await query(`
      SELECT COUNT(*) as c
      FROM instagram_comments ic
      WHERE ic.created_at_ts >= ? AND ic.created_at_ts <= ?
      AND ic.player_mentioned LIKE '%Bakayoko%'
    `, [start, end]);
    console.timeEnd("LIKE Query");
    console.log("Rows matching LIKE '%Bakayoko%':", likeRes[0].c);

  } catch (error) {
    console.error(error);
  }
  process.exit(0);
}

run();
