require("dotenv").config();

const {
  getLatestProducts,
  saveProductsToDatabase
} = require("../services/productHuntService");

async function testSave() {
  try {
    console.log("\n🔄 Fetching Product Hunt products...");

    const products = await getLatestProducts(20);

    console.log(`📦 AI products found: ${products.length}`);

    if (products.length === 0) {
      console.log("⚠️ No AI products found.");
      return;
    }

    console.log("\n💾 Saving to Neon...");

    const result = await saveProductsToDatabase(products);

    console.log("\n✅ DATABASE UPDATE SUCCESSFUL");
    console.log(`📊 Products processed: ${result.count}`);

    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
    });

  } catch (error) {
    console.error("\n❌ DATABASE SAVE ERROR:");
    console.error("Message:", error.message);

    if (error.code) {
      console.error("PostgreSQL Code:", error.code);
    }

    if (error.detail) {
      console.error("Detail:", error.detail);
    }
  }
}

testSave();