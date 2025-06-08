const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Read environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  }
}

async function migrateOrderNumbers() {
  try {
    loadEnvFile();
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully');

    // Get reference to orders collection
    const Order = mongoose.connection.db.collection('orders');

    // Find orders without orderNumber field
    const ordersWithoutNumbers = await Order.find({ 
      orderNumber: { $exists: false } 
    }).toArray();

    console.log(`Found ${ordersWithoutNumbers.length} orders without order numbers`);

    if (ordersWithoutNumbers.length === 0) {
      console.log('No orders need migration');
      return;
    }

    // Update each order with a generated order number
    const bulkOps = ordersWithoutNumbers.map(order => {
      // Generate order number: timestamp + last 4 chars of ObjectId
      const timestamp = Math.floor(new Date(order.createdAt).getTime() / 1000).toString(36).toUpperCase();
      const idSuffix = order._id.toString().slice(-4).toUpperCase();
      const orderNumber = `${timestamp}${idSuffix}`;

      return {
        updateOne: {
          filter: { _id: order._id },
          update: { $set: { orderNumber: orderNumber } }
        }
      };
    });

    // Execute bulk update
    const result = await Order.bulkWrite(bulkOps);
    console.log(`Migration completed: ${result.modifiedCount} orders updated`);

    // Verify migration
    const remainingOrders = await Order.countDocuments({ 
      orderNumber: { $exists: false } 
    });
    console.log(`Orders still without order numbers: ${remainingOrders}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration
migrateOrderNumbers();
