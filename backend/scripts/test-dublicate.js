require("dotenv").config();

const { getLatestProducts } = require("../services/productHuntService");

async function testDuplicates() {
  try {
    const products = await getLatestProducts(20);

    console.log("\n📦 Products received:", products.length);

    const uniqueProducts = [];
    const seenIds = new Set();

    for (const product of products) {
      if (!seenIds.has(product.productHuntId)) {
        seenIds.add(product.productHuntId);
        uniqueProducts.push(product);
      }
    }

    console.log("✅ Unique products:", uniqueProducts.length);
    console.log("🔁 Duplicates removed:", products.length - uniqueProducts.length);

    console.log("\n🔥 UNIQUE AI PRODUCTS\n");

    uniqueProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.productHuntId}`);
      console.log(`   Tagline: ${product.tagline}`);
      console.log("------------------------------------");
    });

  } catch (error) {
    console.error("❌ Duplicate test error:");

    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testDuplicates();