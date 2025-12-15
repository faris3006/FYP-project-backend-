const fetch = require('node-fetch');

/**
 * Verify Google reCAPTCHA v3 token
 * @param {string} token - reCAPTCHA token from frontend
 * @param {string} remoteIp - Client IP address (optional)
 * @returns {Promise<{success: boolean, score: number, action: string, message?: string}>}
 */
async function verifyRecaptcha(token, remoteIp = null) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.warn('⚠️  RECAPTCHA_SECRET_KEY not configured - skipping captcha validation');
    return { success: true, score: 1.0, action: 'login', message: 'Captcha disabled' };
  }

  if (!token) {
    return { success: false, score: 0, action: '', message: 'Captcha token is required' };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(remoteIp && { remoteip: remoteIp })
    });

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await response.json();

    if (!data.success) {
      console.log('reCAPTCHA verification failed:', data['error-codes']);
      return { 
        success: false, 
        score: 0, 
        action: '', 
        message: 'Captcha verification failed',
        errors: data['error-codes']
      };
    }

    // For v3, check score (0.0 to 1.0, higher is more likely human)
    // Recommended threshold: 0.5
    if (data.score < 0.5) {
      console.log('reCAPTCHA score too low:', data.score);
      return {
        success: false,
        score: data.score,
        action: data.action,
        message: 'Captcha score too low - suspected bot activity'
      };
    }

    return {
      success: true,
      score: data.score,
      action: data.action
    };

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    // In case of error, fail closed (reject the request)
    return { 
      success: false, 
      score: 0, 
      action: '', 
      message: 'Captcha verification error' 
    };
  }
}

module.exports = { verifyRecaptcha };
