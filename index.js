const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const SibApiV3Sdk = require('sib-api-v3-sdk');
const app = express();

// Environment variables
const PORT = process.env.PORT || 3000;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'thiswillbesecretkey45';

// Parse allowed origins from environment variable or use defaults
let allowedOriginsFromEnv = (process.env.ALLOWED_ORIGINS || '').split(',');
// Clean up any trailing/leading whitespace and remove empty strings
allowedOriginsFromEnv = allowedOriginsFromEnv
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0);

// Ensure we have a comprehensive list of allowed origins
const ALLOWED_ORIGINS = [
  'https://kenyaonabudgetsafaris.co.uk',
  'https://www.kenyaonabudgetsafaris.co.uk',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:3000',
  ...allowedOriginsFromEnv
].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

console.log('Server starting...');
console.log('Allowed origins:', ALLOWED_ORIGINS);

// Initialize Brevo
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = BREVO_API_KEY;

// Middleware for logging all requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  console.log('  Origin:', req.headers.origin);
  console.log('  User-Agent:', req.headers['user-agent']);
  console.log('  Content-Type:', req.headers['content-type']);
  
  // Add timestamp to response for debugging
  res.setHeader('X-Server-Timestamp', timestamp);
  
  next();
});

// Body parsing middleware
app.use(bodyParser.json({limit: '1mb'}));

// CORS middleware - using the cors package with proper configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      console.log('Request has no origin - allowing');
      return callback(null, true);
    }
    
    // Remove any trailing slashes from the origin
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    
    // Check if this origin is allowed
    if (ALLOWED_ORIGINS.includes(cleanOrigin)) {
      console.log(`Origin ${cleanOrigin} is allowed by CORS policy`);
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      console.log(`Development mode: allowing origin ${cleanOrigin}`);
      return callback(null, true);
    }
    
    // If we get here, the origin is not allowed
    console.log(`Origin ${cleanOrigin} is NOT allowed by CORS policy`);
    callback(new Error(`Origin ${cleanOrigin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Additional OPTIONS handler for extra safety
app.options('*', cors());

// API key validation middleware with detailed logging
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  console.log('API Key validation:', apiKey ? 'Key provided' : 'No key provided');
  
  if (!apiKey) {
    console.log('Authentication failed: No API key provided');
    return res.status(401).json({ 
      error: 'Unauthorized: API key is required',
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
  
  if (apiKey !== API_SECRET_KEY) {
    console.log('Authentication failed: Invalid API key');
    return res.status(401).json({ 
      error: 'Unauthorized: Invalid API key',
      status: 'error',
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('API Key validation successful');
  next();
};

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  console.log('CORS test endpoint called');
  res.json({ 
    message: 'CORS is working correctly!', 
    origin: req.headers.origin || 'No origin',
    timestamp: new Date().toISOString(),
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin') || 'Not set',
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods') || 'Not set',
      'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers') || 'Not set'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'up',
    timestamp: new Date().toISOString(),
    service: 'Email Service',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    corsSettings: {
      allowedOrigins: ALLOWED_ORIGINS
    }
  };
  
  console.log('Health check responded with:', healthData);
  res.status(200).json(healthData);
});

// Email sending endpoint
app.post('/send-email', validateApiKey, async (req, res) => {
  console.log('Email request received', {
    time: new Date().toISOString(),
    origin: req.headers.origin || 'No origin',
    contentType: req.headers['content-type']
  });
  
  try {
    const { to, subject, html, cc, from, name, emailType } = req.body;
    
    // Log request details (without sensitive content)
    console.log('Email request details:', {
      to: typeof to === 'string' ? to : 'Multiple recipients',
      subject,
      cc: cc ? 'Provided' : 'None',
      from: from || 'Default sender',
      name: name || 'Default name',
      emailType: emailType || 'general',
      htmlLength: html ? html.length : 0
    });
    
    // Basic validation
    if (!to || !subject || !html) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields (to, subject, html)',
        timestamp: new Date().toISOString()
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
    const recipients = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];
    
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
    
    console.log('Preparing to send email to Brevo');
    
    // Send email
    const data = await apiInstance.sendTransacEmail(sendEmailRequest);
    
    // Log success
    console.log(`Email sent successfully: ${subject} to ${to} (${emailType || 'general'})`);
    console.log('Brevo response:', data);
    
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Detailed error logging
    console.error('Error sending email:', error);
    
    let errorMessage;
    if (error.response) {
      try {
        errorMessage = `Brevo API error: ${JSON.stringify(error.response.text || error.response.body || 'Unknown API error')}`;
        console.error('Brevo API response error:', error.response);
      } catch (e) {
        errorMessage = `Brevo error: ${error.message}`;
        console.error('Error parsing Brevo error response:', e);
      }
    } else {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.method} ${req.url} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
  console.log(`Server environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
