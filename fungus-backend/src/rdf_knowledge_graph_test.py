import unittest
from unittest.mock import MagicMock, patch
from rdf_knowledge_graph import RDFKnowledgeGraph
import pandas as pd

class TestRDFKnowledgeGraph(unittest.TestCase):
    def setUp(self):
        self.mock_mastodon_client = MagicMock()
        self.rdf_kg = RDFKnowledgeGraph(self.mock_mastodon_client)

    @patch('rdf_knowledge_graph.SPARQLWrapper')
    def test_get_all_songs(self, MockSPARQLWrapper):
        mock_sparql = MockSPARQLWrapper.return_value
        mock_sparql.query.return_value.convert.return_value = {
            "results": {
                "bindings": [
                    {"song_id": {"value": "1"}, "title": {"value": "Test Song"}, "genre": {"value": "Rock"},
                     "artist": {"value": "Test Artist"}, "tempo": {"value": "120"}, "duration": {"value": "300"}}
                ]
            }
        }

        songs_df = self.rdf_kg.get_all_songs()

        self.assertIsInstance(songs_df, pd.DataFrame)
        self.assertEqual(len(songs_df), 1)
        self.assertEqual(songs_df.iloc[0]['title'], 'Test Song')

    @patch('rdf_knowledge_graph.SPARQLWrapper')
    def test_insert_song_data(self, MockSPARQLWrapper):
        mock_sparql = MockSPARQLWrapper.return_value

        self.rdf_kg.insert_song_data(1, "Test Song", "Rock", "Test Artist", 120, 300)

        mock_sparql.setQuery.assert_called_once()
        mock_sparql.query.assert_called_once()

    def test_extra_song_data_from_status_content(self):
        message = "song-data: [\"Test Song\", \"Rock\", \"Test Artist\", 120, 300]"
        result = self.rdf_kg.extra_song_data_from_status_content(message)
        self.assertEqual(result, ["Test Song", "Rock", "Test Artist", 120, 300])

    def test_is_json_valid(self):
        valid_json = '{"key": "value"}'
        self.assertTrue(self.rdf_kg.is_json(valid_json))

    def test_is_json_invalid(self):
        invalid_json = '{key: value}'
        self.assertFalse(self.rdf_kg.is_json(invalid_json))

if __name__ == '__main__':
    unittest.main()
