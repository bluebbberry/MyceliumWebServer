import json
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime, timedelta
import random

def generate_mock_logs(filename="logs.json", num_interactions=100):
    agents = [f"agent-{i}" for i in range(1, 11)]
    logs = []
    start_time = datetime(2025, 3, 12, 10, 0, 0)

    for _ in range(num_interactions):
        sender = random.choice(agents)
        receiver = random.choice([a for a in agents if a != sender])
        timestamp = start_time + timedelta(seconds=random.randint(1, 3600))

        log_sent = {"node_id": sender, "event": "message_sent", "details": {"to": receiver}, "timestamp": timestamp.isoformat()}
        log_received = {"node_id": receiver, "event": "message_received", "details": {"from": sender}, "timestamp": timestamp.isoformat()}

        logs.append(log_sent)
        logs.append(log_received)

    logs.sort(key=lambda x: x["timestamp"])  # Ensure logs are in order

    with open(filename, "w") as f:
        for log in logs:
            f.write(json.dumps(log) + "\n")

    print(f"Generated {num_interactions} interactions in {filename}")

if __name__ == "__main__":
    generate_mock_logs()
