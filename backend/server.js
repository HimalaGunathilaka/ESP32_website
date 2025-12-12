const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
