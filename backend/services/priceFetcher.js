const { chromium } = require("playwright");
const cheerio = require("cheerio");

/*
|--------------------------------------------------------------------------
| Find a pricing URL from an official website
|--------------------------------------------------------------------------
*/

const findPricingUrl = async (page, officialUrl) => {
    await page.goto(officialUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
    });

    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // If the supplied URL already looks like a pricing page, use it.
    if (
        /pricing|plans|subscription|billing/i.test(
            new URL(currentUrl).pathname
        )
    ) {
        return currentUrl;
    }

    const links = await page.locator("a").evaluateAll((anchors) =>
        anchors.map((a) => ({
            text: (a.innerText || "").trim(),
            href: a.href
        }))
    );

    const candidates = links
        .filter((link) => link.href)
        .filter((link) => {
            const text = link.text.toLowerCase();
            const href = link.href.toLowerCase();

            return (
                text.includes("pricing") ||
                text.includes("plans") ||
                text.includes("subscription") ||
                text.includes("billing") ||
                href.includes("/pricing") ||
                href.includes("/plans") ||
                href.includes("/subscription") ||
                href.includes("/billing")
            );
        });

    if (candidates.length > 0) {
        return candidates[0].href;
    }

    return currentUrl;
};


/*
|--------------------------------------------------------------------------
| Fetch official pricing page
|--------------------------------------------------------------------------
*/

const fetchOfficialPricing = async (officialUrl) => {
    if (!officialUrl) {
        throw new Error("Official website is missing");
    }

    const browser = await chromium.launch({
        headless: true
    });

    try {
        const page = await browser.newPage();

        page.setDefaultTimeout(30000);

        const pricingUrl = await findPricingUrl(
            page,
            officialUrl
        );

        if (pricingUrl !== page.url()) {
            await page.goto(pricingUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000
            });

            await page.waitForTimeout(3000);
        }

        const text = await page.locator("body").innerText();

        if (!text || text.trim().length < 50) {
            throw new Error("No usable pricing page content found");
        }

        const html = await page.content();

        return {
            url: page.url(),
            html,
            text: text.replace(/\s+/g, " ").trim()
        };

    } finally {
        await browser.close();
    }
};

const pricesWithin = (container, priceRegex) => {
    let count = 0;

    container.find("*").each((_, element) => {
        const text = String($(element).text() || "")
            .replace(/\s+/g, " ")
            .trim();

        priceRegex.lastIndex = 0;

        const matches = text.match(priceRegex);

        if (matches) {
            count += matches.length;
        }

        priceRegex.lastIndex = 0;
    });

    return count;
};
/*
|--------------------------------------------------------------------------
| Universal pricing extraction
|--------------------------------------------------------------------------
*/
const extractPlans = (html) => {
    if (!html) return [];

    const $ = cheerio.load(html);

    // Remove content that can create false pricing matches.
    $("script, style, noscript, template, svg").remove();

    const results = [];

    const priceRegex =
        /(?:₹|INR|\$|USD|€|EUR|£|GBP)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:USD|INR|EUR|GBP|€|£)/gi;

    const billingRegex =
        /\b(month|monthly|year|yearly|annual|annually|week|weekly|user|member|billed|mo|yr)\b/i;

    const invalidNameRegex =
        /^(pricing|plans|features|faq|resources|contact|login|sign in|sign up|compare|compare all plans|learn more|get started|view plans|buy now|subscribe|recommended|popular)$/i;

    const technicalRegex =
        /\b(api|token|tokens|input|output|model pricing|usage pricing|credit pack|add[- ]?on|code execution|web search|storage|minutes|hours|requests)\b/i;

    const normalize = (value) =>
        String(value || "")
            .replace(/\s+/g, " ")
            .trim();

    const isValidPlanName = (name) => {
        name = normalize(name);

        if (!name) return false;
        if (name.length < 2 || name.length > 50) return false;
        if (name.split(/\s+/).length > 6) return false;

        if (invalidNameRegex.test(name)) return false;
        if (technicalRegex.test(name)) return false;

        if (/^[\d.,]+[KMB]?$/i.test(name)) return false;

        if (
            /^(USD|INR|EUR|GBP|₹|\$|€|£)$/i.test(name)
        ) {
            return false;
        }

        if (
            /^\/?\s*(mo|month|monthly|yr|year|yearly|hr|hour|week|weekly|user|member)$/i
                .test(name)
        ) {
            return false;
        }

        if (
            /^(?:[$€£₹]\s*[\d,.]+|[\d,.]+\s*(USD|INR|EUR|GBP))$/i
                .test(name)
        ) {
            return false;
        }

        return true;
    };

    /*
     * Find every element containing a price.
     */
    const priceElements = [];

    $("body *").each((_, element) => {

        const text = normalize($(element).text());

        if (!text || text.length > 500) return;

        priceRegex.lastIndex = 0;

        if (!priceRegex.test(text)) {
            priceRegex.lastIndex = 0;
            return;
        }

        priceRegex.lastIndex = 0;

        const prices = text.match(priceRegex);

        if (!prices || prices.length === 0) return;

        priceElements.push({
            element,
            text,
            prices
        });
    });

    /*
     * For every price, walk upward through the DOM.
     *
     * Instead of requiring the heading and price to be
     * in the exact same element, search the surrounding
     * pricing region.
     */
    for (const priceItem of priceElements) {

        const priceElement = $(priceItem.element);

        let container = priceElement;

        let candidates = [];

        for (let level = 0; level < 7 && container.length; level++) {

            const containerText = normalize(container.text());

            if (
                containerText.length >= 10 &&
                containerText.length <= 900
            ) {

                const headings = container
                    .find("h1,h2,h3,h4,h5,h6,[role='heading']")
                    .map((_, heading) => ({
                        text: normalize($(heading).text()),
                        element: heading
                    }))
                    .get()
                    .filter((heading) =>
                        isValidPlanName(heading.text)
                    );

                /*
                 * Some pricing pages use strong/bold text
                 * instead of semantic headings.
                 */
                if (headings.length === 0) {

                    const strongs = container
                        .find("strong,b")
                        .map((_, heading) => ({
                            text: normalize($(heading).text()),
                            element: heading
                        }))
                        .get()
                        .filter((heading) =>
                            isValidPlanName(heading.text)
                        );

                    headings.push(...strongs);
                }

                const classText = [
                    container.attr("class"),
                    container.attr("id"),
                    container.attr("data-testid"),
                    container.attr("aria-label")
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const semanticPricing =
                    /\b(plan|pricing|price|tier|subscription|package|membership)\b/
                        .test(classText);

                const hasBilling =
                    billingRegex.test(containerText);

                /*
                 * Only consider containers that have
                 * enough evidence of being a pricing region.
                 */
                let containerScore = 0;

                if (semanticPricing) {
                    containerScore += 4;
                }

                if (hasBilling) {
                    containerScore += 3;
                }

                if (headings.length > 0) {
                    containerScore += 2;
                }

                if (pricesWithin(container, priceRegex) <= 4) {
                    containerScore += 1;
                }

                if (containerScore >= 4 && headings.length > 0) {

                    for (const heading of headings) {

                        let score = containerScore;

                        /*
                         * Stronger heading signals.
                         */
                        const headingTag =
                            String(heading.element.name || "")
                                .toLowerCase();

                        if (/^h[1-6]$/.test(headingTag)) {
                            score += 5;
                        }

                        if (
                            $(heading.element).attr("role") === "heading"
                        ) {
                            score += 4;
                        }

                        if (heading.text.split(/\s+/).length <= 3) {
                            score += 2;
                        }

                        /*
                         * Generic plan vocabulary.
                         * These are not app-specific.
                         */
                        if (
                            /^(free|basic|starter|standard|plus|pro|premium|business|team|enterprise|creator|individual|personal|professional|ultimate|max|unlimited)$/i
                                .test(heading.text)
                        ) {
                            score += 4;
                        }

                        candidates.push({
                            plan_name: heading.text,
                            price: priceItem.prices[0],
                            score
                        });
                    }
                }
            }

            container = container.parent();
        }

        /*
         * Pick the strongest heading associated with
         * this price.
         */
        if (candidates.length > 0) {

            candidates.sort((a, b) => b.score - a.score);

            const best = candidates[0];

            if (best.score >= 7) {
                results.push(best);
            }
        }
    }

    /*
     * Remove duplicate plans.
     */
    const unique = new Map();

    for (const item of results) {

        const key = item.plan_name.toLowerCase();

        const existing = unique.get(key);

        if (!existing || item.score > existing.score) {
            unique.set(key, item);
        }
    }

    return [...unique.values()]
        .sort((a, b) => b.score - a.score)
        .map(({ score, ...plan }) => plan);
};
const validatePlans = (plans) => {
    if (!Array.isArray(plans)) {
        return [];
    }

    return plans.filter((plan) => {
        if (!plan || !plan.plan_name || !plan.price) {
            return false;
        }

        const name = plan.plan_name
            .replace(/\s+/g, " ")
            .trim();

        const price = plan.price
            .replace(/\s+/g, " ")
            .trim();

        const lowerName = name.toLowerCase();
        const lowerPrice = price.toLowerCase();

        // Plan names should be short and human-readable.
        if (name.length < 2 || name.length > 50) {
            return false;
        }

        // Reject obvious page/navigation/content headings.
        const invalidNamePatterns = [
            /^pricing$/i,
            /^plans$/i,
            /^features$/i,
            /^faq$/i,
            /^resources$/i,
            /^contact$/i,
            /^login$/i,
            /^sign\s*(in|up)$/i,
            /^cookie/i,
            /^privacy/i,
            /^security/i,
            /^terms/i,
            /^documentation/i,
            /^web search$/i,
            /^code execution$/i,
            /^managed agents$/i,
            /^api/i,
            /how much does/i,
            /what is the/i,
            /can i /i,
            /do you /i,
            /^(latest|new)\s+models?/i
        ];

        if (
            invalidNamePatterns.some(
                (pattern) => pattern.test(name)
            )
        ) {
            return false;
        }

        // Reject prices that are clearly usage/API/add-on pricing.
        const invalidPricePatterns = [
            /per\s*token/i,
            /\/\s*token/i,
            /per\s*request/i,
            /\/\s*request/i,
            /per\s*image/i,
            /\/\s*image/i,
            /per\s*credit/i,
            /\/\s*credit/i,
            /per\s*minute/i,
            /\/\s*minute/i
        ];

        if (
            invalidPricePatterns.some(
                (pattern) => pattern.test(lowerPrice)
            )
        ) {
            return false;
        }

        // Must contain a currency and a numeric price.
        const currencyPriceRegex =
            /(?:₹|INR|\$|USD|€|EUR|£|GBP)\s*[\d,]+(?:\.\d+)?/i;

        if (!currencyPriceRegex.test(price)) {
            return false;
        }

        // Reject obvious tiny usage prices.
        const numericMatch = price.match(
            /[\d,]+(?:\.\d+)?/
        );

        if (!numericMatch) {
            return false;
        }

        const numericPrice = Number(
            numericMatch[0].replace(/,/g, "")
        );

        if (!Number.isFinite(numericPrice)) {
            return false;
        }

        /*
         * Subscription plans normally have a meaningful plan name.
         * Reject names that are basically sentences or technical labels.
         */
        const wordCount = name.split(/\s+/).length;

if (wordCount > 7) {
    return false;
}

// Reject numeric/statistical values accidentally detected as plan names.
if (/^[\d.,]+[KMB]?$/i.test(name)) {
    return false;
}

// Reject currency/unit fragments.
if (
    /^(USD|INR|EUR|GBP|₹|\$|€|£)$/i.test(name) ||
    /^\/?\s*(mo|month|monthly|yr|year|yearly|hr|hour|week|user|member)$/i.test(name)
) {
    return false;
}

// Reject names containing only a price.
if (
    /^(?:[$€£₹]\s*[\d,.]+|[\d,.]+\s*(?:USD|INR|EUR|GBP))$/i.test(name)
) {
    return false;
}

// Reject obvious UI/action text.
if (
    /^(compare|compare all plans|learn more|get started|buy now|subscribe|view plans|see plans)$/i.test(
        name
    )
) {
    return false;
}

return true;
    });
};

module.exports = {
    fetchOfficialPricing,
    extractPlans,
    validatePlans
};