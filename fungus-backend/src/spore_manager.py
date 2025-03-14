# spore_manager.py
from spore_action import SporeAction

class SporeManager:
    def __init__(self, mastodon_client):
        self.mastodon_client = mastodon_client
        self.spore_actions = []

    def fetch_spore_actions(self):
        self.spore_actions = self.mastodon_client.fetch_latest_spore_actions()

    def get_spore_actions(self):
        return self.spore_actions

    def post_spore_action(self, spore_action):
        self.mastodon_client.post_spore_status(spore_action)
