import express from "express";
import cors from "cors";
import { addMovie, getMovies } from "./db.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// Add a movie
app.post("/api/movie", (req, res) => {
  const { title, release_date, synopsis, rating, run_time, category } =
    req.body;

  // Sample input check
  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  addMovie(
    [title, release_date, synopsis, rating, run_time, category],
    (err, id) => {
      if (err) {
        console.error("INSERT ERROR:", err.message);
        return res.status(500).json({ error: err.message });
      }

      return res.json({ message: "Movie added", movie_id: id });
    }
  );
});

// View all movies
app.get("/api/movies", (req, res) => {
  getMovies((err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
