
const pool = require("../config/db");

const searchTools = async (searchTerms) => {
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
        SELECT *,
            (
                SELECT COALESCE(SUM(
                    CASE
                        WHEN tool_name ILIKE '%' || keyword || '%' THEN 10
                        WHEN category ILIKE '%' || keyword || '%'
                          OR subcategory ILIKE '%' || keyword || '%' THEN 7
                        WHEN best_use_cases::text ILIKE '%' || keyword || '%'
                          OR primary_use ILIKE '%' || keyword || '%' THEN 6
                        WHEN tags::text ILIKE '%' || keyword || '%' THEN 3
                        WHEN description ILIKE '%' || keyword || '%' THEN 2
                        WHEN target_users::text ILIKE '%' || keyword || '%' THEN 1
                        ELSE 0
                    END
                ), 0)
                FROM unnest($1::text[]) AS keyword
            ) AS relevance_score

        FROM ai_tools

        WHERE is_active = true
          AND (
              tool_name ILIKE ANY($1::text[])
              OR category ILIKE ANY($1::text[])
              OR subcategory ILIKE ANY($1::text[])
              OR description ILIKE ANY($1::text[])
              OR target_users::text ILIKE ANY($1::text[])
              OR best_use_cases::text ILIKE ANY($1::text[])
              OR primary_use ILIKE ANY($1::text[])
              OR tags::text ILIKE ANY($1::text[])
          )

        ORDER BY relevance_score DESC, id ASC
        LIMIT 30
        `,
        [patterns]
    );

    return result.rows;
};

module.exports = {
    searchTools
};
