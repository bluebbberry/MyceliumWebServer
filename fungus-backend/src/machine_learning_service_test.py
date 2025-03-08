import unittest
import torch
import pandas as pd
from machine_learning_service import MLService

class MockRDFKnowledgeGraph:
    def __init__(self):
        self.songs_data = pd.DataFrame({
            'song_id': [1, 2, 3],
            'title': ['Song A', 'Song B', 'Song C'],
            'genre': ['Rock', 'Pop', 'Jazz'],
            'artist': ['Artist1', 'Artist2', 'Artist3'],
            'tempo': [120, 130, 140],
            'duration': [200, 220, 180]
        })

class TestMLService(unittest.TestCase):
    def setUp(self):
        self.rdf_knowledge_graph = MockRDFKnowledgeGraph()
        self.service = MLService(rdf_knowledge_graph=self.rdf_knowledge_graph)

    def test_preprocess_data(self):
        features_encoded, song_ids = self.service.preprocess_data()
        self.assertEqual(features_encoded.shape[0], 3)
        self.assertEqual(len(song_ids), 3)

    def test_train_model(self):
        self.service.train_model()
        self.assertIsInstance(self.service.model, MLService.ContentBasedNeuralNetwork)

    def test_get_song_recommendations(self):
        self.service.train_model()
        recommendations = self.service.get_song_recommendations('Song A', top_n=2)
        self.assertEqual(len(recommendations), 2)
        self.assertTrue(all(isinstance(song, str) for song in recommendations))

    def test_recommend_songs_for_user_no_data(self):
        with self.assertRaises(ValueError):
            self.service.recommend_songs_for_user(user_id=1)

    def test_extract_song_from_string(self):
        result = self.service.extract_song_from_string("I love Song A!")
        self.assertEqual(result, "Song A")

if __name__ == '__main__':
    unittest.main()
