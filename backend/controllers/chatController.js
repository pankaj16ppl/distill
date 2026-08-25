const chatModel = require("../models/chatmodel");

const createChat = async (req, res) => {
    try {
        const { title } = req.body;

        const userId =
            req.user?.id ||
            req.user?.user_id ||
            req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        const chat = await chatModel.createChat(
            userId,
            title || "New Chat"
        );

        res.status(201).json({
            success: true,
            chat_id: chat.id,
            chat
        });

    } catch (error) {
        console.error("Create Chat Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create chat"
        });
    }
};

const addMessage = async (req, res) => {
    try {
        const { chat_id, role, content } = req.body;

        if (!chat_id || !role || !content) {
            return res.status(400).json({
                success: false,
                message: "chat_id, role and content are required"
            });
        }

        const message = await chatModel.createMessage(
            chat_id,
            role,
            content
        );

        res.status(201).json({
            success: true,
            message
        });

    } catch (error) {
        console.error("Add Message Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save message"
        });
    }
};

const getMessages = async (req, res) => {
    try {
        const messages = await chatModel.getChatMessages(
            req.params.chatId
        );

        res.status(200).json({
            success: true,
            messages
        });

    } catch (error) {
        console.error("Get Messages Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get messages"
        });
    }
};

const sendChatMessage = async (req, res) => {
    try {
        const { chat_id, profession, message } = req.body;

        if (!chat_id || !profession || !message) {
            return res.status(400).json({
                success: false,
                message: "chat_id, profession and message are required"
            });
        }

        // Save user's message
        await chatModel.createMessage(
            chat_id,
            "user",
            message
        );

        // Call Phase 8 Recommendation API
        const response = await fetch(
    "http://localhost:5000/api/recommendation",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    profession,
                    message
                })
            }
        );

        if (!response.ok) {
            throw new Error("Recommendation API failed");
        }

        const data = await response.json();

                 // Save Gemini recommendations
await chatModel.createMessage(
    chat_id,
    "assistant",
    JSON.stringify(data.recommendations || [])
);

        res.status(200).json({
    success: true,
    chat_id,
    recommendations: data.recommendations || [],
    tools: data.tools || []
});

    } catch (error) {
        console.error("Chat Message Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to process chat message"
        });
    }
};
module.exports = {
    createChat,
    addMessage,
    getMessages,
    sendChatMessage
};