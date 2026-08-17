import mongoose from "mongoose";

let isConnected = false;

export async function connectToMongo(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("[MongoDB] ERROR: MONGODB_URI is not configured!");
    throw new Error("MONGODB_URI is not configured");
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log("[MongoDB] Connected to MongoDB Atlas");

    mongoose.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from MongoDB");
      isConnected = false;
    });

    return mongoose;
  } catch (error) {
    console.error("[MongoDB] Failed to connect:", error);
    isConnected = false;
    throw error;
  }
}

export { mongoose };
