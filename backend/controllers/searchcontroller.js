const searchModel = require("../models/searchmodel");
const ai = require("../config/gemini");
const toolModel = require("../models/toolmodel");
    const {
    fetchLivePricingBatch
} = require("../services/geminiPricingService");

const searchTools = async (req, res) => {

    try {

        const { q } = req.query;

        if (!q || q.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Search query is required"
            });
        }

        const originalQuery = q.trim();

        let searchTerms = [];
        let searchCategory = null;
        let searchSubcategory = null;


        // ============================================================
        // QUERY UNDERSTANDING
        // ============================================================

        try {

            const prompt = `
You are the query-understanding layer for Distill.

Your job is ONLY to classify the user's search query into the
existing categories and subcategories used by the database.

Do NOT select tools.
Do NOT recommend applications.
Do NOT invent categories.

Existing categories:

AI & Automation
AI Chatbots & Assistants
Coding & Developer Tools
Creative
Developer Tools
Education - Accessibility
Education - Engagement
Education - Grading & Assessment
Education - Lesson Planning
Education - STEM
Health & Fitness
Image & Design
Other Niche Tools
Presentations & Diagrams
Productivity & Automation
Research
Research & Knowledge
Video & Audio

Examples of existing subcategories:

Food & Cooking
Travel
Home & DIY
Fashion & Beauty
Pets
Parenting
Relationships
Spirituality
Automotive
Mental Health
Nutrition
Workout Plans
AI Search
Second Brain
Source-grounded
Meeting Notetaker
Meeting Transcription
Notes & Docs
Workflow Automation
AI Presentations
Smart Slides
Text-to-Visual
Image Generation
Design Suite
Free Alternative
AI IDE
Cloud IDE
Code Completion
Privacy-focused
and other subcategories already stored in the database.

USER QUERY:
${originalQuery}

Determine:

1. category
2. subcategory
3. keywords

Rules:
- Use an existing category whenever possible.
- Use an existing subcategory whenever possible.
- For a query like "cooking" use:
  category = "Other Niche Tools"
  subcategory = "Food & Cooking"
- For a query like "recipe maker" also prefer Food & Cooking.
- Keywords should contain the important concepts from the query.
- Return only JSON.
- Do not explain your answer.

Return exactly:

{
  "category": "existing category",
  "subcategory": "existing subcategory or null",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
`;

            const response = await ai.interactions.create({
                model: "gemini-3.5-flash",
                input: prompt
            });

            const text = (response.output_text || "")
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            const parsed = JSON.parse(text);

            searchCategory =
                typeof parsed.category === "string"
                    ? parsed.category.trim()
                    : null;

            searchSubcategory =
                typeof parsed.subcategory === "string"
                    ? parsed.subcategory.trim()
                    : null;

            searchTerms =
                Array.isArray(parsed.keywords)
                    ? parsed.keywords
                        .filter(
                            term =>
                                typeof term === "string"
                        )
                        .map(
                            term =>
                                term.trim().toLowerCase()
                        )
                        .filter(Boolean)
                        .slice(0, 6)
                    : [];

        } catch (error) {

            console.error(
                "Search intent understanding failed:",
                error.message
            );

            searchCategory = null;
            searchSubcategory = null;

            searchTerms =
                originalQuery
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 6);
        }


        // ============================================================
        // VALIDATE SEARCH TERMS
        // ============================================================

        if (!searchTerms.length) {

            return res.status(500).json({
                success: false,
                message: "Could not understand search query"
            });

        }


        // ============================================================
        // SEARCH DEBUG
        // ============================================================

        console.log(
            "Original query:",
            originalQuery
        );

        console.log(
            "Search category:",
            searchCategory
        );

        console.log(
            "Search subcategory:",
            searchSubcategory
        );

        console.log(
            "Search keywords:",
            searchTerms
        );


        // ============================================================
        // DATABASE SEARCH
        // ============================================================

        const tools =
            await searchModel.searchTools(
                searchTerms,
                searchCategory,
                searchSubcategory
            );


        console.log(
            "Matched tools:",
            tools.map(
                tool => tool.tool_name
            )
        );


       // ============================================================
// LIVE PLAN CACHE + BATCH LIVE VERIFICATION
//
// Cache lifetime: 48 hours
//
// Fresh data:
//      Use database.
//
// Missing/expired:
//      Collect tool and verify all stale tools
//      with ONE Gemini + Google Search request.
// ============================================================

const staleTools = [];


// ============================================================
// 1. CHECK 48-HOUR CACHE
// ============================================================

for (const tool of tools) {

    try {

        const cachedPlans =
            await toolModel.getFreshToolPlans(
                tool.id,
                48
            );

        if (
            Array.isArray(cachedPlans) &&
            cachedPlans.length > 0
        ) {

            tool.live_plans = cachedPlans;
            tool.pricing_status = "verified";

            console.log(
                `Using cached live data for ${tool.tool_name}:`,
                tool.live_plans
            );

            continue;
        }

        console.log(
            `Live data missing/expired for ${tool.tool_name}`
        );

        tool.live_plans = [];
        tool.pricing_status = "not_available";

        if (tool.official_website) {

            staleTools.push(tool);

        } else {

            console.log(
                `No official website for ${tool.tool_name}`
            );

        }

    } catch (error) {

        console.error(
            `Cache check failed for ${tool.tool_name}:`,
            error.message
        );

        tool.live_plans = [];
        tool.pricing_status = "not_available";

        if (tool.official_website) {
            staleTools.push(tool);
        }
    }
}


// ============================================================
// 2. BATCH GEMINI + GOOGLE SEARCH
// ============================================================

if (staleTools.length > 0) {

    console.log(
        `Starting batch live pricing verification for ${staleTools.length} tools:`,
        staleTools.map(tool => tool.tool_name)
    );

    try {

        const batchResults =
            await fetchLivePricingBatch(staleTools);


        // --------------------------------------------------------
        // Create lookup:
        //
        // tool_id → plans
        // --------------------------------------------------------

        const resultMap = new Map(
            batchResults.map(result => [
                Number(result.tool_id),
                Array.isArray(result.plans)
                    ? result.plans
                    : []
            ])
        );


        // --------------------------------------------------------
        // 3. SAVE RESULT FOR EACH TOOL
        // --------------------------------------------------------

        for (const tool of staleTools) {

            const plans =
                resultMap.get(Number(tool.id)) || [];


            if (
                Array.isArray(plans) &&
                plans.length > 0
            ) {

                await toolModel.replaceToolPlans({
                    tool_id: tool.id,
                    plans,
                    source_url:
                        plans[0].source_url ||
                        tool.official_website ||
                        null,
                    last_verified_at: new Date()
                });


                tool.live_plans =
                    await toolModel.getFreshToolPlans(
                        tool.id,
                        48
                    );


                console.log(
                    `Saved fresh Gemini data for ${tool.tool_name}:`,
                    tool.live_plans
                );

            } else {

                tool.live_plans = [];

                console.log(
                    `No current verified pricing found for ${tool.tool_name}`
                );
            }
        }

    } catch (error) {

        console.error(
            "Batch Gemini pricing failed:",
            error.message
        );


        // --------------------------------------------------------
        // Never invent pricing.
        // --------------------------------------------------------

        for (const tool of staleTools) {

            tool.live_plans = [];

        }
    }
}


// ============================================================
// RESPONSE
// ============================================================

const displayQuery =
    searchTerms[0] || originalQuery;


return res.json({

    success: true,

    count: tools.length,

    originalQuery,

    displayQuery,

    data: tools

});


} catch (error) {

    console.error(
        "Search Error:",
        error
    );

    return res.status(500).json({

        success: false,

        message: "Failed to search AI tools"

    });

}

};


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    searchTools
};