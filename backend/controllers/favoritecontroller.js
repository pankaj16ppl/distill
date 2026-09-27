const favoriteModel = require("../models/favoritemodel");

const ALLOWED_TYPES = ["tool"];

const addFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemType, itemId, itemData } = req.body;
        const type = String(itemType || "tool").toLowerCase();

        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).json({ message: "Invalid favorite item type" });
        }
        if (itemId === undefined || itemId === null || String(itemId).trim() === "") {
            return res.status(400).json({ message: "itemId is required" });
        }

        const favorite = await favoriteModel.addFavorite(userId, type, itemId, itemData);
        return res.status(201).json({ message: "Added to favorites", favorite });
    } catch (error) {
        console.error("Add Favorite Error:", error);
        return res.status(500).json({ message: "Server error while adding favorite" });
    }
};

const removeFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { itemType, itemId } = req.params;
        const removed = await favoriteModel.removeFavorite(userId, itemType, itemId);

        if (!removed) {
            return res.status(404).json({ message: "Favorite not found" });
        }
        return res.status(200).json({ message: "Removed from favorites" });
    } catch (error) {
        console.error("Remove Favorite Error:", error);
        return res.status(500).json({ message: "Server error while removing favorite" });
    }
};

const getMyFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const favorites = await favoriteModel.getFavoritesByUser(userId);
        return res.status(200).json({ count: favorites.length, favorites });
    } catch (error) {
        console.error("Get Favorites Error:", error);
        return res.status(500).json({ message: "Server error while fetching favorites" });
    }
};

const getMyFavoriteIds = async (req, res) => {
    try {
        const userId = req.user.id;
        const keys = await favoriteModel.getFavoriteKeysByUser(userId);
        return res.status(200).json({ favorites: keys });
    } catch (error) {
        console.error("Get Favorite Ids Error:", error);
        return res.status(500).json({ message: "Server error while fetching favorite ids" });
    }
};

module.exports = { addFavorite, removeFavorite, getMyFavorites, getMyFavoriteIds };