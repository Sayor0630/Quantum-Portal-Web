// Migration script to add default brand to existing products
// This should be run once to handle existing products that don't have a brand

import connectToDatabase from '../lib/dbConnect';
import Product from '../models/Product';
import Brand from '../models/Brand';
import mongoose from 'mongoose';

async function migrateProductsWithoutBrand() {
  try {
    await connectToDatabase();
    
    // Check if there are any products without brand
    const productsWithoutBrand = await Product.find({ 
      $or: [
        { brand: { $exists: false } },
        { brand: null },
        { brand: '' }
      ]
    }).countDocuments();
    
    if (productsWithoutBrand === 0) {
      console.log('✅ All products already have brands assigned');
      return;
    }
    
    console.log(`Found ${productsWithoutBrand} products without brands`);
    
    // Get or create a default brand
    let defaultBrand = await Brand.findOne({ name: 'Default Brand' });
    
    if (!defaultBrand) {
      console.log('Creating default brand...');
      defaultBrand = await Brand.create({
        name: 'Default Brand',
        slug: 'default-brand',
        description: 'Default brand for migrated products',
        isActive: true
      });
      console.log('✅ Created default brand:', defaultBrand.name);
    }
    
    // Update products without brand
    const updateResult = await Product.updateMany(
      { 
        $or: [
          { brand: { $exists: false } },
          { brand: null },
          { brand: '' }
        ]
      },
      { 
        $set: { brand: defaultBrand._id }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} products with default brand`);
    
    // List all brands for reference
    const allBrands = await Brand.find({ isActive: true }).select('name slug');
    console.log('Available brands:', allBrands.map(b => `${b.name} (${b.slug})`).join(', '));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateProductsWithoutBrand();
}

export default migrateProductsWithoutBrand;
