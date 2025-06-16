// email-service/index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sgMail = require('@sendgrid/mail');
const app = express();

// Environment variables (will be set on the hosting platform)
const PORT = process.env.PORT || 3000;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://kenyaonabudgetsafaris.co.uk').split(',');
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'your-secret-key-here';

// Initialize SendGrid
sgMail.setApiKey(SENDGRID_API_KEY);

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
    const { to, subject, html, cc, from, emailType } = req.body;
    
    // Basic validation
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields (to, subject, html)' 
      });
    }
    
    // Create email message
    const msg = {
      to,
      from: from || 'info@kenyaonabudgetsafaris.co.uk', // Default sender
      subject,
      html,
    };
    
    // Add CC if provided
    if (cc && Array.isArray(cc) && cc.length > 0) {
      msg.cc = cc;
    }
    
    // Send email
    await sgMail.send(msg);
    
    // Log email (optional)
    console.log(`Email sent: ${subject} to ${to} (${emailType || 'general'})`);
    
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Clean error message for response
    const errorMessage = error.response ? 
      `SendGrid error (${error.code}): ${JSON.stringify(error.response.body)}` : 
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