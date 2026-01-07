const express = require("express");
const app = express();

// Allow form submissions
app.use(express.urlencoded({ extended: true }));

// Routes
const projectsRouter = require("./routes/projects");

// Home
app.get("/", (req, res) => {
  res.send(`
    <h1>🎬 Studio Dashboard</h1>
    <p><a href="/projects">Go to Projects</a></p>
  `);
});

// Projects routes
app.use("/projects", projectsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

  
 

