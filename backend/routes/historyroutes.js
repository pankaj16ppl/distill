const express = require("express");
const router = express.Router();

const {
    saveHistory,
    fetchHistory,
    removeHistory
} = require("../controllers/historyController");

const authMiddleware = require("../middleware/authmiddleware");

// Save history
router.post("/", authMiddleware, saveHistory);

// Get latest 10 history records
router.get("/", authMiddleware, fetchHistory);

// Delete history
router.delete("/:id", authMiddleware, removeHistory);

module.exports = router;