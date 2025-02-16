import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherBots, setOtherBots] = useState([]);

  // Function to send a message and fetch recommendations
  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      // Add user message to chat
      const userMessage = { sender: 'user', text: newMessage };
      setMessages([...messages, userMessage]);

      try {
        // Send a GET request to the backend for recommendations
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        console.log("backendPort: " + backendPort);
        const response = await axios.get('http://127.0.0.1:' + backendPort + '/recommend', {
          params: { song_name: newMessage },
        });

        const recommendations = response.data.recommendations || [];
        const botMessage = {
          sender: 'bot',
          text: `Recommendations for "${newMessage}": ${recommendations}`,
        };

        // Add the bot response to the chat
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        const botMessage = {
          sender: 'bot',
          text: 'Sorry, there was an error fetching recommendations.',
        };

        // Add the error message to the chat
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      }

      // Clear the input field
      setNewMessage('');
    }
  };

  // Load other bots configuration from backend
  useEffect(() => {
    const loadOtherBots = async () => {
      try {
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        const response = await axios.get(`http://127.0.0.1:${backendPort}/bots`);
        setOtherBots(response.data.bots);
      } catch (error) {
        console.error('Error loading other bots:', error);
        // Default to original hardcoded values if API fails
        setOtherBots([
          { name: 'Fungi 1', url: 'http://localhost:3000' },
          { name: 'Fungi 2', url: 'http://localhost:3001' }
        ]);
      }
    };

    loadOtherBots();
  }, []);

  // Handle Enter key press to send a message
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-box">
        <div className="chat-title">
          <h1>Music Recommendation Bot</h1>
          <div>
            <p>Other bots:</p>
            {otherBots.map((bot, index) => (
              <span key={index}>
                <a href={bot.url}>{bot.name}</a>
                {index < otherBots.length - 1 && '\u00A0'}
              </span>
            ))}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.sender === 'user' ? 'user' : 'bot'}`}
            >
              {message.text}
            </div>
          ))}
        </div>

        {/* Input Field */}
        <div className="input-container">
          <input
            type="text"
            className="message-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a song name..."
          />
          <button className="send-button" onClick={handleSendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
