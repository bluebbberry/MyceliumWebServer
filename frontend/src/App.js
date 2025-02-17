import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [fungusName, setFungusName] = useState('');
  const [modelInfo, setModelInfo] = useState(null);  // Model info (name and fungi that train it)
  const [allFungi, setAllFungi] = useState([]);     // All fungi known to the fungus

  // Fetch fungus name on component mount
  useEffect(() => {
    const fetchFungusName = async () => {
      try {
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        const response = await axios.get(`http://127.0.0.1:${backendPort}/info`);
        setFungusName(response.data.info.name);
      } catch (error) {
        console.error('Error fetching fungus name:', error);
        setFungusName('Mystery Mushroom'); // Fallback name
      }
    };
    fetchFungusName();
  }, []);

  // Fetch model fungi and all fungi (from earlier trainings)
  useEffect(() => {
    const loadFungiData = async () => {
      try {
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        const response = await axios.get(`http://127.0.0.1:${backendPort}/fungi`);
        setModelInfo(response.data.model || null);  // Model info (name and fungi that train it)
        setAllFungi(response.data.allFungi || []);  // All fungi known to the fungus
      } catch (error) {
        console.error('Error loading fungi data:', error);
        setModelInfo(null);
        setAllFungi([]);
      }
    };

    loadFungiData();
  }, []);

  // Function to send a message and fetch recommendations
  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      // Add user message to chat
      const userMessage = { sender: 'user', text: newMessage };
      setMessages([...messages, userMessage]);

      try {
        // Send a GET request to the backend for recommendations
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        const response = await axios.get(`http://127.0.0.1:${backendPort}/recommend`, {
          params: { song_name: newMessage },
        });

        const recommendations = response.data.recommendations || [];
        const botMessage = {
          sender: 'bot',
          text: `Recommendations for "${newMessage}": ${recommendations.join(', ')}`,
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
    <div className="fungus-container">
      <div className="chat-box">
        {/* Chat Section */}
        <div className="chat-title">
          <h1>{fungusName}</h1>
          <h2>Music Recommendation Fungus</h2>

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

        {/* Fungi Sections */}
        <div className="fungus-section">
          {/* Model Fungi Section (First Line) */}
          {modelInfo && (
            <div className="model-line">
              <h3>Model: {modelInfo.name}</h3>
              <div className="fungus-list">
                {modelInfo.fungi.map((fungus, index) => (
                  <div key={index} className="fungus-card">
                    <div className="fungus-name">{fungus}</div>
                    {allFungi
                      .filter((f) => f.name === fungus)
                      .map((fungusData, idx) => (
                        <a key={idx} href={`http://localhost:${fungusData.port}`} target="_blank" rel="noopener noreferrer">
                          Visit
                        </a>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Fungi Section (Second Line) */}
          <div className="other-fungi-line">
            <h3>Other Fungi Your Fungus Knows About</h3>
            <div className="fungus-list">
              {allFungi.map((fungus, index) => (
                <div key={index} className="fungus-card">
                  <div className="fungus-name">{fungus.name}</div>
                  <a href={`http://localhost:${fungus.port}`} target="_blank" rel="noopener noreferrer">
                    Visit
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
