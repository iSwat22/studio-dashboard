const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));

// Routes
const projectsRouter = require("./routes/projects");
const uploadsRouter = require("./routes/uploads");

// Home
app.get("/", (req, res) => {
  res.send(`
    <h1>🎬 Studio Dashboard</h1>
    <ul>
      <li><a href="/projects">Projects</a></li>
      <li><a href="/uploads">Uploads</a></li>
    </ul>
  `);
});

app.use("/projects", projectsRouter);
app.use("/uploads", uploadsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



  
 

