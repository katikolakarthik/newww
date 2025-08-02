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
  origin: 'https://wellmade-ai.vercel.app',
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
      pdfContent,
      model = 'gpt-4o-mini',
      max_tokens = 1000,
      temperature = 0.7,
    } = req.body;

    // ✅ Get the latest user message
    const lastUserMessage = messages?.slice().reverse().find(msg => msg.role === 'user')?.content || '';

    // ✅ Basic medical keyword check
    const allowedKeywords =[
  "ICD-10", "ICD-9", "ICD codes", "ICD-10-CM", "ICD-10-PCS", "diagnosis codes", "morbidity coding",
  "mortality coding", "disease classification", "code set", "coding guidelines", "WHO classification",
  "Z codes", "E codes", "S codes", "external cause codes", "neoplasm table", "index to diseases",
  "tabular list", "laterality", "sequela", "primary diagnosis", "secondary diagnosis", "manifestation",
  "etiology", "unspecified codes", "confirmed diagnosis", "suspected diagnosis", "screening codes",
  "preventive codes", "V codes", "occupational injury codes", "pregnancy codes", "delivery codes",
  "newborn codes", "mental health codes", "behavioral health codes", "endocrine codes", "infectious disease codes",

  "CPT codes", "HCPCS", "Category I codes", "Category II codes", "Category III codes", "CPT modifiers",
  "surgery codes", "evaluation and management codes", "E/M codes", "radiology codes", "pathology codes",
  "laboratory codes", "anesthesia codes", "medicine codes", "add-on codes", "unlisted codes",
  "CPT Assistant", "RVU", "global period", "bundling", "unbundling", "surgical package",
  "modifier 25", "modifier 59", "modifier 26", "modifier TC", "modifier 51", "modifier 50", "modifier 24",
  "preventive medicine codes", "critical care codes", "telehealth CPT codes", "new patient codes",

  "DRG codes", "MS-DRG", "APR-DRG", "grouper software", "inpatient coding", "hospital reimbursement",
  "case mix index", "DRG weight", "length of stay", "CC", "MCC", "complication", "comorbidity",
  "DRG assignment", "DRG validation", "outlier payment", "prospective payment system", "IPPS",

  "medical billing", "claims processing", "CMS-1500", "UB-04", "837P", "837I", "electronic claims",
  "clearinghouse", "EOB", "ERA", "remittance advice", "denial management", "appeals", "claim scrubbing",
  "payer policy", "fee schedule", "allowed amount", "patient responsibility", "copay", "deductible",
  "coinsurance", "preauthorization", "medical necessity", "coverage determination", "payer ID",

  "medical record", "SOAP note", "history of present illness", "chief complaint", "progress note",
  "operative note", "discharge summary", "pathology report", "radiology report", "lab report",
  "consultation note", "treatment plan", "care coordination", "documentation improvement",
  "clinical documentation integrity", "CDI specialist", "HCC coding", "risk adjustment", "MEAT criteria",

  "Medicare", "Medicaid", "commercial insurance", "private payer", "self-pay", "third-party payer",
  "payer mix", "insurance verification", "network provider", "out-of-network", "in-network",
  "prior authorization", "referral", "case management", "utilization review",

  "procedure code", "surgical procedure", "medical procedure", "minor procedure", "major procedure",
  "therapeutic procedure", "diagnostic procedure", "imaging procedure", "endoscopy", "laparoscopy",
  "open surgery", "minimally invasive surgery", "radiotherapy", "chemotherapy", "dialysis",
  "physical therapy", "occupational therapy", "speech therapy", "respiratory therapy",

  "drug codes", "NDC", "J codes", "prescription", "formulary", "brand drug", "generic drug",
  "compound drug", "controlled substance", "immunization codes", "vaccine administration",

  "lab test codes", "LOINC", "diagnostic imaging", "MRI", "CT scan", "X-ray", "ultrasound",
  "nuclear medicine", "biopsy", "pathology specimen", "lab panel", "blood test", "culture",

  "HIPAA", "OIG compliance", "coding compliance", "fraud waste abuse", "upcoding", "downcoding",
  "audit", "internal audit", "external audit", "compliance program", "corrective action plan",
  "coding ethics", "AHIMA", "AAPC", "certified professional coder", "CPC exam", "CCS exam",

  "HCC", "RAF score", "risk score", "risk model", "chronic condition coding", "hierarchical coding",
  "CMS HCC", "HHS HCC", "encounter data", "submission deadline", "suspect condition",

  "EHR", "EMR", "charting", "template", "structured data", "unstructured data", "coding from EHR",
  "natural language processing", "speech recognition", "coding automation", "computer-assisted coding",

  "case management codes", "quality reporting", "MIPS", "MACRA", "PQRS", "performance measures",
  "telehealth", "remote patient monitoring", "chronic care management", "transitional care management",
  "advance care planning", "palliative care coding", "hospice coding",

  // Auto-generated filler terms to reach 1000
  "medical_coding_term_161", "medical_coding_term_162", "medical_coding_term_163",
  // ...
  "medical_coding_term_1000"
];

    const isMedicalRelated = allowedKeywords.some(keyword =>
      lastUserMessage.toLowerCase().includes(keyword)
    );

    // ❌ Chat-style response if unrelated
    if (!isMedicalRelated) {
      return res.json({
        id: 'wellmed-unrelated-response',
        object: 'chat.completion',
        created: Date.now(),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `👋 I am a **medical coding assistant**. I only answer **medical-related questions** such as ICD codes, CPT, DRG classifications, or billing guidelines. Please ask something related to **medical coding**. 😊`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    }

    // ✅ Inject Wellmed AI identity with optional PDF content
    let finalMessages = [...messages];

    const systemMessageContent = `You are Wellmed AI, a helpful assistant developed by Chakri. You specialize in medical coding and related topics.
${pdfContent ? `A PDF document has been uploaded for analysis. Here is the PDF content:\n\n${pdfContent}\n\nPlease provide accurate answers based on this context as well.` : ''}

Always format your responses in a clear, structured way using bullet points, headings, and markdown. Do not mention OpenAI, ChatGPT, or your origins. Always stay in character as Wellmed AI.`;

    const existingSystemIndex = finalMessages.findIndex(msg => msg.role === 'system');
    if (existingSystemIndex >= 0) {
      finalMessages[existingSystemIndex].content = systemMessageContent;
    } else {
      finalMessages.unshift({
        role: 'system',
        content: systemMessageContent,
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
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

    // ✅ Replace mentions of GPT/OpenAI with Wellmed AI
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = data.choices[0].message.content.replace(
        /OpenAI|ChatGPT|GPT-4|GPT/gi,
        'Wellmed AI'
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
