const pool = require("../config/db");

const {
  getLatestProducts,
  saveProductsToDatabase
} = require("../services/productHuntService");

async function getTrendingTools(req, res) {
  try {
    const { category, sort } = req.query;

    console.log("🔥 Fetching latest Product Hunt products...");

    const products = await getLatestProducts(50);

    console.log(
      `📦 Product Hunt AI products found: ${products.length}`
    );

    if (products.length > 0) {
      await saveProductsToDatabase(products);
    }

    const values = [];

    let query = `
      SELECT
        id,
        tool_name,
        slug,
        category,
        subcategory,
        description,
        best_use_cases,
        official_website,
        pricing,
        logo_url,
        votes_count,
        is_trending,
        source,
        source_url,
        ph_created_at
      FROM ai_tools
      WHERE is_active = true
        AND is_trending = true
    `;

    if (category) {
      values.push(category);
      query += ` AND category = $${values.length}`;
    }

    if (sort === "votes") {
      query += ` ORDER BY votes_count DESC NULLS LAST`;
    } else {
      query += ` ORDER BY ph_created_at DESC NULLS LAST`;
    }

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      filters: {
        category: category || "all",
        sort: sort || "newest"
      },
      tools: result.rows
    });

  } catch (error) {
    console.error("Trending API Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch trending tools"
    });
  }
}

module.exports = {
  getTrendingTools
};