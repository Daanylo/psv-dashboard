
import { query } from "@/lib/db"

async function main() {
    try {
        const rows = await query(`
            SELECT DISTINCT TRIM(BOTH '\\r' FROM logo_label) as brand_name 
            FROM logo_detections 
            WHERE TRIM(BOTH '\\r' FROM logo_label) NOT LIKE 'psv'
            ORDER BY brand_name
        `);
        console.log("Distinct brands found in logo_detections:");
        console.log(JSON.stringify(rows.map((r: any) => r.brand_name), null, 2));
    } catch (e) {
        console.error(e);
    }
}

main();
