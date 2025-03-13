import csv
import random

class FitnessCalculator:
    def __init__(self, csv_file="songs.csv", machine_learning_service=None):
        self.csv_file = csv_file
        self.machine_learning_service = machine_learning_service
        self.songs = self._load_songs()

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

    def song_guess_was_correct(self, song_input, song_predicted):
        if song_input not in self.songs or song_predicted not in self.songs:
            return False

        return (self.songs[song_input]["genre"] == self.songs[song_predicted]["genre"] and
                self.songs[song_input]["tempo"] == self.songs[song_predicted]["tempo"])

    def get_random_songs(self, count=5):
        return random.sample(list(self.songs.keys()), min(count, len(self.songs)))

    def calculate_fitness(self):
        correct_guesses = 0
        all_test_samples = self.get_random_songs()
        for test_song in all_test_samples:
            song_result = self.machine_learning_service.get_song_recommendations(test_song)[0]
            if self.song_guess_was_correct(test_song, song_result):
                correct_guesses += 1
        correctness_ratio = correct_guesses / len(all_test_samples)

        # Add random number
        random_number = random.uniform(-0.5, 0.5)

        # See whether it's under threshold or not
        return correctness_ratio + random_number
