import mongoose from "mongoose";

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecotrace";
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    console.log(`[MongoDB] Connected successfully to: ${uri.replace(/\/\/[^@]+@/, "//***@")}`);
    return conn;
  } catch (err: any) {
    console.warn(`[MongoDB Notice] Primary connection to ${uri.replace(/\/\/[^@]+@/, "//***@")} failed (${err.message}). Attempting local fallback: mongodb://127.0.0.1:27017/ecotrace...`);
    try {
      const localUri = "mongodb://127.0.0.1:27017/ecotrace";
      const localConn = await mongoose.connect(localUri, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: true,
      });
      console.log(`[MongoDB] Connected successfully to local database: ${localUri}`);
      return localConn;
    } catch (localErr: any) {
      console.error(`[MongoDB Connection Error] Failed to connect to both primary and local fallback:`, localErr.message);
      throw err;
    }
  }
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
