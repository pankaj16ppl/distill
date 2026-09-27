const pool = require("../config/db");

const ensureFavoritesTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            item_type VARCHAR(20) NOT NULL DEFAULT 'tool',
            item_id VARCHAR(100) NOT NULL,
            item_data JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, item_type, item_id)
        )
    `);
};

const addFavorite = async (userId, itemType, itemId, itemData) => {
    const result = await pool.query(
        `
        INSERT INTO favorites (user_id, item_type, item_id, item_data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, item_type, item_id)
        DO UPDATE SET item_data = EXCLUDED.item_data
        RETURNING id, user_id, item_type, item_id, item_data, created_at
        `,
        [userId, itemType, String(itemId), itemData ? JSON.stringify(itemData) : null]
    );
    return result.rows[0];
};

const removeFavorite = async (userId, itemType, itemId) => {
    const result = await pool.query(
        `DELETE FROM favorites WHERE user_id = $1 AND item_type = $2 AND item_id = $3`,
        [userId, itemType, String(itemId)]
    );
    return result.rowCount > 0;
};

const getFavoritesByUser = async (userId) => {
    const result = await pool.query(
        `SELECT id, user_id, item_type, item_id, item_data, created_at
         FROM favorites WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows;
};

const getFavoriteKeysByUser = async (userId) => {
    const result = await pool.query(
        `SELECT item_type, item_id FROM favorites WHERE user_id = $1`,
        [userId]
    );
    return result.rows;
};

module.exports = {
    ensureFavoritesTable,
    addFavorite,
    removeFavorite,
    getFavoritesByUser,
    getFavoriteKeysByUser
};