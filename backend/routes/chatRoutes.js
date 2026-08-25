const express = require("express");
const authMiddleware = require("../middleware/authmiddleware");

const router = express.Router();

const {
    createChat,
    addMessage,
    getMessages,
    sendChatMessage
} = require("../controllers/chatController");

router.post("/", authMiddleware, createChat);

router.post("/message", authMiddleware, sendChatMessage);

router.post("/messages", authMiddleware, addMessage);

router.get("/:chatId/messages", authMiddleware, getMessages);

module.exports = router;