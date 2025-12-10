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
  updateMovie,
  updatePerson,
  updateJobRecord,
  roleExists,
} from "./db.js";
import db from "./db.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

app.post("/api/movie", (req, res) => {
  const { title, release_date, synopsis, rating, run_time, category } =
    req.body;

  if (!title) return res.status(400).json({ error: "Title required" });

  addMovie(
    [title, release_date, synopsis, rating, run_time, category],
    (err, id) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, movie_id: id });
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

    if (table && !value) {
      return res.status(400).json({
        error: `Missing '${field}' for ${person.type}.`,
      });
    }

    if (!value) return res.status(400).json({ error: `Missing ${field}.` });

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
        success: true,
        message: "Person added and linked to movie.",
        person_id: personId,
      });
    }

    return res.json({
      success: true,
      message: "Person added.",
      person_id: personId,
    });
  } catch (err) {
    if (err.duplicate)
      return res.status(409).json({ error: "Person already exists." });
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/addMovieAndPerson", async (req, res) => {
  const { movie, person } = req.body;

  if (!movie.title)
    return res.status(400).json({ error: "Movie title required." });

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

    if (!value) return res.status(400).json({ error: `Missing ${field}` });

    await new Promise((resolve, reject) =>
      addJobRecord(table, { personId, field, value }, (err) =>
        err ? reject(err) : resolve()
      )
    );

    // Add movie
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

    await new Promise((resolve, reject) =>
      linkMoviePerson(movieId, personId, (err) =>
        err ? reject(err) : resolve()
      )
    );

    res.json({
      success: true,
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

app.post("/api/link-person-to-movie", (req, res) => {
  const { movie_id, person_id } = req.body;

  console.log("Link request:", { movie_id, person_id });

  if (!movie_id || !person_id) {
    return res.status(400).json({ error: "movie_id and person_id required" });
  }

  linkMoviePerson(movie_id, person_id, (err) => {
    if (err) {
      if (err.duplicateLink) {
        return res
          .status(200)
          .json({ message: "Person already linked to this movie." });
      }
      if (err.foreignKey) {
        return res.status(400).json({
          error: "Invalid movie_id or person_id (foreign key error).",
        });
      }
      console.error("Unexpected link error:", err);
      return res.status(500).json({ error: err.message || "Link failed." });
    }

    res.json({
      success: true,
      message: "Person successfully linked to movie.",
    });
  });
});

app.get("/api/movie/:id/persons", (req, res) => {
  const movieId = req.params.id;

  const sql = `
    SELECT p.*, 
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

  db.all(sql, [movieId], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.put("/api/movie/:id", (req, res) => {
  const movieId = req.params.id;
  const { title, release_date, synopsis, rating, run_time, category } =
    req.body;

  if (!title) return res.status(400).json({ error: "Title required." });

  updateMovie(
    movieId,
    [title, release_date, synopsis, rating, run_time, category],
    (err, changes) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Movie updated." });
    }
  );
});

app.put("/api/person/:id", async (req, res) => {
  const personId = req.params.id;
  const person = req.body;

  if (!person.first_name || !person.last_name || !person.pay)
    return res.status(400).json({ error: "Missing fields." });

  try {
    await new Promise((resolve, reject) =>
      updatePerson(
        personId,
        [person.first_name, person.last_name, person.pay],
        (err) => (err ? reject(err) : resolve())
      )
    );

    if (person.type) {
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

      const exists = await new Promise((resolve, reject) =>
        roleExists(table, personId, (err, r) =>
          err ? reject(err) : resolve(r)
        )
      );

      if (exists) {
        if (!value) {
          const row = await new Promise((resolve, reject) =>
            db.get(
              `SELECT ${field} FROM ${table} WHERE person_id = ?`,
              [personId],
              (err, row) => (err ? reject(err) : resolve(row))
            )
          );
          value = row ? row[field] : null;
        }

        await new Promise((resolve, reject) =>
          updateJobRecord(table, personId, field, value, (err) =>
            err ? reject(err) : resolve()
          )
        );
      }
    }

    res.json({ success: true, message: "Person updated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/movie/:id", (req, res) => {
  deleteMovieAndLinks(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: "Failed to delete movie." });
    res.json({ success: true, message: "Movie deleted." });
  });
});

app.delete("/api/person/:id", (req, res) => {
  deletePersonAndLinks(req.params.id, (err) => {
    if (err) return res.status(500).json({ error: "Failed to delete person." });
    res.json({ success: true, message: "Person deleted." });
  });
});

app.delete("/api/movie-person", (req, res) => {
  const { movie_id, person_id } = req.body;
  if (!movie_id || !person_id)
    return res.status(400).json({ error: "IDs required." });

  deleteAttachment(movie_id, person_id, (err) => {
    if (err) return res.status(500).json({ error: "Failed to remove link." });
    res.json({ success: true, message: "Link removed." });
  });
});

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

app.get("/api/persons", (req, res) => {
  db.all("SELECT * FROM person", [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/movie-person", (req, res) => {
  db.all("SELECT * FROM movie_person", [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/person/:id/movies", (req, res) => {
  const sql = `
    SELECT m.*
    FROM movie_person mp
    JOIN movie m ON m.movie_id = mp.movie_id
    WHERE mp.person_id = ?;
  `;
  db.all(sql, [req.params.id], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/actors", (req, res) => {
  const sql = `
    SELECT a.actor_id, a.person_id, a.role,
           p.first_name, p.last_name
    FROM actor a
    JOIN person p ON a.person_id = p.person_id
  `;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/actresses", (req, res) => {
  const sql = `
    SELECT ac.actress_id, ac.person_id, ac.role,
           p.first_name, p.last_name
    FROM actress ac
    JOIN person p ON ac.person_id = p.person_id
  `;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/writers", (req, res) => {
  const sql = `
    SELECT w.writer_id, w.person_id, w.contribution,
           p.first_name, p.last_name
    FROM writer w
    JOIN person p ON w.person_id = p.person_id
  `;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/directors", (req, res) => {
  const sql = `
    SELECT d.director_id, d.person_id, d.position,
           p.first_name, p.last_name
    FROM director d
    JOIN person p ON d.person_id = p.person_id
  `;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.get("/api/producers", (req, res) => {
  const sql = `
    SELECT pr.producer_id, pr.person_id, pr.position,
           p.first_name, p.last_name
    FROM producer pr
    JOIN person p ON pr.person_id = p.person_id
  `;
  db.all(sql, [], (err, rows) =>
    err ? res.status(500).json({ error: err.message }) : res.json(rows)
  );
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
