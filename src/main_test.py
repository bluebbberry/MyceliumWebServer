import unittest
from unittest.mock import patch, MagicMock
from main import MusicRecommendationFungus

class TestMusicRecommendationFungus(unittest.TestCase):

    @patch('main.MastodonClient')
    @patch('main.RDFKnowledgeGraph')
    @patch('main.MLService')
    def setUp(self, MockMLService, MockRDFKnowledgeGraph, MockMastodonClient):
        self.mock_mastodon = MockMastodonClient.return_value
        self.mock_knowledge_graph = MockRDFKnowledgeGraph.return_value
        self.mock_ml_service = MockMLService.return_value
        self.music_fungus = MusicRecommendationFungus()

    def test_initialization(self):
        self.assertIsNotNone(self.music_fungus.mastodon_client)
        self.assertIsNotNone(self.music_fungus.knowledge_graph)
        self.assertIsNotNone(self.music_fungus.machine_learning_service)

    def test_train_model(self):
        self.music_fungus.train_model()
        self.mock_ml_service.train_model.assert_called_once()
        self.mock_knowledge_graph.save_model.assert_called_once()

    def test_decide_whether_to_switch_team(self):
        feedback_below_threshold = 0.4
        feedback_above_threshold = 0.6

        self.assertTrue(self.music_fungus.decide_whether_to_switch_team(feedback_below_threshold))
        self.assertFalse(self.music_fungus.decide_whether_to_switch_team(feedback_above_threshold))

    @patch('main.random.random', return_value=0.05)
    def test_evolve_behavior_mutation(self, mock_random):
        old_threshold = self.music_fungus.feedback_threshold
        self.music_fungus.evolve_behavior(0.3)
        self.assertNotEqual(self.music_fungus.feedback_threshold, old_threshold)

if __name__ == "__main__":
    unittest.main()
