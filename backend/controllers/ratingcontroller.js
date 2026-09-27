const {
    createRating,
    updateRatingComment,
    getRatingsByTool,
    getAverageRating,
    getUserRating
} = require("../models/ratingmodel");

const pool = require("../config/db");
function validateReviewComment(comment) {
    const value = String(comment || "").trim();

    if (!value) {
        return {
            valid: false,
            message: "Please write a review."
        };
    }

    if (value.length < 10) {
        return {
            valid: false,
            message: "Review must contain at least 10 characters."
        };
    }

    if (value.length > 500) {
        return {
            valid: false,
            message: "Review must not exceed 500 characters."
        };
    }

    // URLs are not allowed.
    if (/https?:\/\/|www\./i.test(value)) {
        return {
            valid: false,
            message: "Links are not allowed in reviews."
        };
    }

    // Allow letters, numbers, spaces and basic punctuation only.
    // Emojis and unsupported special symbols are rejected.
    if (/[^\p{L}\p{N}\s.,!?'"()\-:;]/u.test(value)) {
        return {
            valid: false,
            message: "Emojis and unsupported special symbols are not allowed."
        };
    }

    // Same character 5+ times:
    // !!!!!  ?????  aaaaa  .....  11111
    if (/(.)\1{4,}/u.test(value)) {
        return {
            valid: false,
            message: "Repeated characters are not allowed."
        };
    }

    // Repeated punctuation at the beginning.
    if (/^[.,!?;:'"()\-]{5,}/u.test(value)) {
        return {
            valid: false,
            message: "Repeated symbols at the beginning are not allowed."
        };
    }

    // Repeated punctuation at the end.
    if (/[.,!?;:'"()\-]{5,}$/u.test(value)) {
        return {
            valid: false,
            message: "Repeated symbols at the end are not allowed."
        };
    }

    // Same word repeated 3+ times.
    if (/\b([a-zA-Z]{2,20})(?:\s+\1){2,}\b/i.test(value)) {
        return {
            valid: false,
            message: "Repeated words are not allowed."
        };
    }

    return {
        valid: true,
        message: ""
    };
}
// POST /api/ratings
const addRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            toolId,
            rating,
            comment
        } = req.body;

        // Validate tool ID
        const numericToolId = Number(toolId);

        if (
            !Number.isInteger(numericToolId) ||
            numericToolId <= 0
        ) {
            return res.status(400).json({
                message: "Invalid tool ID"
            });
        }

        // Validate rating
        const numericRating = Number(rating);

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(400).json({
                message: "Rating must be an integer between 1 and 5"
            });
        }

        // Validate review
        const reviewValidation =
            validateReviewComment(comment);

        if (!reviewValidation.valid) {
            return res.status(400).json({
                message: reviewValidation.message
            });
        }

        const cleanComment = String(comment).trim();

        // Check whether the AI tool exists
        const toolResult = await pool.query(
            "SELECT id FROM ai_tools WHERE id = $1",
            [numericToolId]
        );

        if (toolResult.rows.length === 0) {
            return res.status(404).json({
                message: "AI tool not found"
            });
        }

        // Check whether the user already rated this tool
        const existingRating = await getUserRating(
            userId,
            numericToolId
        );

        // --------------------------------------------------
        // Existing rating:
        // update the review instead of creating a duplicate
        // --------------------------------------------------
        if (existingRating) {
            const updatedRating =
                await updateRatingComment(
                    userId,
                    numericToolId,
                    cleanComment
                );

            if (!updatedRating) {
                return res.status(404).json({
                    message: "Rating not found"
                });
            }

            const average =
                await getAverageRating(numericToolId);

            return res.status(200).json({
                message: "Review updated successfully",
                rating: updatedRating,
                averageRating:
                    Number(average.average_rating),
                totalRatings:
                    Number(average.total_ratings)
            });
        }

        // --------------------------------------------------
        // New rating
        // --------------------------------------------------
        const newRating = await createRating(
            userId,
            numericToolId,
            numericRating,
            cleanComment
        );

        // Get updated average
        const average =
            await getAverageRating(numericToolId);

        return res.status(201).json({
            message: "Rating submitted successfully",
            rating: newRating,
            averageRating:
                Number(average.average_rating),
            totalRatings:
                Number(average.total_ratings)
        });

    } catch (error) {
        console.error("Add Rating Error:", error);

        // PostgreSQL unique constraint
        if (error.code === "23505") {
            return res.status(409).json({
                message: "You have already rated this tool"
            });
        }

        return res.status(500).json({
            message: "Server error while submitting rating"
        });
    }
};
// GET /api/ratings/:toolId
const getToolRatings = async (req, res) => {
    try {
        const toolId = Number(req.params.toolId);

        if (!Number.isInteger(toolId) || toolId <= 0) {
            return res.status(400).json({
                message: "Invalid tool ID"
            });
        }

        // Check whether tool exists
        const toolResult = await pool.query(
            "SELECT id FROM ai_tools WHERE id = $1",
            [toolId]
        );

        if (toolResult.rows.length === 0) {
            return res.status(404).json({
                message: "AI tool not found"
            });
        }

        const ratings = await getRatingsByTool(toolId);
        const average = await getAverageRating(toolId);

        return res.status(200).json({
            toolId,
            averageRating: Number(average.average_rating),
            totalRatings: Number(average.total_ratings),
            ratings
        });

    } catch (error) {
        console.error("Get Ratings Error:", error);

        return res.status(500).json({
            message: "Server error while fetching ratings"
        });
    }
};


// GET /api/ratings/:toolId/my-rating
const getMyRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const toolId = Number(req.params.toolId);

        if (!Number.isInteger(toolId) || toolId <= 0) {
            return res.status(400).json({
                message: "Invalid tool ID"
            });
        }

        const rating = await getUserRating(
            userId,
            toolId
        );

        return res.status(200).json({
            rating
        });

    } catch (error) {
        console.error("Get My Rating Error:", error);

        return res.status(500).json({
            message: "Server error while fetching your rating"
        });
    }
};


module.exports = {
    addRating,
    getToolRatings,
    getMyRating
};