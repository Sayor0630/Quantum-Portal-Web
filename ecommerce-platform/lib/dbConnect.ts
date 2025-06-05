import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cachedConnection: any = (global as any).mongoose;

if (!cachedConnection) {
  cachedConnection = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cachedConnection.conn) {
    // console.log('Using cached database connection');
    return cachedConnection.conn;
  }

  if (!cachedConnection.promise) {
    const opts = {
      bufferCommands: false, // Disable Mongoose's buffering mechanism
      // useNewUrlParser: true, // Deprecated in new Mongoose versions
      // useUnifiedTopology: true, // Deprecated
    };

    // console.log('Creating new database connection');
    cachedConnection.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      // console.log('Database connection successful');
      return mongooseInstance;
    }).catch(error => {
      console.error('Database connection error:', error);
      cachedConnection.promise = null; // Reset promise on error
      throw error; // Re-throw error to be caught by caller
    });
  }

  try {
    cachedConnection.conn = await cachedConnection.promise;
  } catch (e) {
    cachedConnection.promise = null;
    throw e;
  }

  return cachedConnection.conn;
}

export default connectToDatabase;
