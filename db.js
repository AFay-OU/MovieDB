import sqlite3 from "sqlite3";
import fs from "fs";
import path from "path";

// Make a db directory and check if it exists
const dataDir = path.join("data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  console.log("Created /data folder");
}

// Enable verbose mode for more descriptive error messages
sqlite3.verbose();

const dbPath = path.join(dataDir, "MovieDB.db");

// Create database file
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB connection error:", err.message);
  else console.log("Connected to MovieDB.db at", dbPath);
});

// Enable FK support
db.run("PRAGMA foreign_keys = ON");

const tables = `
CREATE TABLE IF NOT EXISTS movie (
  movie_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date  DATE,
  synopsis  TEXT,
  rating  INTEGER,
  run_time  INTEGER,
  category  TEXT
);

CREATE TABLE IF NOT EXISTS person (
  person_id INTEGER PRIMARY KEY AUTOINCREMENT,
  p_name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_producer (
  movie_id  INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS movie_actor (
  movie_id  INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS movie_actress (
  movie_id  INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS movie_director (
  movie_id  INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS movie_writer (
  movie_id  INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);
`;

// Executes the above SQL command
db.exec(tables, (err) => {
  if (err) console.error("Error creating tables:", err.message);
  else console.log("Tables created successfully!");
});

// Helper functions
export function getMovies(callback) {
  db.all(`SELECT * FROM movie`, [], callback);
}

export function addMovie(movie, callback) {
  const sql = `
    INSERT INTO movie (title, release_date, synopsis, rating, run_time, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, movie, function (err) {
    if (err) {
      console.error("DB INSERT ERROR:", err.message);
      callback(err, null);
    } else {
      console.log("Inserted movie with ID:", this.lastID);
      callback(null, this.lastID);
    }
  });
}

export function linkRole(table, movieId, personId, callback) {
  const sql = `INSERT INTO ${table} (movie_id, person_id) VALUES (?, ?)`;
  db.run(sql, [movieId, personId], callback);
}

// Export db const to be use elsewhere
export default db;
