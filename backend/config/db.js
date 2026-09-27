const { Pool } = require("pg");

require("dotenv").config({
    path: __dirname + "/../.env"
});

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 5
});

pool.on("connect", () => {
    console.log("PostgreSQL connection established ✅");
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err.message);
});

module.exports = pool;