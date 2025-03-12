# main.yp
import json
import threading
import time
import logging
import os
from rdf_knowledge_graph import RDFKnowledgeGraph
from mastodon_client import MastodonClient
import random
from machine_learning_service import MLService
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
import string
from spore_manager import SporeManager
from spore_action import SporeAction
from datetime import datetime
import uuid

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# Flask app setup
app = Flask(__name__)
CORS(app)

FUNGUS_ID = int(os.getenv("FUNGUS_ID", 0))
NUM_OF_FUNGI = int(os.getenv("NUM_OF_FUNGI", 1))
FUNGUS_BACKEND_PORT = int(os.getenv("FUNGUS_BACKEND_PORT", 5000)) + FUNGUS_ID
FUSEKI_SERVER_URL = os.getenv("FUSEKI_SERVER_URL")
FUSEKI_DATABASE_NAME = os.getenv("FUSEKI_DATABASE_NAME")

FEEDBACK_THRESHOLD = float(os.getenv("FEEDBACK_THRESHOLD", 0.5))
SLEEP_TIME = float(os.getenv("SLEEP_TIME", 42300))
MODEL_NAME = "model-" + str(FUNGUS_ID)

class MusicRecommendationFungus:
    def __init__(self):
        logging.info("[INIT] Initializing Music Recommendation instance")
        self.mastodon_client = MastodonClient(self)
        self.knowledge_graph = RDFKnowledgeGraph(mastodon_client=self.mastodon_client)
        self.knowledge_graph.insert_songs_from_csv('songs.csv')
        self.machine_learning_service = MLService(self.knowledge_graph, user_ratings_csv='user_ratings.csv')
        self.knowledge_graph.insert_model_state(MODEL_NAME, self.machine_learning_service.model.get_state())
        self.learning_group_id = str(uuid.uuid4())
        self.knowledge_graph.insert_learning_group(self.learning_group_id, MODEL_NAME)
        self.feedback_threshold = FEEDBACK_THRESHOLD
        self.fungus_name = self.generate_fungus_name()
        self.profile_picture_code = self.generate_random_code()
        self.spore_manager = SporeManager(self.mastodon_client)
        fuseki_url = FUSEKI_SERVER_URL
        database = FUSEKI_DATABASE_NAME
        self.update_url = f"{fuseki_url}/{database}/update"
        self.link_to_database = f"{fuseki_url}/{database}/query"
        self.knowledge_graph.insert_fungus_data(FUNGUS_ID, self.fungus_name, self.link_to_database)
        # default sleep time: 42300
        self.sleep_time = SLEEP_TIME
        logging.info(f"[CONFIG] Feedback threshold set to {self.feedback_threshold}")

    def generate_fungus_name(self):
        fungus_prefixes = [
            "Shroom", "Toadstool", "Spore", "Mycelium", "Cap", "Gilly", "Truffle", "Fungi", "Mush", "Puff"
        ]
        fungus_suffixes = [ 'Sage', 'Oracle', 'Whisperer', 'Teller', 'Connoisseur', 'Seer', 'Enchanter', 'Charmer', 'Mystic' ]
        prefix = random.choice(fungus_prefixes)
        suffix = random.choice(fungus_suffixes)
        fungus_name = f"{prefix} {suffix}"
        return fungus_name

    def start(self):
        switch_team = True
        found_initial_team = False
        # post initial link to model
        self.spore_manager.post_spore_action(SporeAction("JOIN_GROUP", [self.link_to_database, self.learning_group_id], f"fungus-node-{FUNGUS_ID}"))
        i = 0
        while True:
            logging.info(f"[START] Starting epoche {i} (at {datetime.now()})")
            try:
                if switch_team or not found_initial_team:
                    self.mastodon_client.post_status(f"[SPORE] Searching for a new learning group ...")
                    logging.info("[CHECK] Searching for a new fungus group")
                    #messages, random_mycelial_tag = self.mastodon_client.get_statuses_from_random_mycelial_tag()

                    self.spore_manager.fetch_spore_actions()
                    spore_actions = self.spore_manager.get_spore_actions()
                    join_spore_action = self.filter_spore_actions_by_type(spore_actions, 'JOIN_GROUP')
                    #link_to_model = self.knowledge_graph.look_for_new_fungus_group_in_statuses(messages, random_mycelial_tag)
                    if join_spore_action and len(join_spore_action) > 0:
                        self.link_to_database = join_spore_action[0].args[0]
                        old_learning_group = self.learning_group_id
                        self.learning_group_id = join_spore_action[0].args[1]
                        self.knowledge_graph.remove_from_old_learning_group_and_add_to_new(MODEL_NAME, old_learning_group, self.learning_group_id)
                        self.mastodon_client.post_status(f"[SPORE] Joined new group: {self.link_to_database}")
                        logging.info({"node_id": f"fungus-node-{FUNGUS_ID}", "event": "message_received", "details": {"from": join_spore_action[0].actor, "model": self.learning_group_id}, "timestamp": datetime.today().strftime('%Y-%m-%dT%H:%M:%S')})
                        found_initial_team = True
                        #self.knowledge_graph.look_for_song_data_in_statuses_to_insert(messages)
                        #self.knowledge_graph.on_found_group_to_join(self.link_to_model)
                    else:
                        logging.info("[WAIT] No group to join found.")
                        self.mastodon_client.post_status(f"[SPORE] No initial learning group found. Going to sleep.")
                elif not switch_team:
                    # send invite to join group
                    self.spore_manager.post_spore_action(SporeAction("JOIN_GROUP", [self.link_to_database, self.learning_group_id], f"fungus-node-{FUNGUS_ID}"))
                    self.mastodon_client.post_status(f"[SPORE] Invited node to join group: {self.link_to_database}")
                else:
                    logging.info("[WAIT] No initial groups found.")
                    self.mastodon_client.post_status(f"[SPORE] No initial learning group found. Going to sleep.")
                    self.link_to_database = None

                if self.link_to_database is not None:
                    logging.info("[TRAINING] New fungus group detected, initiating training")
                    self.mastodon_client.post_status(f"[SPORE] Started new training epoche.")
                    self.train_model()
                    learning_group_model_names = self.knowledge_graph.fetch_current_learning_group(self.learning_group_id)
                    all_models_of_my_learning_group = self.knowledge_graph.fetch_all_model_from_knowledge_base_with_name(self.link_to_database, learning_group_model_names)
                    logging.info(f"Received models from other nodes (size: {len(all_models_of_my_learning_group)})")
                    self.mastodon_client.post_status(f"[SPORE] Finished training and received model from other nodes.")
                    aggregated_model_state = self.knowledge_graph.aggregate_model_states(self.machine_learning_service.model.get_state(), all_models_of_my_learning_group)
                    # deploy new model
                    self.machine_learning_service.model.set_state(aggregated_model_state)
                    self.mastodon_client.post_status(f"[SPORE] Deployed aggregated model.")
                    logging.info("[SAVING] Deployed aggregated model as new model")

                    feedback = self.answer_user_feedback()
                    logging.info(f"[FEEDBACK] Received feedback: {feedback}")

                    switch_team = self.decide_whether_to_switch_team(feedback)
                    if switch_team:
                        self.mastodon_client.post_status(f"[SPORE] Decided to switch the learning group.")
                        self.link_to_database = None
                    else:
                        self.mastodon_client.post_status(f"[SPORE] Decided against switching groups.")

                    self.evolve_behavior(feedback)
                else:
                    logging.error("The model is none")

                logging.info("[SLEEP] Sleeping for " + str(self.sleep_time))
                self.mastodon_client.post_status(f"[SPORE] Sleeping for {str(self.sleep_time)}.")
                time.sleep(self.sleep_time)
                i = i + 1
            except Exception as e:
                logging.error(f"[ERROR] An error occurred: {e}", exc_info=True)
                time.sleep(self.sleep_time)

    def train_model(self):
        try:
            logging.info("[TRAINING] Starting model training")
            self.machine_learning_service.train_model()
            model = self.machine_learning_service.model
            logging.info(f"[RESULT] Model trained successfully.")
            self.knowledge_graph.save_model(MODEL_NAME, model)
            logging.info("[STORE] Model saved to RDF Knowledge Graph")
            self.mastodon_client.post_status(f"[SPORE] Model updated.")
            logging.info("[NOTIFY] Status posted to Mastodon")
        except Exception as e:
            logging.error(f"[ERROR] Failed during training and deployment: {e}", exc_info=True)

    def decide_whether_to_switch_team(self, feedback):
        switch_decision = feedback < self.feedback_threshold
        logging.info(f"[DECISION] Switch team: {switch_decision}")
        return switch_decision

    def generate_random_code(self, length=16):
        characters = string.ascii_letters + string.digits
        return ''.join(random.choice(characters) for _ in range(length))

    def answer_user_feedback(self):
        statuses = self.mastodon_client.fetch_latest_statuses(None, None)
        feedback = 1
        fresh_statuses = filter(lambda s: s["id"] not in self.mastodon_client.ids_of_replied_statuses, statuses)
        for status in fresh_statuses:
            if "[SPORE]" not in status['content']:
                song_titles = self.machine_learning_service.get_song_recommendations(self.machine_learning_service.extract_song_from_string(status['content']), 3)
                self.mastodon_client.reply_to_status(status['id'], status['account']['username'], "[SPORE] " + str(song_titles))
        # count feedback
        num_of_statuses_send = len(self.mastodon_client.ids_of_replied_statuses)
        overall_favourites = self.mastodon_client.count_likes_of_all_statuses()
        if overall_favourites > 0:
            feedback = num_of_statuses_send / overall_favourites
        else:
            feedback = random.randint(0, 1)
        return feedback

    def evolve_behavior(self, feedback):
        mutation_chance = 0.1
        if random.random() < mutation_chance:
            logging.info("Randomly mutated")
            self.mastodon_client.post_status(f"[SPORE] Mutated.")
            old_threshold = self.feedback_threshold
            self.feedback_threshold *= random.uniform(0.9, 1.1)  # Randomly adjust threshold
            logging.info(f"[EVOLVE] Feedback threshold mutated from {old_threshold} to {self.feedback_threshold}")

    def get_song_recommendations(self, song_name):
        recommendations = self.machine_learning_service.get_song_recommendations(song_name, 3)
        if isinstance(recommendations, (list, tuple)):
            recommendations = [rec.tolist() if hasattr(rec, 'tolist') else rec for rec in recommendations]
        return recommendations

    def filter_spore_actions_by_type(self, spore_actions, spore_type):
        return list(filter(lambda e: e.spore_type == spore_type, spore_actions))


logging.info("[STARTUP] Launching MusicRecommendationFungus instance")
music_service = MusicRecommendationFungus()


@app.route('/recommend', methods=['GET'])
def get_recommendation():
    """Endpoint to get song recommendations."""
    song_name = request.args.get('song_name')
    if not song_name:
        return jsonify({"error": "Missing 'song_name' parameter"}), 400

    logging.info(f"[REQUEST] Received recommendation request for song: {song_name}")
    recommendations = music_service.get_song_recommendations(song_name)
    return jsonify({"song_name": song_name, "recommendations": recommendations[0]})

@app.route('/fungi', methods=['GET'])
def get_fungi_data():
    """ Endpoint for bots configuration """
    all_fungi_data = music_service.knowledge_graph.get_all_fungi_data()
    if len(all_fungi_data) > 0:
        logging.info("Retrieved all fungus links from knowledge base")
        all_fungi = [
            {"name": fungus_data["fungus_name"], "port": fungus_data["link_to_model"]}
            for i, fungus_data in enumerate(all_fungi_data)
        ]
    else:
        logging.error("Unable to retrieve fungus data from knowledge base - use default values")
        all_fungi = [
            {"name": "Fungus 1", "port": "3000"},
            {"name": "Fungus 2", "port": "3001"}
        ]
    return jsonify( { "allFungi": all_fungi, "model": { "name": "MyModel", "fungi": [ music_service.fungus_name ]}} )

@app.route('/random-profile', methods=['GET'])
def get_random_profile():
    return jsonify({
        'code': music_service.profile_picture_code
    })

@app.route('/info', methods=['GET'])
def get_fungus_info():
    info = {
        "name": music_service.fungus_name,
    }
    return jsonify({"info": info})


if __name__ == "__main__":
    port = FUNGUS_BACKEND_PORT
    logging.info("[STARTUP] Launching Flask app for Music Recommendation Service on port " + str(port))
    threading.Thread(target=lambda: app.run(host="0.0.0.0", port=int(port), debug=True, use_reloader=False)).start()
    music_service.start()
