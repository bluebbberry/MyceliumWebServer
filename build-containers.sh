#!/bin/bash

# Loop through numbers 0 to 63
for i in {0..15}; do
    # Build the specific backend service
    docker compose -f docker-compose.16-nodes.yml build fungus-backend$i
done

# Loop through numbers 0 to 63
for i in {0..15}; do
    # Build the specific backend service
    docker compose -f docker-compose.16-nodes.yml build ap-backend$i
done
