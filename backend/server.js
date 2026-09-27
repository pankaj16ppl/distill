const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const toolRoutes = require("./routes/toolroutes");
const searchRoutes = require("./routes/searchroutes");
const recommendationRoutes = require("./routes/recommendation");
const chatRoutes = require("./routes/chatRoutes");
const authRoutes = require("./routes/authroutes");
const historyRoutes = require("./routes/historyroutes");
const trendingRoutes = require("./routes/trendingRoutes");
const ratingRoutes = require("./routes/ratingroutes");

const favoriteRoutes = require("./routes/favoriteroutes");


app.use(cors());
app.use(express.json());
app.use("/api/tools", toolRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/chats", chatRoutes);
console.log("authRoutes type:", typeof authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/trending", trendingRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/favorites", favoriteRoutes);

// Connect to Neon PostgreSQL
require("./config/db");

// Make sure the (new, additive-only) favorites table exists.
// Every other table is managed outside this repo, so this is the only
// table the app creates for itself — safe to run on every boot.
require("./models/favoritemodel")
    .ensureFavoritesTable()
    .then(() => console.log("Favorites table ready ✅"))
    .catch((err) =>
        console.error("Failed to ensure favorites table:", err.message)
    );

app.get("/", (req, res) => {
    res.send("Distill Backend API is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});