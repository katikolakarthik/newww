const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS: allow frontend hosted on Vercel
app.use(cors({
  origin: 'https://wellmade-ai.vercel.app',
  credentials: true,
}));

app.use(express.json());

// ✅ OpenAI API proxy endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      max_tokens = 1000,
      temperature = 0.7,
    } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API Error:', data);
      return res.status(response.status).json({
        error: 'OpenAI API Error',
        details: data.error?.message || 'Unknown error',
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

// ✅ Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ✅ No static frontend serving needed

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 CORS allowed from: https://wellmade-ai.vercel.app`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;