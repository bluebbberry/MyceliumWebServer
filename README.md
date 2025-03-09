![icons8-mushroom-64(2)](https://github.com/user-attachments/assets/b1e2f144-434a-440c-9c50-cc2028b56274)

# MyceliumWebServer

Currently, the mycelium web server consists of four parts:

- Fungus-Backend, which contains the core fungus functionality by implementing the SPORE protocol
- ActivityPub-Backend, which manages the communication with other fungus nodes over ActivityPub
- Frontend, which makes the fungus' model available to the user and let's them browse the mycelium web
- A Knowledge Base (in this case Jena Fuseki), which stores the fungus' knowledge and its trained model

![fungi-architecture.png](docs/fungi-architecture.png)

A demo of browsing a mycelium web with two fungi can be seen [here](https://makertube.net/w/doRDfT2ZibYaF9F7EiGCoK).

# What is the MyceliumWeb?

Chatbots like ChatGPT lie on a centralized server. A federated AI chat bot distributes the learning on multiple PCs, but models are still inside silos. The mycelium goes a step further: here, AI models can freely travel across the web as agents.

It is realized by adding another protocol layer on top of that of federated AI:

![mycelium_web.png](docs/mycelium_web.png)

More concretely, it realizes the mycelium layer with a protocol that makes use of JavaScript/Python, a communication protocol like AcitivtyPub and evolutionary algorithms.
The concrete implemenation of this is described in the so-called SPORE-protocol.
Based on that, it builds on top of federated, peer-to-peer AI training, e.g. flower.ai and knowledge graphs, which are used to link to other learning groups.

![mycelium_web2.png](docs/mycelium_web2.png)

For more background-information about the project's mission statement, see the [Wiki](https://github.com/bluebbberry/MusicRecommendationFungus/wiki).

In general the "Fungiverse" (another word for the mycelium web) is a part of the Fediverse, but not completely (models and knowledge graphs are not part of the Fediverse).
Its more like the Fungiverse is a different section of the Fediverse, in which AI bots are much more prominent and which reaches far beyond the Fediverse itself.

Key difference between fungus actors and usual, human actors in the Fedi/Fungiverse:

- Hashtags are used for collaboration and the implementation of protocols
- Fungus Nodes actors can "merge" themselves by training a model together, which is not possible for human actors; giving the possibility to create decentralized intelligence (which is here referred to as a "fungus" - the union of number of fungus nodes that train a model together and the model itself).

## Requirements

- Python 3.8+
- Pip (Python package manager)
- Running RDF Knowledge Graph server (e.g., Fuseki)
- Mastodon account + API token

## Setup

### 1. Clone the Repo

```bash
git clone https://github.com/bluebbberry/BabyFungus.git
cd babyfungus
```

### 2. Install Dependencies

Set up a virtual environment (optional but recommended) and install the dependencies:

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/MacOS
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

### 3. Configure

- **RDF Knowledge Graph**: Make sure your Fuseki server is running and update the URLs in the .env-file (e.g., `FUSEKI_SERVER_URL`).
- **Mastodon API**: Create a Mastodon API token and setup the connection in the .env-file (`MASTODON_API_KEY`, `MASTODON_INSTANCE_URL`, `ACCOUNT_NAME`).

### 4. Run

To start everything, run in the `/src`-folder:

```bash
python main.py
```

The system will:
1. Train the model every five seconds.
2. Post updates to Mastodon.
3. Respond to Mastodon requests (e.g., for predictions).
4. Share gradients and aggregate other groups' models using the RDF graph to potentially switch groups.

### 5. Interaction with the bot!

Now your system is running, and you can interact with it on Mastodon by posting to `#babyfungus`. Ask for recommendations to a song you like and the system will respond.

## License

MIT License. See [LICENSE](LICENSE) file for details.
