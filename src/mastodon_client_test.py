import unittest
from unittest.mock import patch, MagicMock
from mastodon_client import MastodonClient

class TestMastodonClient(unittest.TestCase):
    def setUp(self):
        self.client = MastodonClient()

    @patch('mastodon_client.requests.post')
    def test_post_status_successful(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"id": "12345"}

        response = self.client.post_status("Hello, Mastodon!")

        self.assertIsNotNone(response)
        self.assertEqual(response["id"], "12345")

    @patch('mastodon_client.requests.get')
    def test_fetch_latest_statuses_successful(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = [{"content": "Test post"}]

        statuses = self.client.fetch_latest_statuses(None, "test")

        self.assertIsNotNone(statuses)
        self.assertEqual(len(statuses), 1)
        self.assertEqual(statuses[0]["content"], "Test post")

    @patch('mastodon_client.requests.get')
    def test_count_likes_of_status_successful(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {"favourites_count": 42}

        likes = self.client.count_likes_of_status("12345")

        self.assertEqual(likes, 42)

    @patch('mastodon_client.requests.post')
    def test_reply_to_status_successful(self, mock_post):
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"id": "67890"}

        self.client.reply_to_status("12345", "testuser", "This is a reply!")

        self.assertIn("12345", self.client.ids_of_replied_statuses)
        self.assertIn("67890", self.client.ids_of_replies)

if __name__ == '__main__':
    unittest.main()
