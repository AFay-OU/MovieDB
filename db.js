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

// Create a database file
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB connection error:", err.message);
  else console.log("Connected to MovieDB.db at", dbPath);
});

// Enable FK support
db.run("PRAGMA foreign_keys = ON");

const tables = `
CREATE TABLE IF NOT EXISTS movie (
  movie_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  release_date DATE,
  synopsis TEXT,
  rating INTEGER,
  run_time INTEGER,
  category TEXT
);

CREATE TABLE IF NOT EXISTS person (
  person_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  pay REAL NOT NULL,
  UNIQUE(first_name, last_name)
);

CREATE TABLE IF NOT EXISTS actor (
  actor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS actress (
  actress_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS writer (
  writer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  contribution TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS director (
  director_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  position TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS producer (
  producer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  position TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE IF NOT EXISTS movie_person (
  movie_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);
`;

// Executes the above SQL command
db.exec(tables, (err) => {
  if (err) {
    console.error("Error creating tables:", err.message);
  } else {
    console.log("Tables created.");

    db.run(
      `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_person_name
  ON person (first_name, last_name)
  `,
      (err2) => {
        if (err2) console.error("Error creating unique index:", err2.message);
        else
          console.log(
            "Unique index for person (first_name, last_name) is active."
          );
      }
    );
  }
});

// Helper functions
export function addMovie(values, callback) {
  const sql = `
    INSERT INTO movie (title, release_date, synopsis, rating, run_time, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, values, function (err) {
    callback(err, this?.lastID);
  });
}

export function addPerson(values, callback) {
  const sql = `
    INSERT INTO person (first_name, last_name, pay)
    VALUES (?, ?, ?)
  `;

  db.run(sql, values, function (err) {
    if (err) {
      if (
        err.code === "SQLITE_CONSTRAINT" ||
        err.code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        return callback({ duplicate: true }, null);
      }
      return callback(err, null);
    }
    return callback(null, this?.lastID);
  });
}

export function linkMoviePerson(movieId, personId, callback) {
  const sql = `
    INSERT INTO movie_person (movie_id, person_id)
    VALUES (?, ?)
  `;

  db.run(sql, [movieId, personId], function (err) {
    if (err) {
      if (
        err.code === "SQLITE_CONSTRAINT" ||
        err.code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        return callback({ duplicateLink: true }, null);
      }
      return callback(err, null);
    }
    return callback(null, true);
  });
}

export function addJobRecord(table, data, callback) {
  const sql = `
    INSERT INTO ${table} (person_id, ${data.field})
    VALUES (?, ?)
  `;
  db.run(sql, [data.personId, data.value], callback);
}

export function getMovies(callback) {
  db.all("SELECT * FROM movie", [], callback);
}

export function deleteMovieAndLinks(movieId, callback) {
  db.serialize(() => {
    db.run(
      "DELETE FROM movie_person WHERE movie_id = ?",
      [movieId],
      function (err) {
        if (err) return callback(err);

        db.run(
          "DELETE FROM movie WHERE movie_id = ?",
          [movieId],
          function (err2) {
            callback(err2);
          }
        );
      }
    );
  });
}

export function deletePersonAndLinks(personId, callback) {
  db.serialize(() => {
    const jobTables = ["actor", "actress", "writer", "director", "producer"];

    let remaining = jobTables.length + 2;

    const done = (err) => {
      if (err) return callback(err);
      remaining--;
      if (remaining === 0) callback(null);
    };

    jobTables.forEach((table) => {
      db.run(`DELETE FROM ${table} WHERE person_id = ?`, [personId], done);
    });

    db.run("DELETE FROM movie_person WHERE person_id = ?", [personId], done);

    db.run("DELETE FROM person WHERE person_id = ?", [personId], done);
  });
}

export function deleteAttachment(movieId, personId, callback) {
  const sql = `
    DELETE FROM movie_person
    WHERE movie_id = ? AND person_id = ?
  `;
  db.run(sql, [movieId, personId], callback);
}

// Export db const to be used elsewhere
export default db;
