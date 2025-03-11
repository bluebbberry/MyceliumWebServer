# mastodon_api.py
import requests
import os
import logging
from dotenv import load_dotenv
import random
import json
from spore_action import SporeAction

load_dotenv()
logging.basicConfig(level=logging.INFO)

FUNGUS_ID = int(os.getenv("FUNGUS_ID"))
AP_BACKEND_NAME = os.getenv("AP_BACKEND_NAME") + str(FUNGUS_ID)
AP_BACKEND_PORT = int(os.getenv("AP_BACKEND_PORT")) + FUNGUS_ID

MASTODON_API_KEY = os.getenv("MASTODON_API_KEY")
MASTODON_INSTANCE_URL = os.getenv("MASTODON_INSTANCE_URL")
NUTRIAL_TAG = os.getenv("NUTRIAL_TAG")
MYCELIAL_HASHTAG = os.getenv("MYCELIAL_TAG")

class MastodonClient:
    def __init__(self, musicRecommendationFungus):
        self.musicRecommendationFungus = musicRecommendationFungus
        self.api_token = MASTODON_API_KEY
        self.instance_url = MASTODON_INSTANCE_URL
        self.nutrial_tag = NUTRIAL_TAG
        self.ap_server = AP_BACKEND_NAME
        self.ap_server_port = AP_BACKEND_PORT
        self.ids_of_replied_statuses = []
        self.ids_of_replies = []

    def post_status(self, status_text):
        # url = f"{self.instance_url}/api/v1/statuses"
        url = f"http://{self.ap_server}:{self.ap_server_port}/statuses"
        logging.info("Post to: " + url)
        payload = {'status': status_text, "actor": self.musicRecommendationFungus.fungus_name}
        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            logging.info(f"Posted to Mastodon: {status_text}")
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error posting status: {e}")
            return None

    def fetch_latest_statuses(self, model, hashtag):
        base_url = f"{self.instance_url}/api/v1"

        if hashtag is None:
            hashtag = self.nutrial_tag

        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Accept': 'application/json'
        }

        params = {
            'type': 'statuses',
            'tag': hashtag,
            'limit': 30
        }

        response = requests.get(f"{base_url}/timelines/tag/{self.nutrial_tag}",
                                headers=headers,
                                params=params)

        if response.status_code == 200:
            data = response.json()
            logging.info(f"Found {len(data)} latest statuses")
            statuses = data
            return statuses
        else:
            logging.error(f"Error: {response.status_code}")
            return None

    def get_statuses_from_random_mycelial_tag(self):
        messages = []
        random_mycelial_tag = random.choice(MYCELIAL_HASHTAG.split(";"))
        statuses = self.fetch_latest_statuses(None, random_mycelial_tag)
        for status in statuses:
            messages.append(status["content"])
        if not messages:
            logging.warning("No messages found under the nutrial hashtag. Trying again later...")
            return None, random_mycelial_tag
        else:
            return messages, random_mycelial_tag

    def count_likes_of_all_statuses(self):
        overall_likes = 0
        for status_id in self.ids_of_replies:
            favourites_count = self.count_likes_of_status(status_id)
            overall_likes += favourites_count
        return overall_likes

    def count_likes_of_status(self, status_id):
        base_url = f"{self.instance_url}/api/v1"

        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Accept': 'application/json'
        }

        response = requests.get(f"{base_url}/statuses/{status_id}", headers=headers)

        if response.status_code == 200:
            data = response.json()
            favourites_count = data['favourites_count']
            logging.info(f"Status {status_id} was liked {data['favourites_count']}")
            return favourites_count
        else:
            logging.error(f"Error: {response.status_code}")
            return None

    def reply_to_status(self, status_id, username, message):
        # Construct the reply message mentioning the user
        reply_message = f"@{username} {message}"

        # Prepare the request headers
        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }

        # Prepare the request payload
        payload = {
            'status': reply_message,
            'in_reply_to_id': status_id
        }
        logging.info("Reply to status with id " + str(status_id) + ": " + reply_message)

        # Send the POST request
        response = requests.post(f'{self.instance_url}/api/v1/statuses', json=payload, headers=headers)

        try:
            response_json = response.json()
            if isinstance(response_json, dict) and "id" in response_json:
                self.ids_of_replied_statuses.append(status_id)
                self.ids_of_replies.append(response_json["id"])
                print("Reply sent successfully!")
            else:
                print("Unexpected response format:", response_json)
        except ValueError as e:
            print("Failed to parse JSON response:", e)

    def post_spore_status(self, spore_action):
        status_text = json.dumps({
            "spore_type": spore_action.spore_type,
            "args": spore_action.args
        })

        # url = f"{self.instance_url}/api/v1/statuses"
        url = f"http://{self.ap_server}:{self.ap_server_port}/spore-actions"
        logging.info("Post spore action to: " + url)
        payload = {'status': status_text, "actor": self.musicRecommendationFungus.fungus_name}
        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            logging.info(f"Posted to Mastodon: {status_text}")
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error posting status: {e}")
            return None

    def fetch_latest_spore_actions(self):
        base_url = f"http://{self.ap_server}:{self.ap_server_port}"

        headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Accept': 'application/json'
        }

        params = {
            'type': 'statuses',
            'tag': "spore",
            'limit': 30
        }

        response = requests.get(f"{base_url}/spore-actions",
                                headers=headers,
                                params=params)

        if response.status_code == 200:
            logging.info("Parsing response element:\n" + json.dumps(response.json(), indent=2))
            data = json.loads(response.json()["spore-actions"])
            logging.info(f"Found {len(data)} latest spore action posts")
            received_spore_actions = []
            for status in data:
                spore_action_dict = json.loads(status.text)
                received_spore_actions.push(SporeAction(spore_action_dict.spore_type, spore_action_dict.args))
            return received_spore_actions
        else:
            logging.error(f"Error: {response.status_code}")
            return None
