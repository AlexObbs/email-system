const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const app = express();

// Environment variables (will be set on the hosting platform)
const PORT = process.env.PORT || 3000;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://kenyaonabudgetsafaris.co.uk').split(',');
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'your-secret-key-here';

// Initialize Brevo
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = BREVO_API_KEY;

// Middleware
app.use(bodyParser.json());

// Custom CORS middleware with origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
};

// Routes
app.post('/send-email', validateApiKey, async (req, res) => {
  try {
    const { to, subject, html, cc, from, name, emailType } = req.body;
    
    // Basic validation
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields (to, subject, html)' 
      });
    }
    
    // Create a new API instance
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    // Setup email sender
    const sender = {
      email: from || 'info@kenyaonabudgetsafaris.co.uk',
      name: name || 'KenyaOnABudget Safaris'
    };
    
    // Setup email recipients
    const recipients = [{ email: to }];
    
    // Add CC recipients if provided
    const ccRecipients = [];
    if (cc && Array.isArray(cc) && cc.length > 0) {
      cc.forEach(ccEmail => {
        ccRecipients.push({ email: ccEmail });
      });
    }
    
    // Create send email request
    const sendEmailRequest = {
      sender,
      to: recipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject,
      htmlContent: html
    };
    
    // Send email
    const data = await apiInstance.sendTransacEmail(sendEmailRequest);
    
    // Log email (optional)
    console.log(`Email sent: ${subject} to ${to} (${emailType || 'general'})`);
    
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      data
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Clean error message for response
    const errorMessage = error.response ? 
      `Brevo error: ${JSON.stringify(error.response.text)}` : 
      error.message;
    
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'up', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
});