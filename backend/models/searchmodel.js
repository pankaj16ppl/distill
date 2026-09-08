
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
        SELECT *,
            (
                SELECT COALESCE(SUM(
                    CASE
                        -- Tool name is the strongest signal
                        WHEN tool_name ILIKE '%' || keyword || '%' THEN 10

                        -- Category / subcategory
                        WHEN category ILIKE '%' || keyword || '%'
                          OR subcategory ILIKE '%' || keyword || '%' THEN 8

                        -- Main purpose / use case
                        WHEN best_use_cases::text ILIKE '%' || keyword || '%'
                          OR primary_use ILIKE '%' || keyword || '%' THEN 7

                        -- Tags
                        WHEN tags::text ILIKE '%' || keyword || '%' THEN 5

                        -- Description
                        WHEN description ILIKE '%' || keyword || '%' THEN 3

                        -- Target users
                        WHEN target_users::text ILIKE '%' || keyword || '%' THEN 1

                        ELSE 0
                    END
                ), 0)
                FROM unnest($1::text[]) AS keyword
            ) AS relevance_score,

            (
                SELECT COUNT(*)
                FROM unnest($1::text[]) AS keyword
                WHERE
                    tool_name ILIKE '%' || keyword || '%'
                    OR category ILIKE '%' || keyword || '%'
                    OR subcategory ILIKE '%' || keyword || '%'
                    OR best_use_cases::text ILIKE '%' || keyword || '%'
                    OR primary_use::text ILIKE '%' || keyword || '%'
                    OR tags::text ILIKE '%' || keyword || '%'
                    OR description ILIKE '%' || keyword || '%'
            ) AS matched_keywords

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

        ORDER BY relevance_score DESC, matched_keywords DESC, id ASC
        `,
        [patterns]
    );

    const rows = result.rows;

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

    /*
     * Find the largest relative drop between consecutive scores.
     * This makes the cutoff depend on the current search results,
     * not on a specific task.
     */
    let bestCutIndex = scoredRows.length;

    let largestRelativeDrop = 0;

    for (let i = 0; i < scoredRows.length - 1; i++) {
        const currentScore = scoredRows[i].relevance_score;
        const nextScore = scoredRows[i + 1].relevance_score;

        if (currentScore <= 0) {
            continue;
        }

        const relativeDrop =
            (currentScore - nextScore) / currentScore;

        if (relativeDrop > largestRelativeDrop) {
            largestRelativeDrop = relativeDrop;
            bestCutIndex = i + 1;
        }
    }

    /*
     * If there is no meaningful separation, keep all candidates
     * that have the same relevance level as the strongest group.
     *
     * This avoids arbitrarily deleting potentially relevant tools.
     */
    if (largestRelativeDrop === 0) {
        const topScore = scoredRows[0].relevance_score;

        return scoredRows.filter(
            tool => tool.relevance_score === topScore
        );
    }

    const relevantTools = scoredRows.slice(0, bestCutIndex);

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