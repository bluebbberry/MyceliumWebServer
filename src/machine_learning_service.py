import logging
import torch
from torch.utils.data import DataLoader, Dataset
from transformers import GPT2Config, GPT2Model, GPT2Tokenizer, AdamW
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

class LLMService:
    def __init__(self, rdf_knowledge_graph, user_ratings_csv=None, num_epochs=10, lr=5e-5):
        self.rdf_knowledge_graph = rdf_knowledge_graph
        self.user_ratings_data = pd.read_csv(user_ratings_csv) if user_ratings_csv else None
        self.num_epochs = num_epochs
        self.lr = lr

        # Tokenizer and model initialization
        self.tokenizer = GPT2Tokenizer.from_pretrained("gpt2")
        self.model = GPT2Model(GPT2Config(n_embd=256, n_layer=4, n_head=4))  # Small custom GPT-like model

        # Loss function and optimizer
        self.criterion = torch.nn.MSELoss()
        self.optimizer = AdamW(self.model.parameters(), lr=self.lr)

        # Prepare the dataset
        self.dataset = self.create_dataset()

    def create_dataset(self):
        """Prepares the dataset for training."""
        class SongsDataset(Dataset):
            def __init__(self, tokenizer, songs_data):
                self.tokenizer = tokenizer
                self.songs_data = songs_data

            def __len__(self):
                return len(self.songs_data)

            def __getitem__(self, idx):
                song = self.songs_data.iloc[idx]
                title = song['title']
                inputs = self.tokenizer(title, return_tensors="pt", padding="max_length", truncation=True, max_length=32)
                return inputs['input_ids'].squeeze(0), inputs['attention_mask'].squeeze(0)

        return SongsDataset(self.tokenizer, self.rdf_knowledge_graph.songs_data)

    def train_model(self):
        """Train the transformer model."""
        dataloader = DataLoader(self.dataset, batch_size=8, shuffle=True)

        for epoch in range(self.num_epochs):
            self.model.train()
            total_loss = 0

            for input_ids, attention_mask in dataloader:
                # Forward pass
                outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
                embeddings = outputs.last_hidden_state[:, 0, :]  # Take the [CLS]-like token embedding
                target = torch.randn(embeddings.shape[0], embeddings.shape[1])  # Placeholder target embeddings

                # Compute loss
                loss = self.criterion(embeddings, target)

                # Backward pass
                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()

                total_loss += loss.item()

            print(f"Epoch {epoch + 1}/{self.num_epochs}, Loss: {total_loss:.4f}")

    def get_answer(self, title):
        """Recommend the top N songs using the model's learned embeddings."""
        self.model.eval()
        input_data = self.rdf_knowledge_graph.songs_data
        song_index = input_data[input_data['title'] == title].index[0]
        input_ids, attention_mask = self.dataset[song_index]

        with torch.no_grad():
            # Embedding for the input song
            song_embedding = self.model(input_ids=input_ids.unsqueeze(0), attention_mask=attention_mask.unsqueeze(0)).last_hidden_state[:, 0, :]

            # Embeddings for all songs
            all_embeddings = []
            for idx in range(len(self.dataset)):
                input_ids, attention_mask = self.dataset[idx]
                embedding = self.model(input_ids=input_ids.unsqueeze(0), attention_mask=attention_mask.unsqueeze(0)).last_hidden_state[:, 0, :]
                all_embeddings.append(embedding)

            all_embeddings = torch.stack(all_embeddings).squeeze(1)

            # Compute cosine similarity
            similarity_matrix = torch.nn.functional.cosine_similarity(song_embedding, all_embeddings, dim=1)
            top_indices = similarity_matrix.argsort(descending=True)[1:1 + 1]

        return input_data.iloc[top_indices]['title'].values
