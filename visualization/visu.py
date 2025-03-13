import json
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from datetime import datetime

def load_logs(log_file):
    with open(log_file, 'r') as f:
        logs = [json.loads(line) for line in f.readlines()]

    for log in logs:
        log["timestamp"] = datetime.fromisoformat(log.get("timestamp", "2025-03-12T00:00:00"))

    return sorted(logs, key=lambda x: x["timestamp"])

def build_graph(logs, time_threshold):
    graph = nx.Graph()

    for log in logs:
        if log["timestamp"] > time_threshold:
            break

        node_id = log["node_id"]
        event = log["event"]
        details = log.get("details", {})

        if event == "message_sent" and "to" in details:
            if graph.has_node(node_id):
                graph.remove_node(node_id)
            target_node = details["to"]
            target_model = details["model"][:6]
            graph.add_edge(node_id, target_model)

        if event == "message_received" and "from" in details:
            if graph.has_node(node_id):
                graph.remove_node(node_id)
            source_node = details["from"]
            target_model = details["model"][:6]
            graph.add_edge(node_id, target_model)

    return graph

def update(frame, logs, ax):
    ax.clear()

    time_threshold = logs[frame]["timestamp"]
    graph = build_graph(logs, time_threshold)
    pos = nx.spring_layout(graph, k=0.7)

    fungus_nodes = [node for node in graph.nodes() if str(node).lower().startswith('fungus')]
    model_nodes = [node for node in graph.nodes() if not str(node).lower().startswith('fungus')]
    nx.draw(graph, pos, with_labels=True, nodelist=fungus_nodes, node_color='sandybrown', edge_color='gray', node_size=1000, font_size=10, ax=ax)
    nx.draw(graph, pos, with_labels=False, nodelist=model_nodes, node_color='purple', edge_color='gray', node_size=3000, font_size=1, ax=ax)

    ax.set_title(f"Mycelial Web Learning Groups at {time_threshold}")

def animate_graph(logs, output_file="animation.gif"):
    fig, ax = plt.subplots(figsize=(8, 6))
    ani = animation.FuncAnimation(fig, update, frames=len(logs), fargs=(logs, ax), interval=500)

    # Save as GIF using Pillow (PIL)
    ani.save(output_file, writer="pillow", fps=1)
    print(f"Animation saved as {output_file}")

if __name__ == "__main__":
    log_file = "logs.json"
    logs = load_logs(log_file)
    animate_graph(logs)
