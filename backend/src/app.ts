import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json()); // Parse incoming JSON requests

const PORT = process.env.PORT || 3000;
const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
const DOMAIN = `http://${SERVER_NAME}:${PORT}`;
const PEER_SERVER = process.env.PEER_SERVER || null;
const PEER_SERVER_NAME = process.env.PEER_SERVER_NAME || null;
const followers = new Set(); // Store the followers

// Helper function to generate an 'Accept' activity
const createAcceptActivity = (actorUri, followActivity) => {
    return {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Accept",
        actor: actorUri,
        object: followActivity,
    };
};

// Endpoint to receive follow requests
app.post(`/users/${SERVER_NAME}/inbox`, async (req, res) => {
    const followActivity = req.body;

    // Basic validation of the Follow activity
    if (
        followActivity.type !== "Follow" ||
        !followActivity.actor ||
        !followActivity.object
    ) {
        return res.status(400).json({ error: "Invalid Follow Activity" });
    }

    const actor = followActivity.actor; // The user who is following
    const followedUser = followActivity.object; // The user being followed

    console.log(`${actor} is following ${followedUser}`);

    // Check if the user being followed matches the current server
    if (followedUser === `${DOMAIN}/users/${SERVER_NAME}`) {
        followers.add(actor); // Add to followers set

        // Send an Accept activity
        const acceptActivity = createAcceptActivity(followedUser, followActivity);
        res.status(200).json(acceptActivity);
    } else {
        res.status(404).json({ error: "User not found" });
    }
});

// Endpoint to view the list of followers (for testing)
app.get("/followers", (req, res) => {
    res.json(Array.from(followers));
});

// Endpoint to view the current server user profile
app.get(`/users/${SERVER_NAME}`, (req, res) => {
    res.json({
        id: `${DOMAIN}/users/${SERVER_NAME}`,
        type: "Person",
        name: `${SERVER_NAME} User`,
        summary: `A demo federated user for ${SERVER_NAME}.`,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on ${DOMAIN}`);
});

const sendFollowRequest = async () => {
    const SERVER_NAME = process.env.FEDIFY_SERVER_NAME || 'server1';
    const DOMAIN = `http://${SERVER_NAME}:${process.env.PORT || 3000}`;
    const PEER_SERVER = process.env.PEER_SERVER || null;
    const PEER_SERVER_NAME = process.env.PEER_SERVER_NAME || null;

    if (!PEER_SERVER || !PEER_SERVER_NAME) {
        console.error("Peer server or peer server name not set. Cannot send follow request.");
        return;
    }

    const targetServerUrl = PEER_SERVER; // The server you are following
    const targetUser = PEER_SERVER_NAME; // The user you're trying to follow
    const actor = `${DOMAIN}/users/${SERVER_NAME}`; // Your server as the actor (following)

    // Follow activity payload
    const followActivity = {
        "@context": "https://www.w3.org/ns/activitystreams",
        type: "Follow",
        actor: actor,
        object: `${targetServerUrl}/users/${targetUser}`,
    };

    try {
        const response = await fetch(`${targetServerUrl}/users/${targetUser}/inbox`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(followActivity),
        });

        if (response.ok) {
            console.log("Follow request sent successfully!");
            const responseData = await response.json();
            console.log("Server's response:", responseData);
        } else {
            console.error("Error sending follow request:", response.statusText);
        }
    } catch (error) {
        console.error("Failed to send follow request:", error);
    }
};

// Trigger the follow request
setTimeout(
    function() {
        sendFollowRequest();
    }, randomIntFromInterval(1000, 5000));

function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
