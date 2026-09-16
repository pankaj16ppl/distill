const axios = require("axios");
const pool = require("../config/db");
const PRODUCT_HUNT_API =
  "https://api.producthunt.com/v2/api/graphql";

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isLikelyAIProduct(product) {
  const text = `${product.name || ""} ${product.tagline || ""}`.toLowerCase();

  const aiKeywords = [
    "ai",
    "artificial intelligence",
    "llm",
    "gpt",
    "machine learning",
    "automation",
    "agent",
    "agents",
    "copilot",
    "assistant",
    "generative",
    "neural",
    "model",
    "coding",
    "developer",
    "cursor",
    "language model"
  ];

  return aiKeywords.some((keyword) => text.includes(keyword));
}

async function getLatestProducts(limit = 20) {
  const query = `
    query {
      posts(first: ${limit}) {
        nodes {
          id
          name
          tagline
          url
          createdAt
          website
          thumbnail {
            url
          }
        }
      }
    }
  `;

  const response = await axios.post(
    PRODUCT_HUNT_API,
    { query },
    {
      headers: {
        Authorization: `Bearer ${process.env.PRODUCT_HUNT_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  const products = response.data?.data?.posts?.nodes || [];

  const cleanedProducts = products
    .filter((product) => product.name && product.tagline)
    .filter((product) => isValidUrl(product.url))
    .filter((product) => isLikelyAIProduct(product))
    .map((product) => ({
      productHuntId: product.id,
      name: product.name.trim(),
      tagline: product.tagline.trim(),
      productHuntUrl: product.url,
      websiteUrl: isValidUrl(product.website)
        ? product.website
        : null,
      createdAt: product.createdAt,
      thumbnail: product.thumbnail?.url || null,
    }));

  return cleanedProducts;
}
function getCategory(product) {
  const text = `${product.name} ${product.tagline}`.toLowerCase();

  if (
    text.includes("coding") ||
    text.includes("code") ||
    text.includes("developer") ||
    text.includes("cursor") ||
    text.includes("programming")
  ) {
    return "Developer Tools";
  }

  if (
    text.includes("video") ||
    text.includes("editor") ||
    text.includes("image") ||
    text.includes("design")
  ) {
    return "Creative";
  }

  if (text.includes("research")) {
    return "Research";
  }

  if (
    text.includes("agent") ||
    text.includes("llm") ||
    text.includes("ai") ||
    text.includes("assistant") ||
    text.includes("automation")
  ) {
    return "AI & Automation";
  }

  return "AI Tools";
}
async function saveProductsToDatabase(products) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const product of products) {
      const slug = product.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const category = getCategory(product);

      await client.query(
        `
        INSERT INTO ai_tools (
          tool_name,
          slug,
          category,
          description,
          official_website,
          source,
          source_url,
          logo_url,
          is_active,
          is_trending,
          ph_created_at,
          product_hunt_id,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          true, true, $9, $10, NOW(), NOW()
        )
        ON CONFLICT (product_hunt_id)
        WHERE product_hunt_id IS NOT NULL
        DO UPDATE SET
          tool_name = EXCLUDED.tool_name,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          official_website = EXCLUDED.official_website,
          source_url = EXCLUDED.source_url,
          logo_url = EXCLUDED.logo_url,
          is_trending = true,
          ph_created_at = EXCLUDED.ph_created_at,
          updated_at = NOW()
        `,
        [
          product.name,
          slug,
          category,
          product.tagline,
          product.websiteUrl,
          "Product Hunt",
          product.productHuntUrl,
          product.thumbnail,
          product.createdAt,
          product.productHuntId
        ]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
      count: products.length
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getLatestProducts,
  saveProductsToDatabase,
};