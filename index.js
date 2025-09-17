const mongoose = require("mongoose");
console.log("✅ index.js is running!");

mongoose.connect("mongodb://localhost:27017/testdb", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB!");
});
