const express = require("express");
const router = express.Router();

const {
    addFavorite,
    removeFavorite,
    getMyFavorites,
    getMyFavoriteIds
} = require("../controllers/favoritecontroller");

const authMiddleware = require("../middleware/authmiddleware");

router.use(authMiddleware);

router.get("/", getMyFavorites);
router.get("/ids", getMyFavoriteIds);
router.post("/", addFavorite);
router.delete("/:itemType/:itemId", removeFavorite);

module.exports = router;