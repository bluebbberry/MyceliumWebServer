# spore_manager.py
from spore_action import SporeAction

class SporeManager:
    def __init__(self, mastodonClient):
        self.mastodonClient = mastodonClient
        self.spore_actions = []

    def fetch_spore_actions(self):
        self.spore_actions = self.mastodonClient.fetch_latest_spore_actions()

    def get_spore_actions(self):
        return self.spore_actions

    def post_spore_action(self, spore_action):
        self.mastodonClient.post_spore_status(spore_action)
