// const mongoose = require("mongoose");

// mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/csekapp", {
//   dbName: "csekapp_db",
// });

// const ScanSchema = new mongoose.Schema(
//   {},
//   {
//     strict: false,
//   },
// );

// const Scan = mongoose.model("Scan", ScanSchema);

// module.exports = Scan;

// postgress db connection setup

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
};
