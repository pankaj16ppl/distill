const pool = require("../config/db");

/**
 * Replace the live plan rows for one tool.
 * ai_tools.official_website is never changed here.
 * source_url belongs to the exact page used to verify the plan data.
 */
async function replaceVerifiedPlans(toolId, plans) {
    if (!Number.isInteger(Number(toolId))) {
        throw new Error("Valid toolId is required");
    }

    const cleanPlans = Array.isArray(plans) ? plans : [];

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        await client.query(
            "DELETE FROM tool_plans WHERE tool_id = $1",
            [toolId]
        );

        for (const plan of cleanPlans) {
            await client.query(
                `
                INSERT INTO tool_plans (
                    tool_id,
                    plan_name,
                    pricing_type,
                    price,
                    currency,
                    billing_period,
                    price_text,
                    credits,
                    tokens,
                    messages,
                    minutes,
                    hours,
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
                    $12,
                    $13,
                    $14,
                    NOW()
                )
                `,
                [
                    toolId,
                    plan.plan_name || "Unknown",
                    plan.pricing_type || "subscription",
                    plan.price ?? null,
                    plan.currency ?? null,
                    plan.billing_period ?? null,
                    plan.price_text ?? null,
                    plan.credits ?? null,
                    plan.tokens ?? null,
                    null,
                    plan.minutes ?? null,
                    plan.hours ?? null,
                    plan.source_url || null,
                    plan.verified_at || new Date().toISOString()
                ]
            );
        }

        await client.query("COMMIT");

        return cleanPlans;

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}


/**
 * Get all verified plans for one tool.
 */
async function getVerifiedPlans(toolId) {

    const result = await pool.query(
        `
        SELECT
            id,
            tool_id,
            plan_name,
            pricing_type,
            price,
            currency,
            billing_period,
            price_text,
            credits,
            tokens,
            messages,
            minutes,
            hours,
            source_url,
            last_verified_at,
            updated_at
        FROM tool_plans
        WHERE tool_id = $1
        ORDER BY id ASC
        `,
        [toolId]
    );

    return result.rows;
}


/**
 * Check whether live plan data is less than 2 days old.
 */
function isPlanDataFresh(lastVerifiedAt) {

    if (!lastVerifiedAt) {
        return false;
    }

    const verifiedTime =
        new Date(lastVerifiedAt).getTime();

    if (Number.isNaN(verifiedTime)) {
        return false;
    }

    const TWO_DAYS_MS =
        2 * 24 * 60 * 60 * 1000;

    return (
        Date.now() - verifiedTime <
        TWO_DAYS_MS
    );
}


module.exports = {
    replaceVerifiedPlans,
    getVerifiedPlans,
    isPlanDataFresh
};