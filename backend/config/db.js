const { Pool } = require("pg");
require("dotenv").config({ path: __dirname + "/../.env" });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

pool.connect()
    .then((client) => {
        console.log("Neon database connected successfully");
        client.release();
    })
    .catch((err) => {
        console.error("Database connection failed:");
        console.error(err);
    });

module.exports = pool;
