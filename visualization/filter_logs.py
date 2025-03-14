import json
import re
from datetime import datetime

def read_logs(input_file):
    """
    Read all log entries from a file, skip invalid JSON lines,
    and remove leading non-JSON parts while validating timestamps.
    """
    logs = []
    with open(input_file, 'r') as infile:
        for line in infile:
            line = line.strip()

            if not line:
                continue

            # Extract timestamp and validate format
            match = re.match(r'^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3})\s-\sINFO\s-\s', line)

            if not match:
                print(f"Skipping invalid log format: {line}")
                continue

            # Extract JSON part and convert quotes for valid parsing
            json_part = line[match.end():].strip().replace("'", '"')

            try:
                log_entry = json.loads(json_part)
                logs.append(log_entry)
            except json.JSONDecodeError as e:
                print(f"Skipping invalid JSON line: {json_part}\nError: {e}")
    return logs

def filter_logs(logs):
    """Filter logs to keep only message_sent and message_received entries with the correct details."""
    filtered_logs = []

    for log in logs:
        # Check if node_id, event, and timestamp exist
        node_id = log.get("node_id")
        event = log.get("event")
        details = log.get("details", {})
        timestamp = log.get("timestamp")

        # Ensure the log has the necessary fields
        if not all([node_id, event, timestamp]):
            continue

        # Check the event type and ensure the correct detail field exists
        if event == "message_sent" and "to" in details:
            filtered_logs.append(log)
        elif event == "message_received" and "from" in details:
            filtered_logs.append(log)

    return filtered_logs

def write_logs(output_file, logs):
    """Write filtered logs to an output file."""
    with open(output_file, 'w') as outfile:
        for log in logs:
            outfile.write(json.dumps(log) + "\n")

def main(input_file, output_file):
    """Main function to read, filter, and write logs."""
    logs = read_logs(input_file)  # Read logs from the input file
    filtered_logs = filter_logs(logs)  # Filter the logs based on criteria
    write_logs(output_file, filtered_logs)  # Write the filtered logs to the output file

if __name__ == "__main__":
    input_file = "logs.json"  # Name of the input file with all logs
    output_file = "filtered_logs.txt"  # Name of the output file for filtered logs

    main(input_file, output_file)
    print(f"Filtered logs have been written to {output_file}")
