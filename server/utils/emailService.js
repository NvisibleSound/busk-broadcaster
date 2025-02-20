import { smtpTransporter } from '../config/emailConfig.js';

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await smtpTransporter.sendMail({
      from: process.env.EMAIL_FROM, // '"BuSK Support" <support@buskplayer.com>'
      to,
      subject,
      html,
    });
    
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Example template function
export const sendWelcomeEmail = async (userEmail, username) => {
  const subject = 'Welcome to BuSK!';
  const html = `
    <h1>Welcome to BuSK, ${username}!</h1>
    <p>We're excited to have you on board.</p>
    <p>Get started by...</p>
  `;
  
  return sendEmail({ to: userEmail, subject, html });
}; 