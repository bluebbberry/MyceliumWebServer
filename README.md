![ifungus.jpg](ifungus.jpg)

# iFungus

This project realizes community-driven song-recommendation in a decentralized manner based on RDF Knowledge-Graph, Mastodon and decentralized federated learning. The idea: train a model on your local machine while collaborating with your friends and then use the model together through bots.

For background-information about the project's mission statement, see the [Wiki](https://github.com/bluebbberry/MusicRecommendationFungus/wiki).

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
