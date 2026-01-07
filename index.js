const express = require("express");
const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));

// Serve public frontend
app.use(express.static(path.join(__dirname, "public")));

// Routes
const projectsRouter = require("./routes/projects");
const uploadsRouter = require("./routes/uploads");
app.use("/projects", projectsRouter);
app.use("/uploads", uploadsRouter);

// (Optional) Force / to load index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



  
 

