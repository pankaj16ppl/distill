const pool = require("../config/db");

const getAllTools = async () => {
    const result = await pool.query(
        `
        SELECT
            at.*,
            ts.source_url,
            ts.status AS source_status,
            ts.http_status,
            ts.last_success_at,
            ts.last_error,
            ts.failure_count,
            ts.success_count,

            COALESCE(
                (
                    SELECT json_agg(tp ORDER BY tp.id)
                    FROM tool_plans tp
                    WHERE tp.tool_id = at.id
                ),
                '[]'::json
            ) AS live_plans,

            COALESCE(
                (
                    SELECT json_agg(tf ORDER BY tf.id)
                    FROM tool_features tf
                    WHERE tf.tool_id = at.id
                      AND tf.is_active = TRUE
                ),
                '[]'::json
            ) AS live_features

        FROM ai_tools at

        LEFT JOIN LATERAL (
            SELECT
                source_url,
                status,
                http_status,
                last_success_at,
                last_error,
                failure_count,
                success_count
            FROM tool_sources
            WHERE tool_id = at.id
            ORDER BY id DESC
            LIMIT 1
        ) ts ON TRUE

        ORDER BY at.id DESC
        `
    );

    return result.rows;
};

const getToolById = async (id) => {
    const result = await pool.query(
        `
        SELECT
            at.*,
            ts.source_url,
            ts.status AS source_status,
            ts.http_status,
            ts.last_success_at,
            ts.last_error,
            ts.failure_count,
            ts.success_count,

            COALESCE(
                (
                    SELECT json_agg(tp ORDER BY tp.id)
                    FROM tool_plans tp
                    WHERE tp.tool_id = at.id
                ),
                '[]'::json
            ) AS live_plans,

            COALESCE(
                (
                    SELECT json_agg(tf ORDER BY tf.id)
                    FROM tool_features tf
                    WHERE tf.tool_id = at.id
                      AND tf.is_active = TRUE
                ),
                '[]'::json
            ) AS live_features

        FROM ai_tools at

        LEFT JOIN LATERAL (
            SELECT
                source_url,
                status,
                http_status,
                last_success_at,
                last_error,
                failure_count,
                success_count
            FROM tool_sources
            WHERE tool_id = at.id
            ORDER BY id DESC
            LIMIT 1
        ) ts ON TRUE

        WHERE at.id = $1
        `,
        [id]
    );

    return result.rows[0];
};
const upsertToolPlan = async ({
    tool_id,
    plan_name,
    pricing_type,
    price,
    credits,
    tokens,
    minutes,
    hours,
    billing_period,
    source_url,
    last_verified_at
}) => {

    const result = await pool.query(
        `
        INSERT INTO tool_plans (
            tool_id,
            plan_name,
            pricing_type,
            price,
            credits,
            tokens,
            minutes,
            hours,
            billing_period,
            source_url,
            last_verified_at,
            updated_at
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            NOW()
        )

        ON CONFLICT (tool_id, plan_name)
        DO UPDATE SET
            pricing_type = EXCLUDED.pricing_type,
            price = EXCLUDED.price,
            credits = EXCLUDED.credits,
            tokens = EXCLUDED.tokens,
            minutes = EXCLUDED.minutes,
            hours = EXCLUDED.hours,
            billing_period = EXCLUDED.billing_period,
            source_url = EXCLUDED.source_url,
            last_verified_at = EXCLUDED.last_verified_at,
            updated_at = NOW()

        RETURNING *
        `,
        [
            tool_id,
            plan_name,
            pricing_type || "unknown",
            price || "Not available",
            credits || "Not available",
            tokens || "Not available",
            minutes || "Not available",
            hours || "Not available",
            billing_period || "Not available",
            source_url || "Not available",
            last_verified_at
        ]
    );

    return result.rows[0];
};
const replaceToolPlans = async ({
    tool_id,
    plans,
    source_url,
    last_verified_at
}) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        await client.query(
            `
            DELETE FROM tool_plans
            WHERE tool_id = $1
            `,
            [tool_id]
        );

        for (const plan of plans) {

            await client.query(
                `
                INSERT INTO tool_plans (
                    tool_id,
                    plan_name,
                    pricing_type,
                    price,
                    credits,
                    tokens,
                    minutes,
                    hours,
                    billing_period,
                    source_url,
                    last_verified_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    NOW()
                )
                `,
                [
                    tool_id,

                    plan.plan_name || "Not available",

                    plan.pricing_type || "unknown",

                    plan.price || "Not available",

                    plan.credits || "Not available",

                    plan.tokens || "Not available",

                    plan.minutes || "Not available",

                    plan.hours || "Not available",

                    plan.billing_period || "Not available",

                    plan.source_url ||
                        source_url ||
                        "Not available",

                    last_verified_at
                ]
            );
        }

        await client.query("COMMIT");

        return true;

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();

    }
};
const getFreshToolPlans = async (tool_id) => {
    const result = await pool.query(
        `
        SELECT *
        FROM tool_plans
        WHERE tool_id = $1
        ORDER BY id
        `,
        [tool_id]
    );

    return result.rows;
};
module.exports = {
    getAllTools,
    getToolById,
    upsertToolPlan,
    replaceToolPlans,
    getFreshToolPlans
};