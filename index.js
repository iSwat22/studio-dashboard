const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.send("Backend is live 🚀");
});

app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});

  
 

