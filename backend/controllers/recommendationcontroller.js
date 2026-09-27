const pool = require("../config/db");
const ai = require("../config/gemini");

const getRecommendations = async (req, res) => {
    try {
        const { profession, task, message } = req.body;

        // New Chat can send "message"; old API can still send "task"
        const userTask = message || task;

        if (!profession || !userTask) {
            return res.status(400).json({
                message: "Profession and task are required"
            });
        }

        // Get AI tools from database
        const result = await pool.query(
            "SELECT * FROM ai_tools"
        );

        const tools = result.rows;

        // Prepare tool information for Gemini
        const toolData = tools.map((tool) => ({
            name: tool.tool_name,
            category: tool.category,
            description: tool.description,
            target_users: tool.target_users
        }));

        const prompt = `
You are an AI tool recommendation assistant for Distill.

User profession:
${profession}

User task:
${userTask}

Available AI tools from the Distill database:
${JSON.stringify(toolData, null, 2)}

Based ONLY on the available tools above, recommend the most suitable AI tools for this user.

For each recommended tool:
1. Give the tool name.
2. Explain why it is suitable.
3. Explain how it can help with the user's task.

Keep the recommendation clear and useful.
`;

        // Send database tools and user requirement to Gemini
        const interaction = await ai.interactions.create({
            model: "gemini-3.5-flash",
            input: prompt
        });

        console.log("NEW RECOMMENDATION CONTROLLER RUNNING");

        res.status(200).json({
            profession,
            task: userTask,
            recommendation: interaction.output_text
        });

    } catch (error) {
        console.error("Recommendation error:", error.message);

        res.status(500).json({
            message: "Failed to generate recommendation"
        });
    }
};

module.exports = {
    getRecommendations
};