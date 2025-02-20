import dotenv from 'dotenv';
import { gmailTransporter } from '../config/emailConfig.js';

// Configure dotenv at the start
dotenv.config();

// Debug: Print environment variables (but hide full password)
console.log('Environment variables loaded:', {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '***exists***' : 'missing',
  EMAIL_FROM: process.env.EMAIL_FROM
});

const sendTestEmail = async () => {
  try {
    const info = await gmailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: 'bencleek@yahoo.com',
      subject: 'Test Email from buSk',
      text: 'This is a test email from the busk-broadcaster application.',
      html: '<h1>Hello!</h1><p>This is a test email from the busk-broadcaster application.</p>',
    });
    
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Run the test
sendTestEmail();

export { sendTestEmail }; 