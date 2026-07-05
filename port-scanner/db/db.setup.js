const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
});
module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: async () => pool.connect(),
  updateScanStatus: async (scanId, status, client = pool) => {
    return client.query(
      `
      UPDATE scans
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [scanId, status]
    );
  },
  saveScanResult: async (scanId, resultData, client = pool) => {
    return client.query(
      `
      INSERT INTO scan_results (scan_id, "resultData", "updated_at")
      VALUES ($1, $2, NOW())
      ON CONFLICT (scan_id)
      DO UPDATE SET
      "resultData" = EXCLUDED."resultData",
      "updated_at" = NOW()
      `,
      [scanId, resultData]
    );
  },
};
