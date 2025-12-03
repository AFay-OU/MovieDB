import express from "express";
import cors from "cors";
import {
  addMovie,
  addPerson,
  addJobRecord,
  linkMoviePerson,
  getMovies,
  deleteMovieAndLinks,
  deletePersonAndLinks,
  deleteAttachment,
} from "./db.js";
import db from "./db.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// Add a movie
app.post("/api/movie", (req, res) => {
  const { title, release_date, synopsis, rating, run_time, category } =
    req.body;

  if (!title) return res.status(400).json({ error: "Title required" });

  addMovie(
    [title, release_date, synopsis, rating, run_time, category],
    (err, id) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ movie_id: id });
    }
  );
});

app.post("/api/person", async (req, res) => {
  const { person, movie_id } = req.body;

  if (!person.first_name || !person.last_name || !person.pay || !person.type) {
    return res.status(400).json({ error: "Incomplete person data." });
  }

  try {
    const personId = await new Promise((resolve, reject) =>
      addPerson([person.first_name, person.last_name, person.pay], (err, id) =>
        err ? reject(err) : resolve(id)
      )
    );

    let table, field, value;

    if (person.type === "actor" || person.type === "actress") {
      table = person.type;
      field = "role";
      value = person.role;
    } else if (person.type === "writer") {
      table = "writer";
      field = "contribution";
      value = person.contribution;
    } else if (person.type === "director" || person.type === "producer") {
      table = person.type;
      field = "position";
      value = person.position;
    }

    if (!value) {
      return res.status(400).json({ error: `Missing ${field} field.` });
    }

    await new Promise((resolve, reject) =>
      addJobRecord(table, { personId, field, value }, (err) =>
        err ? reject(err) : resolve()
      )
    );

    if (movie_id) {
      await new Promise((resolve, reject) =>
        linkMoviePerson(movie_id, personId, (err) =>
          err ? reject(err) : resolve()
        )
      );

      return res.json({
        message: "Person added and linked to movie.",
        person_id: personId,
      });
    }

    return res.json({
      message: "Person added (not linked to any movie).",
      person_id: personId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/addMovieAndPerson", async (req, res) => {
  const { movie, person } = req.body;

  if (!movie.title)
    return res.status(400).json({ error: "Movie title required." });

  try {
    const movieId = await new Promise((resolve, reject) =>
      addMovie(
        [
          movie.title,
          movie.release_date,
          movie.synopsis,
          movie.rating,
          movie.run_time,
          movie.category,
        ],
        (err, id) => (err ? reject(err) : resolve(id))
      )
    );

    const personId = await new Promise((resolve, reject) =>
      addPerson([person.first_name, person.last_name, person.pay], (err, id) =>
        err ? reject(err) : resolve(id)
      )
    );

    let table, field, value;
    if (person.type === "actor" || person.type === "actress") {
      table = person.type;
      field = "role";
      value = person.role;
    } else if (person.type === "writer") {
      table = "writer";
      field = "contribution";
      value = person.contribution;
    } else if (person.type === "director" || person.type === "producer") {
      table = person.type;
      field = "position";
      value = person.position;
    }

    await new Promise((resolve, reject) =>
      addJobRecord(table, { personId, field, value }, (err) =>
        err ? reject(err) : resolve()
      )
    );

    await new Promise((resolve, reject) =>
      linkMoviePerson(movieId, personId, (err) =>
        err ? reject(err) : resolve()
      )
    );

    res.json({
      message: "Movie and person added successfully.",
      movie_id: movieId,
      person_id: personId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/movies", (req, res) => {
  getMovies((err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/movie/:id/persons", (req, res) => {
  const movieId = req.params.id;

  const sql = `
    SELECT 
      p.first_name,
      p.last_name,
      p.pay,
      CASE
        WHEN a.actor_id IS NOT NULL THEN 'Actor'
        WHEN ac.actress_id IS NOT NULL THEN 'Actress'
        WHEN d.director_id IS NOT NULL THEN 'Director'
        WHEN w.writer_id IS NOT NULL THEN 'Writer'
        WHEN pr.producer_id IS NOT NULL THEN 'Producer'
      END AS role_type,
      COALESCE(a.role, ac.role, d.position, w.contribution, pr.position) AS detail
    FROM movie_person mp
    JOIN person p ON mp.person_id = p.person_id
    LEFT JOIN actor a ON p.person_id = a.person_id
    LEFT JOIN actress ac ON p.person_id = ac.person_id
    LEFT JOIN director d ON p.person_id = d.person_id
    LEFT JOIN writer w ON p.person_id = w.person_id
    LEFT JOIN producer pr ON p.person_id = pr.person_id
    WHERE mp.movie_id = ?;
  `;

  db.all(sql, [movieId], (err, rows) => {
    if (err) {
      console.error("PERSON LOOKUP ERROR:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Delete
app.delete("/api/movie/:id", (req, res) => {
  const movieId = req.params.id;

  deleteMovieAndLinks(movieId, (err) => {
    if (err) {
      console.error("DELETE MOVIE ERROR:", err);
      return res.status(500).json({ error: "Failed to delete movie." });
    }
    res.json({ message: `Movie ${movieId} deleted.` });
  });
});

app.delete("/api/person/:id", (req, res) => {
  const personId = req.params.id;

  deletePersonAndLinks(personId, (err) => {
    if (err) {
      console.error("DELETE PERSON ERROR:", err);
      return res.status(500).json({ error: "Failed to delete person." });
    }
    res.json({ message: `Person ${personId} deleted.` });
  });
});

app.delete("/api/movie-person", (req, res) => {
  const { movie_id, person_id } = req.body;

  if (!movie_id || !person_id) {
    return res.status(400).json({ error: "Movie ID and person ID required." });
  }

  deleteAttachment(movie_id, person_id, (err) => {
    if (err) {
      console.error("DELETE ATTACHMENT ERROR:", err);
      return res.status(500).json({ error: "Failed to delete attachment." });
    }
    res.json({ message: "Attachment removed." });
  });
});

// Search
app.get("/api/search/movies-by-actor/:actorId", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN actor a ON a.person_id = mp.person_id
    WHERE a.actor_id = ?;
  `;

  db.all(sql, [req.params.actorId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/search/movies-by-actress/:actressId", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN actress ac ON ac.person_id = mp.person_id
    WHERE ac.actress_id = ?;
  `;

  db.all(sql, [req.params.actressId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/search/movies-by-producer/:producerId", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN producer pr ON pr.person_id = mp.person_id
    WHERE pr.producer_id = ?;
  `;
  db.all(sql, [req.params.producerId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/search/movies-by-director/:directorId", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN director d ON d.person_id = mp.person_id
    WHERE d.director_id = ?;
  `;
  db.all(sql, [req.params.directorId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

// NEW: Search movies by writer
app.get("/api/search/movies-by-writer/:writerId", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN writer w ON w.person_id = mp.person_id
    WHERE w.writer_id = ?;
  `;

  db.all(sql, [req.params.writerId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/search/most-expensive/:producerId", (req, res) => {
  const sql = `
    SELECT m.*, p.pay AS cost
    FROM movie m
    JOIN movie_person mp ON m.movie_id = mp.movie_id
    JOIN person p ON p.person_id = mp.person_id
    JOIN producer pr ON pr.person_id = p.person_id
    WHERE pr.producer_id = ?
    ORDER BY cost DESC
    LIMIT 1;
  `;
  db.get(sql, [req.params.producerId], (err, row) =>
    err ? res.status(500).json({ error: err.message }) : res.json(row)
  );
});

app.get("/api/search/movies-by-year/:year", (req, res) => {
  const sql = `
    SELECT *
    FROM movie
    WHERE strftime('%Y', release_date) = ?;
  `;
  db.all(sql, [req.params.year], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/actors", (req, res) => {
  const sql = `
    SELECT a.actor_id,
           p.person_id,
           p.first_name,
           p.last_name,
           p.pay,
           a.role
    FROM actor a
    JOIN person p ON p.person_id = a.person_id;
  `;

  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/actresses", (req, res) => {
  const sql = `
    SELECT ac.actress_id,
           p.person_id,
           p.first_name,
           p.last_name,
           p.pay,
           ac.role
    FROM actress ac
    JOIN person p ON p.person_id = ac.person_id;
  `;

  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/producers", (req, res) => {
  const sql = `
    SELECT pr.producer_id,
           p.person_id,
           p.first_name,
           p.last_name,
           p.pay,
           pr.position
    FROM producer pr
    JOIN person p ON p.person_id = pr.person_id;
  `;

  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/directors", (req, res) => {
  const sql = `
    SELECT d.director_id,
           p.person_id,
           p.first_name,
           p.last_name,
           p.pay,
           d.position
    FROM director d
    JOIN person p ON p.person_id = d.person_id;
  `;

  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

// ⭐ NEW: Writers dropdown list
app.get("/api/writers", (req, res) => {
  const sql = `
    SELECT w.writer_id,
           p.person_id,
           p.first_name,
           p.last_name,
           p.pay,
           w.contribution
    FROM writer w
    JOIN person p ON p.person_id = w.person_id;
  `;

  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));

// Debug
app.get("/api/persons", (req, res) => {
  const sql = `SELECT * FROM person`;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/movie-person", (req, res) => {
  const sql = `SELECT * FROM movie_person`;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/person/:id/movies", (req, res) => {
  const personId = req.params.id;

  const sql = `
    SELECT m.*
    FROM movie_person mp
    JOIN movie m ON mp.movie_id = m.movie_id
    WHERE mp.person_id = ?;
  `;

  db.all(sql, [personId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});
