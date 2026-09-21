
const pool = require("../config/db");

const searchTools = async (
    searchTerms,
    searchCategory = null,
    searchSubcategory = null
) => {
    searchCategory =
    typeof searchCategory === "string" &&
    searchCategory.trim()
        ? searchCategory.trim()
        : null;

searchSubcategory =
    typeof searchSubcategory === "string" &&
    searchSubcategory.trim()
        ? searchSubcategory.trim()
        : null;

    if (!Array.isArray(searchTerms)) {
        searchTerms = [searchTerms];
    }

    searchTerms = searchTerms
        .filter(term => typeof term === "string")
        .map(term => term.trim().toLowerCase())
        .filter(Boolean);

    if (!searchTerms.length) {
        return [];
    }

    // Convert all normalized search concepts into individual keywords
    const keywords = [
        ...new Set(
            searchTerms
                .flatMap(term => term.split(/\s+/))
                .map(word => word.replace(/[^a-z0-9-]/gi, ""))
                .filter(word => word.length >= 3)
        )
    ];

    if (!keywords.length) {
        return [];
    }

    const patterns = keywords.map(word => `%${word}%`);
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
    ) AS live_features,

    (
        SELECT COALESCE(
            SUM(
                CASE

                    WHEN LOWER(at.tool_name) = LOWER(keyword)
                        THEN 30

                    WHEN at.tool_name ILIKE '%' || keyword || '%'
                        THEN 20

                    WHEN at.primary_use ILIKE '%' || keyword || '%'
                        THEN 16

                    WHEN at.subcategory ILIKE '%' || keyword || '%'
                        THEN 14

                    WHEN at.best_use_cases::text ILIKE '%' || keyword || '%'
                        THEN 12

                    WHEN at.category ILIKE '%' || keyword || '%'
                        THEN 9

                    WHEN at.tags::text ILIKE '%' || keyword || '%'
                        THEN 7

                    WHEN at.description ILIKE '%' || keyword || '%'
                        THEN 4

                    WHEN at.target_users::text ILIKE '%' || keyword || '%'
                        THEN 2

                    ELSE 0

                END
            ),
            0
        )
        FROM unnest($1::text[]) AS keyword
    ) AS relevance_score,

    (
        SELECT COUNT(*)
        FROM unnest($1::text[]) AS keyword
        WHERE
            at.tool_name ILIKE '%' || keyword || '%'
            OR at.category ILIKE '%' || keyword || '%'
            OR at.subcategory ILIKE '%' || keyword || '%'
            OR at.best_use_cases::text ILIKE '%' || keyword || '%'
            OR at.primary_use::text ILIKE '%' || keyword || '%'
            OR at.tags::text ILIKE '%' || keyword || '%'
            OR at.description ILIKE '%' || keyword || '%'
            OR at.primary_use ILIKE '%' || keyword || '%'
    ) AS matched_keywords

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

WHERE at.is_active = TRUE

  AND (
        $2::text IS NULL
        OR LOWER(at.category) = LOWER($2::text)
      )

  AND (
        $3::text IS NULL
        OR LOWER(at.subcategory) = LOWER($3::text)
      )

  AND (
        at.tool_name ILIKE ANY($1::text[])
        OR at.category ILIKE ANY($1::text[])
        OR at.subcategory ILIKE ANY($1::text[])
        OR at.description ILIKE ANY($1::text[])
        OR at.target_users::text ILIKE ANY($1::text[])
        OR at.best_use_cases::text ILIKE ANY($1::text[])
        OR at.primary_use ILIKE ANY($1::text[])
        OR at.tags::text ILIKE ANY($1::text[])
      )

ORDER BY
    relevance_score DESC,
    matched_keywords DESC,
    at.id ASC
`,
[
    patterns,
    searchCategory,
    searchSubcategory
]
);

    const rows = result.rows;
 console.log("========== LIVE DATA FROM DATABASE ==========");
rows.forEach(tool => {
    console.log(tool.tool_name, {
        live_plans: tool.live_plans,
        live_features: tool.live_features,
        free_plan_details: tool.free_plan_details,
        paid_plans: tool.paid_plans,
        pricing: tool.pricing
    });
});
console.log("=============================================");
    if (!rows.length) {
        return [];
    }

    /*
     * ---------------------------------------------------------
     * DYNAMIC RELEVANCE FILTER
     * ---------------------------------------------------------
     *
     * Instead of using a fixed threshold such as:
     * score >= maxScore * 0.35
     *
     * we look at the natural score gaps between consecutive
     * results.
     *
     * Example:
     *
     * 18, 17, 16, 15, 7, 6
     *
     * The large gap between 15 and 7 indicates that the first
     * four are much more relevant.
     *
     * Example:
     *
     * 18, 17
     *
     * Both are retained.
     *
     * Example:
     *
     * 18
     *
     * The single strong result is retained.
     * ---------------------------------------------------------
     */

    const scoredRows = rows
        .map(tool => ({
            ...tool,
            relevance_score: Number(tool.relevance_score),
            matched_keywords: Number(tool.matched_keywords)
        }))
        .filter(tool => tool.relevance_score > 0)
        .sort((a, b) => {
            if (b.relevance_score !== a.relevance_score) {
                return b.relevance_score - a.relevance_score;
            }

            if (b.matched_keywords !== a.matched_keywords) {
                return b.matched_keywords - a.matched_keywords;
            }

            return a.id - b.id;
        });

    if (!scoredRows.length) {
        return [];
    }

    // Only one candidate
    if (scoredRows.length === 1) {
        return scoredRows;
    }

// ---------------------------------------------------------
// RETURN TOP MATCHING DATABASE TOOLS
// ---------------------------------------------------------
//
// The SQL query already finds matching tools.
// Keep the top 7 matches instead of cutting results
// based on the largest score gap.
// ---------------------------------------------------------

const relevantTools = scoredRows.slice(0, 7);

console.log(
    "Dynamic search scores:",
    scoredRows.map(tool => ({
        name: tool.tool_name,
        score: tool.relevance_score,
        matched: tool.matched_keywords
    }))
);

console.log(
    "Dynamic relevant tools:",
    relevantTools.map(tool => tool.tool_name)
);

return relevantTools;
};

module.exports = {
    searchTools
};