import sqlite3 from "sqlite3";

// Enable verbose mode for enhanced error reporting
sqlite3.verbose();

// Create a .db file in a data folder
const db = new sqlite3.Database("./data/MovieDB.db");

const tables = `
CREATE TABLE IF NOT EXISTS movie (
  movie_id     INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  release_date DATE,
  synopsis     TEXT,
  rating       INTEGER,
  category     TEXT
);

CREATE TABLE IF NOT EXISTS person (
  person_id INTEGER PRIMARY KEY,
  p_name    TEXT NOT NULL
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
