const MIN_REVIEW_LENGTH = 10;
const MAX_REVIEW_LENGTH = 500;

/**
 * Validate a review comment.
 *
 * Rules:
 * - Required
 * - 10–500 characters
 * - No whitespace at beginning/end
 * - First and last character must be a letter or number
 * - No HTML/script
 */
function validateReview(review) {
    if (typeof review !== "string") {
        return {
            valid: false,
            message: "Review comment is required."
        };
    }

    const comment = review.trim();

    if (!comment) {
        return {
            valid: false,
            message: "Please write a review before submitting."
        };
    }

    if (comment.length < MIN_REVIEW_LENGTH) {
        return {
            valid: false,
            message: `Review must contain at least ${MIN_REVIEW_LENGTH} characters.`
        };
    }

    if (comment.length > MAX_REVIEW_LENGTH) {
        return {
            valid: false,
            message: `Review cannot exceed ${MAX_REVIEW_LENGTH} characters.`
        };
    }

    // Reject whitespace at the beginning/end.
    if (comment !== review) {
        return {
            valid: false,
            message: "Review cannot start or end with spaces."
        };
    }

    // First character must be a letter or number.
    if (!/^[\p{L}\p{N}]/u.test(comment)) {
        return {
            valid: false,
            message: "Review cannot start with a special character."
        };
    }

    // Last character must be a letter or number.
    if (!/[\p{L}\p{N}]$/u.test(comment)) {
        return {
            valid: false,
            message: "Review cannot end with a special character."
        };
    }

    // Prevent HTML/script injection.
    if (/<[^>]*>/i.test(comment)) {
        return {
            valid: false,
            message: "HTML or code is not allowed in reviews."
        };
    }

    return {
        valid: true,
        comment
    };
}

/**
 * Normalize a review for duplicate detection.
 */
function normalizeReview(review) {
    return review
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .trim();
}

module.exports = {
    validateReview,
    normalizeReview
};