CREATE TABLE movie (
  movie_id INT PRIMARY KEY,
  title TEXT NOT NULL,
  release_date DATE,
  synopsis TEXT,
  rating TEXT,
  run_time INT,
  category TEXT
);

CREATE TABLE person (
  person_id INT PRIMARY KEY,
  p_name TEXT NOT NULL
);

CREATE TABLE movie_producer (
  movie_id INT NOT NULL,
  person_id INT NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
)

CREATE TABLE movie_actor (
  movie_id INT NOT NULL,
  person_id INT NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE movie_actress (
  movie_id INT NOT NULL,
  person_id INT NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE movie_director (
  movie_id INT NOT NULL,
  person_id INT NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
);

CREATE TABLE movie_writer (
  movie_id INT NOT NULL,
  person_id INT NOT NULL,
  PRIMARY KEY (movie_id, person_id),
  FOREIGN KEY (movie_id) REFERENCES movie(movie_id),
  FOREIGN KEY (person_id) REFERENCES person(person_id)
)