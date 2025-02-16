import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

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
            <a href="http://localhost:3000">Fungi 1</a>
            &nbsp;<a href="http://localhost:3001">Fungi 2</a>
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
