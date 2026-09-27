// js/rating.js

const RATINGS_API = "http://localhost:5000/api/ratings";

// Get JWT token
function getAuthToken() {
    return localStorage.getItem("distill_token");
}


// ---------------------------------------------------------
// Review validation
// ---------------------------------------------------------
function validateReviewComment(review) {
    if (typeof review !== "string") {
        return {
            valid: false,
            message: "Please write a comment before submitting your review."
        };
    }

    if (review.length === 0) {
        return {
            valid: false,
            message: "Please write a comment before submitting your review."
        };
    }

    // Do not allow leading/trailing spaces
    if (review.trim() !== review) {
        return {
            valid: false,
            message: "Comment cannot start or end with a space."
        };
    }

    // Minimum length
    if (review.length < 10) {
        return {
            valid: false,
            message: "Comment must contain at least 10 characters."
        };
    }

    // Maximum length
    if (review.length > 500) {
        return {
            valid: false,
            message: "Comment cannot exceed 500 characters."
        };
    }

    // First character must be a letter or number
    if (!/^[\p{L}\p{N}]/u.test(review)) {
        return {
            valid: false,
            message: "Comment cannot start with a special character."
        };
    }

    // Last character must be a letter or number
    if (!/[\p{L}\p{N}]$/u.test(review)) {
        return {
            valid: false,
            message: "Comment cannot end with a special character."
        };
    }

    // Reject HTML tags
    if (/<[^>]*>/i.test(review)) {
        return {
            valid: false,
            message: "HTML or code is not allowed in comments."
        };
    }

    return {
        valid: true,
        comment: review
    };
}


// ---------------------------------------------------------
// Submit a rating + review
// ---------------------------------------------------------
async function setRating(toolId, stars, review) {
    try {
        const token = getAuthToken();

        if (!token) {
            throw new Error("Please login first");
        }

        // Comment is mandatory
        const reviewCheck = validateReviewComment(review);

        if (!reviewCheck.valid) {
            throw new Error(reviewCheck.message);
        }

        const response = await fetch(RATINGS_API, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
    toolId: Number(toolId),
    rating: Number(stars),
    comment: comment.trim()
})
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to submit rating"
            );
        }

        return data;

    } catch (error) {
        console.error("Rating Error:", error);
        throw error;
    }
}


// ---------------------------------------------------------
// Get ratings for a tool
// ---------------------------------------------------------
async function getToolRating(toolId) {
    try {
        const response = await fetch(
            `${RATINGS_API}/${Number(toolId)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to get ratings"
            );
        }

        return data;

    } catch (error) {
        console.error("Get Rating Error:", error);
        throw error;
    }
}


// ---------------------------------------------------------
// Get logged-in user's rating
// ---------------------------------------------------------
async function getMyRating(toolId) {
    try {
        const token = getAuthToken();

        if (!token) {
            return null;
        }

        const response = await fetch(
            `${RATINGS_API}/${Number(toolId)}/my-rating`,
            {
                method: "GET",

                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Failed to get your rating"
            );
        }

        return data.rating;

    } catch (error) {
        console.error("Get My Rating Error:", error);
        return null;
    }
}


// ---------------------------------------------------------
// Get average rating only
// ---------------------------------------------------------
async function getAvgRating(toolId) {
    try {
        const data = await getToolRating(toolId);

        return data.averageRating;

    } catch (error) {
        return 0;
    }
}


// ---------------------------------------------------------
// Get total rating count
// ---------------------------------------------------------
async function getRatingCount(toolId) {
    try {
        const data = await getToolRating(toolId);

        return data.totalRatings;

    } catch (error) {
        return 0;
    }
}


// ---------------------------------------------------------
// Prevent paste into review comment boxes
// ---------------------------------------------------------
document.addEventListener("paste", function (event) {
    const target = event.target;

    if (!target.classList.contains("review-comment")) {
        return;
    }

    event.preventDefault();

    alert(
        "Please type your review manually. Pasting reviews is not allowed."
    );
});


// ---------------------------------------------------------
// Prevent drag-and-drop text into review comment boxes
// ---------------------------------------------------------
document.addEventListener("drop", function (event) {
    const target = event.target;

    if (!target.classList.contains("review-comment")) {
        return;
    }

    event.preventDefault();
});