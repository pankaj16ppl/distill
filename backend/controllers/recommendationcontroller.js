const pool = require("../config/db");

const getRecommendations = async (req, res) => {
    try {
        const { profession, task, message } = req.body;

        const userTask = message || task;

        if (!profession || !userTask) {
            return res.status(400).json({
                success: false,
                message: "Profession and task are required"
            });
        }

        // Use the user's original task directly for database search.
        const originalSearch = userTask.trim().toLowerCase();
        const searchPatterns = [`%${originalSearch}%`];

        const result = await pool.query(
            `
            SELECT
                id,
                tool_name,
                category,
                subcategory,
                target_users,
                description,
                best_use,
                pros,
                cons,
                best_use_cases,
                official_website,
                pricing,
                free_plan_details,
                paid_plans,
                ai_models,
                api_available,
                platforms,
                login_required,
                alternatives,
                tags,
                primary_use,
                last_verified_at
            FROM ai_tools
            WHERE is_active = true
              AND (
                    tool_name ILIKE ANY($1::text[])
                 OR category ILIKE ANY($1::text[])
                 OR subcategory ILIKE ANY($1::text[])
                 OR primary_use ILIKE ANY($1::text[])
                 OR best_use ILIKE ANY($1::text[])
                 OR best_use_cases ILIKE ANY($1::text[])
                 OR tags::text ILIKE ANY($1::text[])
              )
            ORDER BY
                (
                    CASE
                        WHEN tool_name ILIKE ANY($1::text[])
                        THEN 100
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN category ILIKE ANY($1::text[])
                        THEN 80
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN subcategory ILIKE ANY($1::text[])
                        THEN 70
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN primary_use ILIKE ANY($1::text[])
                        THEN 60
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN best_use ILIKE ANY($1::text[])
                        THEN 60
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN best_use_cases ILIKE ANY($1::text[])
                        THEN 50
                        ELSE 0
                    END
                    +
                    CASE
                        WHEN tags::text ILIKE ANY($1::text[])
                        THEN 30
                        ELSE 0
                    END
                ) DESC,
                id ASC
            LIMIT 7
            `,
            [searchPatterns]
        );

        const tools = result.rows;

        if (!tools.length) {
            return res.status(404).json({
                success: false,
                message: "No relevant AI tools found in database"
            });
        }

        const finalTools = tools.map((tool) => ({
            id: tool.id,
            name: tool.tool_name,
            category: tool.category,
            subcategory: tool.subcategory,

            description: tool.description || null,

            best_use: tool.best_use || null,

            pros: Array.isArray(tool.pros)
                ? tool.pros
                : [],

            cons: Array.isArray(tool.cons)
                ? tool.cons
                : [],

            pricing: tool.pricing || null,

            free_plan_details: tool.free_plan_details || null,

            paid_plans: tool.paid_plans || null,

            ai_models: tool.ai_models || [],

            official_website: tool.official_website || null,

            last_verified_at: tool.last_verified_at || null
        }));

        return res.status(200).json({
            success: true,
            profession,
            task: userTask,
            tools: finalTools
        });

    } catch (error) {
        console.error("Recommendation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate recommendation",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined
        });
    }
};

module.exports = {
    getRecommendations
};