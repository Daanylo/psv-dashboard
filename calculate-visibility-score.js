import 'dotenv/config';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: false
});

async function ensureVisibilityScoreColumn() {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'logo_detections'`,
    [process.env.DB_NAME]
  );

  const existingColumns = columns.map(c => c.COLUMN_NAME);

  if (existingColumns.includes('visibility_score')) {
    console.log('✓ visibility_score column already exists');
    return;
  }

  await connection.query(
    `ALTER TABLE logo_detections
     ADD COLUMN visibility_score DECIMAL(10,4) DEFAULT NULL`
  );
  console.log('✓ Added visibility_score column');
}

async function backfillVisibilityScores() {
  const [result] = await connection.query(
    `UPDATE logo_detections ld
     JOIN instagram_posts ip ON ip.id = ld.post_id
     SET ld.visibility_score =
       CASE
         WHEN ip.image_width IS NULL OR ip.image_height IS NULL OR ip.image_width = 0 OR ip.image_height = 0
           OR ld.box_width IS NULL OR ld.box_height IS NULL OR ld.box_width <= 0 OR ld.box_height <= 0
           OR ld.box_x IS NULL OR ld.box_y IS NULL
         THEN NULL
         ELSE
           LEAST(
             100,
             (
               0.7 * LEAST(
                 1,
                 SQRT((ld.box_width * ld.box_height) / (ip.image_width * ip.image_height)) * 2.236
               )
               +
               0.3 * GREATEST(
                 0,
                 1 - (
                   SQRT(
                     POW((ld.box_x + (ld.box_width / 2)) - (ip.image_width / 2), 2)
                     + POW((ld.box_y + (ld.box_height / 2)) - (ip.image_height / 2), 2)
                   )
                   / NULLIF(
                       SQRT(POW(ip.image_width / 2, 2) + POW(ip.image_height / 2, 2)),
                       0
                     )
                 )
               )
             ) * 100
           )
       END`
  );

  console.log(`✅ Backfill complete. Rows matched: ${result.matchedRows}, rows changed: ${result.changedRows}`);
}

async function main() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
      throw new Error('Missing DB_* environment variables. Ensure .env has DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.');
    }

    console.log('Ensuring schema...');
    await ensureVisibilityScoreColumn();

    console.log('Calculating visibility scores...');
    await backfillVisibilityScores();
  } catch (error) {
    console.error('Visibility score script error:', error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
