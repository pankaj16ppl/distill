const dns = require("dns").promises;
const { Pool } = require("pg");

require("dotenv").config({
    path: __dirname + "/../.env"
});

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

const databaseUrl = new URL(process.env.DATABASE_URL);

const neonHost = databaseUrl.hostname;
const neonPort = Number(databaseUrl.port) || 5432;

// Resolve Neon hostname to ONE IPv4 address.
// We do NOT hardcode the IP because Neon can change it.
async function getNeonIPv4() {
    const result = await dns.lookup(neonHost, {
        family: 4
    });

    return result.address;
}

let pool;

async function createPool() {
    const ipv4 = await getNeonIPv4();

    console.log(`Neon hostname: ${neonHost}`);
    console.log(`Neon IPv4: ${ipv4}`);

    pool = new Pool({
        host: ipv4,
        port: neonPort,

        user: decodeURIComponent(databaseUrl.username),
        password: decodeURIComponent(databaseUrl.password),
        database: databaseUrl.pathname.slice(1),

        ssl: {
            rejectUnauthorized: false,

            // CRITICAL:
            // Keep Neon hostname for TLS SNI
            servername: neonHost
        },

        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,

        max: 5
    });

    pool.on("connect", () => {
        console.log("PostgreSQL connection established ✅");
    });

    pool.on("error", (err) => {
        console.error("Unexpected PostgreSQL pool error:", err.message);
    });

    return pool;
}

// Create the pool immediately.
const poolPromise = createPool();

module.exports = {
    query: async (...args) => {
        const p = await poolPromise;
        return p.query(...args);
    },

    connect: async () => {
        const p = await poolPromise;
        return p.connect();
    },

    end: async () => {
        const p = await poolPromise;
        return p.end();
    }
};