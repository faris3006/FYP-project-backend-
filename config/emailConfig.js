const sgMail = require('@sendgrid/mail');

// SendGrid Configuration
const emailConfig = {
  apiKey: process.env.SENDGRID_API_KEY,
  fromEmail: process.env.EMAIL_FROM,
  fromName: process.env.EMAIL_FROM_NAME || 'Booking System'
};

// Initialize SendGrid with API key
const initializeSendGrid = () => {
  console.log('DEBUG: SENDGRID_API_KEY from env:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');
  console.log('DEBUG: emailConfig.apiKey:', emailConfig.apiKey ? 'SET' : 'NOT SET');

  if (!emailConfig.apiKey) {
    console.warn('SendGrid API key is not configured. Email sending will fail.');
    return false;
  }

  sgMail.setApiKey(emailConfig.apiKey);
  console.log('SendGrid initialized successfully');
  return true;
};

// Get configured SendGrid instance
const getSendGridClient = () => {
  return sgMail;
};

module.exports = {
  emailConfig,
  initializeSendGrid,
  getSendGridClient
};
