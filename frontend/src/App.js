import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [fungusName, setFungusName] = useState('');
  const [modelInfo, setModelInfo] = useState(null);  // Model info (name and fungi that train it)
  const [allFungi, setAllFungi] = useState([]);     // All fungi known to the fungus
  const [profileImage, setProfileImage] = useState('');

  const socialUrl = process.env.REACT_APP_SOCIAL_URL;
  const semanticUrl = process.env.REACT_APP_SEMANTIC_URL;

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

  // Function to generate a psychedelic pattern from a code
  const generatePsychedelicImage = (code) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create a more dense pattern with overlapping shapes
    const stepSize = Math.max(10, 256 / Math.sqrt(code.length));

    for (let y = 0; y < canvas.height; y += stepSize) {
      for (let x = 0; x < canvas.width; x += stepSize) {
        const charIndex = (x + y) % code.length;
        const charCode = code.charCodeAt(charIndex);

        ctx.fillStyle = `hsl(${(charCode * 137.508) % 360}, 100%, 50%)`;
        ctx.beginPath();
        ctx.arc(
        x + stepSize / 2,
          y + stepSize / 2,
          (charCode % (stepSize / 2)) + stepSize / 4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    return canvas.toDataURL();
  };


  // Fetch random profile image code on mount
  useEffect(() => {
    const fetchProfileImageCode = async () => {
      try {
        const backendPort = process.env.REACT_APP_BACKEND_PORT;
        const response = await axios.get(`http://127.0.0.1:${backendPort}/random-profile`);
        const code = response.data.code;
        const image = generatePsychedelicImage(code);
        setProfileImage(image);
      } catch (error) {
        console.error('Error fetching random profile code:', error);
      }
    };
    fetchProfileImageCode();
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
          text: `I would recommend you ${recommendations}`,
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
        {/* Chat Section */}
        <div className="chat-title">
          <h1>{fungusName}</h1>
          <h3>Music Recommendation Fungus</h3>

          {/* Profile Image Section */}
          {profileImage && (
            <div className="profile-image-container">
              <img src={profileImage} alt="Profile" className="profile-image" />
            </div>
          )}

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
              <h3>Model: {modelInfo.name} - learning group:</h3>
              <div className="fungus-list">
                {modelInfo.fungi.map((fungus, index) => (
                  <div key={index} className="fungus-card">
                    <div className="fungus-name">{fungus}&nbsp;</div>
                    {allFungi
                      .filter((f) => f.name === fungus)
                      .map((fungusData, idx) => (
                        <a key={idx} href={`http://localhost:${fungusData.port}`}>
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
                  <div className="fungus-name">{fungus.name}&nbsp;</div>
                  <a href={`http://localhost:${fungus.port}`}>
                    Visit
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Dropdown Button for External Links */}
          <div className="dropdown">
            <button className="dropbtn">On other Webs</button>
              <div className="dropdown-content">
                <a href={socialUrl} target="_blank" rel="noopener noreferrer">Social</a>
                <a href={semanticUrl} target="_blank" rel="noopener noreferrer">Semantic</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
