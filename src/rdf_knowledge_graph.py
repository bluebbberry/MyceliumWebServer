# rdf_knowledge_graph.py
import logging
from SPARQLWrapper import SPARQLWrapper, JSON
import json
import base64
import torch
import os
from dotenv import load_dotenv
import csv
import pandas as pd

load_dotenv()
logging.basicConfig(level=logging.INFO)

class RDFKnowledgeGraph:
    def __init__(self, mastodon_client, fuseki_url=os.getenv("FUSEKI_SERVER_URL"), dataset="my-knowledge-base"):
        self.update_url = f"{fuseki_url}/{dataset}/update"
        self.query_url = f"{fuseki_url}/{dataset}/query"
        self.fuseki_url = fuseki_url + "/" + dataset
        self.mastodon_client = mastodon_client
        self.sparql = SPARQLWrapper(self.fuseki_url)
        self.songs_data = self.get_all_songs()

    def fetch_all_songs(self):
        self.songs_data = self.get_all_songs()

    def look_for_new_fungus_group_in_statuses(self, messages, random_mycelial_tag):
        logging.info("Stage 1: Looking for a new fungus group to join...")
        if messages is None:
            return None

        for message in messages:
            if "model-link" in message:
                logging.info("Found request with join link. Preparing to join calculation ...")
                link_to_knowledge_base = self.extract_after_model_link(message)
                # set new hashtag
                self.mastodon_client.nutrial_tag = random_mycelial_tag
                return link_to_knowledge_base
        logging.info("Announcing request to join the next epoch.")
        self.mastodon_client.post_status(f"Request-to-join: Looking for a training group. {self.mastodon_client.nutrial_tag}")
        return None

    def look_for_song_data_in_statuses_to_insert(self, messages):
        logging.info("Look for song data in mastodon statuses to insert")
        if messages is None:
            return

        song_id_counter = len(self.songs_data.index) + 1
        for message in messages:
            if "song-data" in message:
                [title, genre, artist, tempo, duration] = self.extra_song_data_from_status_content(message)
                if title is not None and self.is_number(tempo) and self.is_number(duration):
                    logging.info("Insert song from Mastodon: "
                     + str(song_id_counter) + " "
                     + str(title) + " "
                     + str(genre) + " "
                     + str(artist) + " "
                     + str(tempo) + " "
                     + str(duration)
                    )
                    self.insert_song_data(song_id_counter, title, genre, artist, int(tempo), int(duration))
                    song_id_counter = song_id_counter + 1

    def extra_song_data_from_status_content(self, text):
        # Find the index of "song-data:"
        model_link_index = text.find("song-data:")

        if model_link_index == -1:
            return ""

        # Extract the substring after "song-data:"
        result = text[model_link_index + len("song-data:") + 1:]

        # Find the index of the first whitespace character
        whitespace_index = result.find("]")

        if whitespace_index != -1:
            result = result[:whitespace_index + 1]
            if self.is_json(result):
                return json.loads(result)
            else:
                return [None, None, None, None, None]
        else:
            return [None, None, None, None, None]

    def save_model(self, model_name, model):
        self.insert_model_state(model_name, model.get_state())

    def fetch_all_model_from_knowledge_base(self, link_to_model):
        return self.retrieve_all_model_states(link_to_model)

    def insert_model_state(self, model_name, model_state):
        """
        Inserts the model parameters into the Fuseki knowledge base using base64 encoding.
        """
        # Convert tensors to lists for serialization
        state_dict = {k: v.tolist() for k, v in model_state.items()}
        state_json = json.dumps(state_dict)
        state_encoded = base64.b64encode(state_json.encode('utf-8')).decode('utf-8')
        sparql = SPARQLWrapper(self.update_url)
        sparql_insert_query = f'''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        INSERT DATA {{
            ex:{model_name} a ex:ContentBasedModel ;
                            ex:modelState "{state_encoded}" .
        }}
        '''
        sparql.setQuery(sparql_insert_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)
        try:
            sparql.query()
            print(f"Model '{model_name}' inserted successfully.")
        except Exception as e:
            print(f"Error inserting model: {e}")

    def insert_song_data(self, song_id, title, genre, artist, tempo, duration):
        """
        Inserts the individual song data into the Fuseki knowledge base.
        """
        # Prepare the SPARQL query to insert the song data
        sparql = SPARQLWrapper(self.update_url)
        sparql_insert_query = f'''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        INSERT DATA {{
            ex:song_{song_id} a ex:Song ;
                               ex:songId {song_id} ;
                               ex:title "{title}" ;
                               ex:genre "{genre}" ;
                               ex:artist "{artist}" ;
                               ex:tempo {tempo} ;
                               ex:duration {duration} .
        }}
        '''

        sparql.setQuery(sparql_insert_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)

        try:
            sparql.query()
            print(f"Song '{title}' inserted successfully.")
        except Exception as e:
            print(f"Error inserting song: {e}")

    def get_all_songs(self):
        """
        Retrieves all songs and their data from the Fuseki knowledge base.
        """
        # Prepare the SPARQL query to retrieve all song data
        sparql = SPARQLWrapper(self.fuseki_url)
        sparql_select_query = '''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        SELECT ?song_id ?title ?genre ?artist ?tempo ?duration WHERE {
            ?song a ex:Song ;
                  ex:songId ?song_id ;
                  ex:title ?title ;
                  ex:genre ?genre ;
                  ex:artist ?artist ;
                  ex:tempo ?tempo ;
                  ex:duration ?duration .
        }
        '''

        sparql.setQuery(sparql_select_query)
        sparql.setReturnFormat(JSON)

        try:
            results = sparql.query().convert()

            # Process the result
            songs = []
            for song_data in results["results"]["bindings"]:
                song_info = {
                    "song_id": song_data["song_id"]["value"],
                    "title": song_data["title"]["value"],
                    "genre": song_data["genre"]["value"],
                    "artist": song_data["artist"]["value"],
                    "tempo": int(song_data["tempo"]["value"]),
                    "duration": int(song_data["duration"]["value"])
                }
                songs.append(song_info)

            # Convert the list of dictionaries into a pandas DataFrame
            if songs:
                songs_df = pd.DataFrame(songs)
                return songs_df
            else:
                print("No songs found in the database.")
                return pd.DataFrame()  # Return an empty DataFrame if no data is found
        except Exception as e:
            print(f"Error retrieving song data: {e}")
            return []

    def retrieve_all_model_states(self, link_to_model):
        """
        Retrieves all model parameters stored in the Fuseki server and decodes them.
        """
        sparql = SPARQLWrapper(self.query_url)
        sparql_select_query = '''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        SELECT ?model ?modelState
        WHERE {
            ?model a ex:ContentBasedModel ;
                   ex:modelState ?modelState .
        }
        '''
        sparql.setQuery(sparql_select_query)
        sparql.setReturnFormat(JSON)
        try:
            results = sparql.query().convert()
            models = []
            for result in results["results"]["bindings"]:
                model = result["model"]["value"]
                state_encoded = result["modelState"]["value"]
                state_json = base64.b64decode(state_encoded).decode('utf-8')
                state_dict = json.loads(state_json)
                # Convert lists back to tensors
                model_state = {k: torch.tensor(v) for k, v in state_dict.items()}
                models.append({"model": model, "modelState": model_state})
            return models
        except Exception as e:
            print(f"Error retrieving models: {e}")
            return []

    def aggregate_model_states(self, current_model_state, all_model_states, current_model_weight=0.5):
        """
        Aggregates model states from multiple nodes using a weighted averaging strategy.
        The current model has a higher weight in the averaging process.
        """
        if not all_model_states:
            print("No models available for aggregation.")
            return current_model_state

        # Extract states and convert tensors to numpy arrays for averaging
        state_keys = current_model_state.keys()
        aggregated_state = {k: current_model_weight * current_model_state[k].numpy() for k in state_keys}

        # Add the other models with a lower weight
        for model in all_model_states:
            for k in state_keys:
                aggregated_state[k] += (1 - current_model_weight) * model["modelState"][k].numpy() / len(all_model_states)

        # Convert back to tensors
        aggregated_state = {k: torch.tensor(v) for k, v in aggregated_state.items()}

        print("Model states aggregated successfully with weighted averaging.")
        return aggregated_state

    def insert_songs_from_csv(self, csv_file):
        """
        Inserts song data from a CSV file into the knowledge base.
        """
        with open(csv_file, mode='r') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                song_id = row['song_id']
                title = row['title']
                genre = row['genre']
                artist = row['artist']
                tempo = int(row['tempo'])
                duration = int(row['duration'])

                # Insert each song into the knowledge base
                self.insert_song_data(song_id, title, genre, artist, tempo, duration)

    def extract_after_model_link(self, text):
        # Find the index of "model-link:"
        model_link_index = text.find("model-link:")

        if model_link_index == -1:
            return ""

        # Extract the substring after "model-link:"
        result = text[model_link_index + len("model-link:") + 1:]

        # Find the index of the first whitespace character
        whitespace_index = result.find(" ")

        if whitespace_index != -1:
            return result[:whitespace_index]
        else:
            return result.strip()

    def on_found_group_to_join(self, link_to_model):
        self.mastodon_client.post_status("[FUNGUS] model-link: " + str(link_to_model) + " #" + self.mastodon_client.nutrial_tag)
        if link_to_model is not None:
            found_initial_team = True
            self.fuseki_url = link_to_model
        else:
            # default to fuseki server
            self.fuseki_url = os.getenv("FUSEKI_SERVER_URL")

    def is_json(self, myjson):
      try:
        json.loads(myjson)
      except ValueError as e:
        return False
      return True

    def is_number(self, text):
      try:
        text1 = int(text)
      except ValueError as e:
        return False
      return True
