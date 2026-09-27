// js/rating.js

const RATINGS_API = "http://localhost:5000/api/ratings";

// Get JWT token
function getAuthToken() {
    return localStorage.getItem("distill_token");
}


// Submit a rating
async function setRating(toolId, stars) {
    try {
        const token = getAuthToken();

        if (!token) {
            throw new Error("Please login first");
        }

        const response = await fetch(RATINGS_API, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },

            body: JSON.stringify({
                toolId: Number(toolId),
                rating: Number(stars)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to submit rating");
        }

        return data;

    } catch (error) {
        console.error("Rating Error:", error);
        throw error;
    }
}


// Get ratings for a tool
async function getToolRating(toolId) {
    try {
        const response = await fetch(
            `${RATINGS_API}/${Number(toolId)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to get ratings");
        }

        return data;

    } catch (error) {
        console.error("Get Rating Error:", error);
        throw error;
    }
}


// Get logged-in user's rating
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
            throw new Error(data.message || "Failed to get your rating");
        }

        return data.rating;

    } catch (error) {
        console.error("Get My Rating Error:", error);
        return null;
    }
}


// Get average rating only
async function getAvgRating(toolId) {
    try {
        const data = await getToolRating(toolId);

        return data.averageRating;

    } catch (error) {
        return 0;
    }
}


// Get total rating count
async function getRatingCount(toolId) {
    try {
        const data = await getToolRating(toolId);

        return data.totalRatings;

    } catch (error) {
        return 0;
    }
}