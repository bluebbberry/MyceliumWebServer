import numpy as np
import csv
import random

class FitnessCalculator:
    def __init__(self, csv_file="songs.csv", machine_learning_service=None):
        self.csv_file = csv_file
        self.machine_learning_service = machine_learning_service
        self.songs = self._load_songs()
        self.past_fitness_scores = []

    def _load_songs(self):
        songs = {}
        with open(self.csv_file, newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                songs[row["title"]] = {
                    "genre": row["genre"],
                    "tempo": int(row["tempo"])
                }
        return songs

    def song_similarity_score(self, song_input, song_predicted):
        if song_input not in self.songs or song_predicted not in self.songs:
            return 0.0

        genre_match = self.songs[song_input]["genre"] == self.songs[song_predicted]["genre"]
        tempo_diff = abs(self.songs[song_input]["tempo"] - self.songs[song_predicted]["tempo"])

        if genre_match and tempo_diff == 0:
            return 1.0
        elif genre_match and tempo_diff <= 5:
            return 0.8
        elif genre_match and tempo_diff <= 10:
            return 0.5
        elif not genre_match and tempo_diff <= 5:
            return 0.3
        else:
            return 0.0

    def get_random_songs(self):
        test_size = max(10, len(self.songs) // 10)
        return random.sample(list(self.songs.keys()), min(test_size, len(self.songs)))

    def calculate_fitness(self):
        similarity_scores = []
        all_test_samples = self.get_random_songs()

        for test_song in all_test_samples:
            song_result = self.machine_learning_service.get_song_recommendations(test_song)[0]
            similarity_scores.append(self.song_similarity_score(test_song, song_result))

        correctness_ratio = np.mean(similarity_scores) if similarity_scores else 0.0
        random_factor = random.uniform(-0.1, 0.1) * correctness_ratio
        fitness_score = correctness_ratio + random_factor

        self.past_fitness_scores.append(fitness_score)
        smoothed_fitness = np.mean(self.past_fitness_scores[-5:])  # Use last 5 scores for smoothing

        return smoothed_fitness
