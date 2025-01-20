# main.yp
import time
import logging
import os
from rdf_knowledge_graph import RDFKnowledgeGraph
from mastodon_client import MastodonClient
import datetime
import random
from machine_learning_service import MLService
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

class MusicRecommendationFungus:
    def __init__(self):
        logging.info("[INIT] Initializing Music Recommendation instance")
        self.mastodon_client = MastodonClient()
        self.knowledge_graph = RDFKnowledgeGraph(mastodon_client=self.mastodon_client)
        self.knowledge_graph.insert_songs_from_csv('songs.csv')
        self.machine_learning_service = MLService(self.knowledge_graph, user_ratings_csv='user_ratings.csv')
        self.knowledge_graph.insert_model_state("my-model", self.machine_learning_service.model.get_state())
        self.feedback_threshold = float(os.getenv("FEEDBACK_THRESHOLD", 0.5))
        logging.info(f"[CONFIG] Feedback threshold set to {self.feedback_threshold}")

    def start(self):
        switch_team = True
        found_initial_team = False
        i = 0
        while True:
            logging.info(f"[START] Starting epoche {i} (at {datetime.datetime.now()})")
            try:
                if switch_team or not found_initial_team:
                    logging.info("[CHECK] Searching for a new fungus group")
                    messages, random_mycelial_tag = self.mastodon_client.get_statuses_from_random_mycelial_tag()
                    link_to_model = self.knowledge_graph.look_for_new_fungus_group_in_statuses(messages, random_mycelial_tag)
                    self.knowledge_graph.look_for_song_data_in_statuses_to_insert(messages)
                    self.knowledge_graph.on_found_group_to_join(link_to_model)
                else:
                    logging.info("[WAIT] No new groups found.")
                    link_to_model = None

                if link_to_model is not None:
                    logging.info("[TRAINING] New fungus group detected, initiating training")
                    self.train_model()
                    all_models = self.knowledge_graph.fetch_all_model_from_knowledge_base(link_to_model)
                    logging.info(f"Received models from other nodes (size: {len(all_models)})")
                    aggregated_model_state = self.knowledge_graph.aggregate_model_states(self.machine_learning_service.model.get_state(), all_models)
                    # deploy new model
                    self.machine_learning_service.model.set_state(aggregated_model_state)
                    logging.info("[SAVING] Deployed aggregated model as new model")

                feedback = self.answer_user_feedback()
                logging.info(f"[FEEDBACK] Received feedback: {feedback}")

                switch_team = self.decide_whether_to_switch_team(feedback)

                self.evolve_behavior(feedback)

                logging.info("[SLEEP] Sleeping for 20 seconds")
                time.sleep(20)
                i = i + 1
            except Exception as e:
                logging.error(f"[ERROR] An error occurred: {e}", exc_info=True)
                time.sleep(60)

    def train_model(self):
        try:
            logging.info("[TRAINING] Starting model training")
            self.machine_learning_service.train_model()
            model = self.machine_learning_service.model
            logging.info(f"[RESULT] Model trained successfully.")
            self.knowledge_graph.save_model("my-model", model)
            logging.info("[STORE] Model saved to RDF Knowledge Graph")
            self.mastodon_client.post_status(f"[FUNGUS] Model updated.")
            logging.info("[NOTIFY] Status posted to Mastodon")
        except Exception as e:
            logging.error(f"[ERROR] Failed during training and deployment: {e}", exc_info=True)

    def decide_whether_to_switch_team(self, feedback):
        switch_decision = feedback < self.feedback_threshold
        logging.info(f"[DECISION] Switch team: {switch_decision}")
        return switch_decision

    def answer_user_feedback(self):
        statuses = self.mastodon_client.fetch_latest_statuses(None, None)
        feedback = 1
        fresh_statuses = filter(lambda s: s["id"] not in self.mastodon_client.ids_of_replied_statuses, statuses)
        for status in fresh_statuses:
            if "[FUNGUS]" not in status['content']:
                song_titles = self.machine_learning_service.get_song_recommendations(self.machine_learning_service.extract_song_from_string(status['content']), 3)
                self.mastodon_client.reply_to_status(status['id'], status['account']['username'], "[FUNGUS] " + str(song_titles))
        # count feedback
        num_of_statuses_send = len(self.mastodon_client.ids_of_replied_statuses)
        overall_favourites = self.mastodon_client.count_likes_of_all_statuses()
        if overall_favourites > 0:
            feedback = num_of_statuses_send / overall_favourites
        else:
            feedback = 0
        return feedback

    def evolve_behavior(self, feedback):
        mutation_chance = 0.1
        if random.random() < mutation_chance:
            logging.info("Randomly mutated")
            old_threshold = self.feedback_threshold
            self.feedback_threshold *= random.uniform(0.9, 1.1)  # Randomly adjust threshold
            logging.info(f"[EVOLVE] Feedback threshold mutated from {old_threshold} to {self.feedback_threshold}")

if __name__ == "__main__":
    logging.info("[STARTUP] Launching MusicRecommendationFungus instance")
    baby_fungus = MusicRecommendationFungus()
    baby_fungus.start()
