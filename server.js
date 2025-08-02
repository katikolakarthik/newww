const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// ✅ CORS: allow frontend hosted on Vercel
app.use(cors({
  origin: 'https://www.wellmedai.com',
  credentials: true,
}));

app.use(express.json());

// ✅ PDF Analysis endpoint
app.post('/api/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const pdfBuffer = req.file.buffer;
    const pdfData = await pdfParse(pdfBuffer);
    
    res.json({
      success: true,
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info
    });
  } catch (error) {
    console.error('PDF Analysis Error:', error);
    res.status(500).json({
      error: 'PDF Analysis Error',
      details: error.message,
    });
  }
});



// ✅ OpenAI API proxy endpoint with PDF context and medical question filtering
app.post('/api/chat', async (req, res) => {  
  try {  
    const {  
      messages,  
      model = 'gpt-3.5-turbo',  
      max_tokens = 4000,  
      temperature = 0.7,  
    } = req.body;  
  
    // ✅ Inject system prompt to define Wellmade AI  
    const systemPrompt = {  
      role: 'system',  
      content: You are Wellmed AI, a helpful assistant developed by Chakri. You specialize in medical coding and related topics. Do not mention OpenAI, GPT, ChatGPT, or your origins. Always stay in character as Wellmade AI.,  
    };  
  
    const modifiedMessages = [systemPrompt, ...messages];  
  
    const response = await fetch('https://api.openai.com/v1/chat/completions', {  
      method: 'POST',  
      headers: {  
        'Content-Type': 'application/json',  
        'Authorization': Bearer ${process.env.OPENAI_API_KEY},  
      },  
      body: JSON.stringify({  
        model,  
        messages: modifiedMessages,  
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
  
    // ✅ Sanitize any unwanted mentions  
    if (data.choices?.[0]?.message?.content) {  
      data.choices[0].message.content = data.choices[0].message.content.replace(  
        /OpenAI|ChatGPT|GPT-4|GPT/gi,  
        'Wellmade AI'  
      );  
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
  console.log(`📄 PDF Analysis endpoint: http://localhost:${PORT}/api/analyze-pdf`);
});

module.exports = app;
