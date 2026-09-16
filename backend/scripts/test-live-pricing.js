const ai = require("../config/gemini");

const MODEL =
    process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function main() {
    const tool = {
        id: 1,
        tool_name: "ChatGPT",
        official_website: "https://chatgpt.com"
    };

    const prompt = `
You are a live pricing verification engine.

Current date:
${new Date().toISOString().slice(0, 10)}

Application from Distill database:
${JSON.stringify(tool, null, 2)}

Use Google Search to find CURRENT information for this application.

Search for the application's official:
- pricing page
- plans page
- subscription page
- official help page when needed

Return ONLY information explicitly supported by current web sources.

For every verified subscription plan return:
- plan_name
- price
- currency
- billing_period
- credits
- tokens
- minutes
- hours
- source_url

Rules:
- Never guess.
- Never estimate.
- Never use old knowledge when a current web source is available.
- Do not calculate or convert prices.
- Do not invent usage limits.
- If a value cannot be verified, return null.
- Keep credits, tokens, minutes and hours separate.
- Do not treat API pricing as a consumer subscription plan unless the official source explicitly presents it as one.
- Prefer official sources.
- source_url must support the returned plan information.

Return JSON only in this format:

{
  "tool_id": 1,
  "tool_name": "ChatGPT",
  "verified": true,
  "plans": [
    {
      "plan_name": "...",
      "price": null,
      "currency": null,
      "billing_period": null,
      "credits": null,
      "tokens": null,
      "minutes": null,
      "hours": null,
      "source_url": null
    }
  ]
}
`;

    const interaction =
        await ai.interactions.create({
            model: MODEL,

            input: prompt,

            tools: [
                {
                    type: "google_search"
                }
            ],

            response_format: {
                type: "text",
                mime_type: "application/json",
                schema: {
                    type: "object",

                    properties: {
                        tool_id: {
                            type: "integer"
                        },

                        tool_name: {
                            type: "string"
                        },

                        verified: {
                            type: "boolean"
                        },

                        plans: {
                            type: "array",

                            items: {
                                type: "object",

                                properties: {
                                    plan_name: {
                                        type: "string"
                                    },

                                    price: {
                                        type: ["number", "null"]
                                    },

                                    currency: {
                                        type: ["string", "null"]
                                    },

                                    billing_period: {
                                        type: ["string", "null"]
                                    },

                                    credits: {
                                        type: ["string", "null"]
                                    },

                                    tokens: {
                                        type: ["string", "null"]
                                    },

                                    minutes: {
                                        type: ["string", "null"]
                                    },

                                    hours: {
                                        type: ["string", "null"]
                                    },

                                    source_url: {
                                        type: ["string", "null"]
                                    }
                                },

                                required: [
                                    "plan_name",
                                    "price",
                                    "currency",
                                    "billing_period",
                                    "credits",
                                    "tokens",
                                    "minutes",
                                    "hours",
                                    "source_url"
                                ]
                            }
                        }
                    },

                    required: [
                        "tool_id",
                        "tool_name",
                        "verified",
                        "plans"
                    ]
                }
            }
        });

    console.log("\n========== LIVE PRICING TEST ==========\n");

    console.log(
        interaction.output_text || ""
    );

    console.log(
        "\n========================================\n"
    );
}

main().catch(error => {
    console.error(
        "LIVE PRICING TEST FAILED:"
    );

    console.error(error);
    process.exit(1);
});