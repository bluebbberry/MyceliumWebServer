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

FUSEKI_SERVER_URL = os.getenv("FUSEKI_SERVER_URL")
FUSEKI_DATABASE_NAME = os.getenv("FUSEKI_DATABASE_NAME")

class RDFKnowledgeGraph:
    def __init__(self, mastodon_client, fuseki_url=FUSEKI_SERVER_URL, dataset=FUSEKI_DATABASE_NAME):
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
        sparql.setHTTPAuth('BASIC')
        sparql.setCredentials("admin", "pw123")
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
        sparql.setHTTPAuth('BASIC')
        sparql.setCredentials("admin", "pw123")

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
        sparql.setHTTPAuth('BASIC')
        sparql.setCredentials("admin", "pw123")

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

    def insert_fungus_data(self, fungus_id, fungus_name, link_to_model):
        """
        Inserts the individual fungus data into the Fuseki knowledge base.
        """
        # Prepare the SPARQL query to insert the fungus data
        sparql = SPARQLWrapper(self.update_url)
        sparql_insert_query = f'''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

        INSERT DATA {{
            ex:fungus_{fungus_id} a ex:Fungus ;
                               ex:fungusId {fungus_id} ;
                               ex:fungusName "{fungus_name}" ;
                               ex:linkToModel "{link_to_model}" .
        }}
        '''

        sparql.setQuery(sparql_insert_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:
            sparql.query()
            print(f"Fungus with ID '{fungus_id}' inserted successfully.")
        except Exception as e:
            print(f"Error inserting fungus: {e}")

    def get_all_fungi_data(self):
        """
        Retrieves data about other fungi from the Fuseki knowledge base.
        """

        # Prepare the SPARQL query to retrieve all fungus data
        sparql = SPARQLWrapper(self.query_url)
        sparql_select_query = '''
                PREFIX ex: <http://example.org/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                SELECT ?fungus_id ?link_to_model ?fungus_name WHERE {
                    ?fungus a ex:Fungus ;
                            ex:fungusId ?fungus_id ;
                            ex:fungusName ?fungus_name ;
                            ex:linkToModel ?link_to_model .
                }
                '''

        sparql.setQuery(sparql_select_query)
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:

            results = sparql.query().convert()

            # Process the result
            fungi = []
            for fungus_data in results["results"]["bindings"]:
                fungus_info = {
                    "fungus_id": fungus_data["fungus_id"]["value"],
                    "link_to_model": fungus_data["link_to_model"]["value"],
                    "fungus_name": fungus_data["fungus_name"]["value"]
                }
                fungi.append(fungus_info)

            if fungi:
                return fungi
            else:
                print("No fungi found in the database.")
                return []
        except Exception as e:
            print(f"Error retrieving fungus data: {e}")
            return []

    def retrieve_all_model_states(self, link_to_model):
        """
        Retrieves all model parameters stored in the Fuseki server and decodes them.
        """
        sparql = SPARQLWrapper(link_to_model)
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
        sparql.setHTTPAuth('BASIC')
        sparql.setCredentials("admin", "pw123")
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
        reference_shapes = {k: v.shape for k, v in current_model_state.items()}

        # Add the other models with a lower weight
        for model in all_model_states:
            for k in state_keys:
                model_tensor = model["modelState"][k].numpy()
                # Check if the shape matches the expected shape
                if model_tensor.shape != reference_shapes[k]:
                    print(f"Shape mismatch for key '{k}': expected {reference_shapes[k]}, got {model_tensor.shape}. Skipping this model.")
                    continue  # Skip adding this model
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
        self.mastodon_client.post_status("[SPORE] model-link: " + str(link_to_model) + " #" + self.mastodon_client.nutrial_tag)
        if link_to_model is not None:
            found_initial_team = True
            self.fuseki_url = link_to_model
        else:
            # default to fuseki server
            self.fuseki_url = FUSEKI_SERVER_URL

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

    def insert_learning_group(self, learning_group_id: str, model_name: str):
        """
        Inserts a learning group into the knowledge base.

        Args:
            learning_group_id: Unique identifier for the learning group
            model_name: first model name of this group
        """
        # Prepare the SPARQL query to insert the learning group data
        sparql = SPARQLWrapper(self.update_url)
        sparql_insert_query = f'''
        PREFIX ex: <http://example.org/>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    
        INSERT DATA {{
            ex:learningGroup_{learning_group_id} a ex:LearningGroup ;
                                   ex:groupId "{learning_group_id}" ;
                                   ex:hasModel "{model_name}" .
        }}
        '''

        sparql.setQuery(sparql_insert_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:
            sparql.query()
            print(f"Learning group with ID '{learning_group_id}' inserted successfully.")
        except Exception as e:
            print(f"Error inserting learning group: {e}")

    # Remove model_name from old_learning_group and adds it to new_learning_group
    def remove_from_old_learning_group_and_add_to_new(self, model_name, old_learning_group_id, new_learning_group_id):
        """
        Removes a model_name from old_learning_group and adds it to new_learning_group.

        Args:
            model_name: The model name to transfer
            old_learning_group_id: ID of the source learning group
            new_learning_group_id: ID of the target learning group
        """
        # First, remove the model from the old group
        sparql = SPARQLWrapper(self.update_url)
        remove_query = f'''
        PREFIX ex: <http://example.org/>
        
        DELETE {{
            ex:learningGroup_{old_learning_group_id} ex:hasModel "{model_name}" .
        }}
        '''
        sparql.setQuery(remove_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:
            sparql.query()
            print(f"Successfully removed {model_name} from group {old_learning_group_id}")
        except Exception as e:
            print(f"Error removing model from old group: {e}")
            return False

        # Then, add the model to the new group
        sparql = SPARQLWrapper(self.update_url)
        add_query = f'''
        PREFIX ex: <http://example.org/>
        
        INSERT DATA {{
            ex:learningGroup_{new_learning_group_id} ex:hasModel "{model_name}" .
        }}
        '''
        sparql.setQuery(add_query)
        sparql.setMethod('POST')
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:
            sparql.query()
            print(f"Successfully added {model_name} to group {new_learning_group_id}")
            return True
        except Exception as e:
            print(f"Error adding model to new group: {e}")
            return False

    def fetch_current_learning_group(self, learning_group_id):
        """
        Fetches all model names associated with a learning group.

        Args:
            learning_group_id: ID of the learning group to fetch

        Returns:
            List of model names in the learning group
        """
        sparql = SPARQLWrapper(self.update_url)
        query = f'''
        PREFIX ex: <http://example.org/>
        
        SELECT ?modelName
        WHERE {{
            ex:learningGroup_{learning_group_id} ex:hasModel ?modelName .
        }}
        '''
        sparql.setQuery(query)
        sparql.setReturnFormat(JSON)
        sparql.setCredentials("admin", "pw123")

        try:
            results = sparql.query().convert()
            model_names = [binding['modelName'].value for binding in results['results']['bindings']]
            return model_names
        except Exception as e:
            print(f"Error fetching learning group: {e}")
            return []

    def fetch_all_model_from_knowledge_base_with_name(self, link_to_database, learning_group_model_names):
        """
        Fetches models from the knowledge base based on their names.

        Args:
            link_to_database: URL of the Fuseki database
            learning_group_model_names: List of model names to fetch

        Returns:
            List of dictionaries containing model information
        """
        sparql = SPARQLWrapper(link_to_database)
        query = '''
        PREFIX ex: <http://example.org/>
        
        SELECT ?modelName ?modelState
        WHERE {
            ?model a ex:ContentBasedModel ;
                   ex:modelName ?modelName ;
                   ex:modelState ?modelState .
            FILTER (?modelName IN (%s))
        }
        ''' % ', '.join(f'"{name}"' for name in learning_group_model_names)

        sparql.setQuery(query)
        sparql.setReturnFormat(JSON)
        sparql.setHTTPAuth('BASIC')
        sparql.setCredentials("admin", "pw123")

        try:
            results = sparql.query().convert()
            models = []
            for binding in results['results']['bindings']:
                model_info = {
                    'name': binding['modelName'].value,
                    'state': binding['modelState'].value
                }
                models.append(model_info)
            return models
        except Exception as e:
            print(f"Error fetching models: {e}")
            return []
