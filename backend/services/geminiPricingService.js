const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

/**
 * Get current publicly available pricing/usage information
 * for one application using Gemini + Google Search grounding.
 *
 * No guessing.
 * No currency conversion.
 * No estimation.
 */
const fetchLivePricing = async (tool) => {

    const prompt = `
You are verifying current pricing information for an application.

APPLICATION:
${tool.tool_name}

OFFICIAL WEBSITE:
${tool.official_website || "Not available"}

TASK:
Find the application's current official pricing/subscription information
using Google Search.

Use official sources whenever possible.

Return ONLY valid JSON in exactly this structure:

{
  "plans": [
    {
      "plan_name": "string",
      "pricing_type": "subscription | usage_based | one_time | free | unknown",
      "price": "exact price as stated by the source, or Not available",
      "billing_period": "exact billing period as stated, or Not available",
      "credits": "exact credits allowance, or Not available",
      "tokens": "exact token allowance, or Not available",
      "minutes": "exact minutes allowance, or Not available",
      "hours": "exact hours allowance, or Not available",
      "source_url": "official source URL",
      "verified": true
    }
  ]
}

STRICT RULES:

1. Never guess.
2. Never estimate.
3. Never convert currencies.
4. Never invent a plan.
5. Never convert tokens into credits or credits into tokens.
6. If the source does not clearly state credits, return "Not available".
7. If the source does not clearly state tokens, return "Not available".
8. If the source does not clearly state minutes, return "Not available".
9. If the source does not clearly state hours, return "Not available".
10. Preserve the currency exactly as shown by the source.
11. Preserve the billing period exactly as shown by the source.
12. Only include plans that can be supported by a web source.
13. Prefer the application's official pricing page.
14. If an official pricing page cannot be found, use another authoritative source and make sure source_url identifies it.
15. Current information is required, not historical pricing.
16. If no reliable pricing information can be verified, return:
{
  "plans": []
}

Do not include explanations outside the JSON.
`;

    const interaction = await ai.interactions.create({
        model: "gemini-3.5-flash",
        input: prompt,
        tools: [
            {
                type: "google_search"
            }
        ]
    });

    const text = (interaction.output_text || "")
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    if (!text) {
        return [];
    }

    let parsed;

    try {
        parsed = JSON.parse(text);
    } catch (error) {
        console.error(
            `Gemini pricing JSON parse failed for ${tool.tool_name}:`,
            error.message
        );

        return [];
    }

    if (!Array.isArray(parsed.plans)) {
        return [];
    }

    return parsed.plans
        .filter(plan =>
            plan &&
            typeof plan.plan_name === "string"
        )
        .map(plan => ({
            plan_name: plan.plan_name.trim(),

            pricing_type:
                typeof plan.pricing_type === "string"
                    ? plan.pricing_type.trim()
                    : "unknown",

            price:
                typeof plan.price === "string"
                    ? plan.price.trim()
                    : "Not available",

            billing_period:
                typeof plan.billing_period === "string"
                    ? plan.billing_period.trim()
                    : "Not available",

            credits:
                typeof plan.credits === "string"
                    ? plan.credits.trim()
                    : "Not available",

            tokens:
                typeof plan.tokens === "string"
                    ? plan.tokens.trim()
                    : "Not available",

            minutes:
                typeof plan.minutes === "string"
                    ? plan.minutes.trim()
                    : "Not available",

            hours:
                typeof plan.hours === "string"
                    ? plan.hours.trim()
                    : "Not available",

            source_url:
                typeof plan.source_url === "string"
                    ? plan.source_url.trim()
                    : tool.official_website || "Not available",

            verified: true
        }));
};

module.exports = {
    fetchLivePricing
};
// ============================================================
// BATCH LIVE PRICING VERIFICATION
// One Gemini + Google Search request for multiple tools.
// ============================================================

const fetchLivePricingBatch = async (tools) => {

    if (!Array.isArray(tools) || tools.length === 0) {
        return [];
    }

    const toolData = tools.map(tool => ({
        id: tool.id,
        tool_name: tool.tool_name,
        official_website: tool.official_website || null
    }));

    const prompt = `
You are verifying CURRENT pricing and usage information
for multiple applications.

APPLICATIONS:

${JSON.stringify(toolData, null, 2)}

Use Google Search to find current public information.

Prefer official pricing pages and official documentation.

Return ONLY valid JSON.

Required format:

{
  "tools": [
    {
      "tool_id": 123,
      "plans": [
        {
          "plan_name": "string",
          "pricing_type": "subscription | usage_based | one_time | free | unknown",
          "price": "exactly as stated or Not available",
          "billing_period": "exactly as stated or Not available",
          "credits": "exactly as stated or Not available",
          "tokens": "exactly as stated or Not available",
          "minutes": "exactly as stated or Not available",
          "hours": "exactly as stated or Not available",
          "source_url": "source URL"
        }
      ]
    }
  ]
}

STRICT RULES:

1. Never guess.
2. Never estimate.
3. Never convert currencies.
4. Never convert tokens into credits.
5. Never convert credits into tokens.
6. Never invent limits.
7. Preserve the exact currency shown by the source.
8. Preserve the exact billing period shown by the source.
9. Only include a plan when the information can be supported by a web source.
10. If price is not available, use "Not available".
11. If credits are not available, use "Not available".
12. If tokens are not available, use "Not available".
13. If minutes are not available, use "Not available".
14. If hours are not available, use "Not available".
15. If no reliable current pricing can be verified for a tool, return:
    "plans": []
16. Do not use historical pricing.
17. Do not provide explanations outside the JSON.
18. Keep each plan associated with the correct tool_id.
`;

    const interaction =
        await ai.interactions.create({
            model: "gemini-3.5-flash",
            input: prompt,
            tools: [
                {
                    type: "google_search"
                }
            ]
        });

    const text =
        (interaction.output_text || "")
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

    if (!text) {
        return [];
    }

    let parsed;

    try {

        parsed = JSON.parse(text);

    } catch (error) {

        console.error(
            "Batch Gemini pricing JSON parse failed:",
            error.message
        );

        return [];
    }

    if (!Array.isArray(parsed.tools)) {
        return [];
    }

    return parsed.tools
        .filter(item =>
            item &&
            Number.isInteger(Number(item.tool_id))
        )
        .map(item => ({
            tool_id: Number(item.tool_id),

            plans:
                Array.isArray(item.plans)
                    ? item.plans
                        .filter(
                            plan =>
                                plan &&
                                typeof plan.plan_name === "string"
                        )
                        .map(plan => ({
                            plan_name:
                                plan.plan_name.trim(),

                            pricing_type:
                                typeof plan.pricing_type === "string"
                                    ? plan.pricing_type.trim()
                                    : "unknown",

                            price:
                                typeof plan.price === "string"
                                    ? plan.price.trim()
                                    : "Not available",

                            billing_period:
                                typeof plan.billing_period === "string"
                                    ? plan.billing_period.trim()
                                    : "Not available",

                            credits:
                                typeof plan.credits === "string"
                                    ? plan.credits.trim()
                                    : "Not available",

                            tokens:
                                typeof plan.tokens === "string"
                                    ? plan.tokens.trim()
                                    : "Not available",

                            minutes:
                                typeof plan.minutes === "string"
                                    ? plan.minutes.trim()
                                    : "Not available",

                            hours:
                                typeof plan.hours === "string"
                                    ? plan.hours.trim()
                                    : "Not available",

                            source_url:
                                typeof plan.source_url === "string"
                                    ? plan.source_url.trim()
                                    : "Not available"
                        }))
                        
                        
                        : []
        }));

};


module.exports = {
    fetchLivePricing,
    fetchLivePricingBatch
};