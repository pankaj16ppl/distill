const {
    fetchOfficialPricing,
    extractPlans
} = require("./services/priceFetcher");

const test = async () => {
    try {
        const url = "https://www.cursor.com/pricing";

        console.log("Fetching:", url);

        const data = await fetchOfficialPricing(url);

        console.log("Page fetched successfully.");
        console.log("Characters:", data.text.length);

        const plans = extractPlans(data.text);

        console.log("Detected plans:");
        console.dir(plans, { depth: null });

    } catch (error) {
        console.error("TEST FAILED:", error.message);
    }
};

test();