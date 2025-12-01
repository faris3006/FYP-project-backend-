const sgMail = require('@sendgrid/mail');

// SendGrid Configuration
const emailConfig = {
  apiKey: process.env.SENDGRID_API_KEY || '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',
  fromEmail: process.env.EMAIL_FROM || 'mankulim625@gmail.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Booking System'
};

// Initialize SendGrid with API key
const initializeSendGrid = () => {
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
