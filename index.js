import express from "express";
import dotenv from "dotenv";
import connect from "./api/strategy/[strategyId]/connect.js";

dotenv.config();
const app = express();
app.use(express.json());

app.post("/api/strategy/:strategyId/connect", connect);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});