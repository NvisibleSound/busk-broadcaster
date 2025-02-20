import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Configure dotenv at the start
dotenv.config();

// Debug: Print environment variables (but hide full password)
console.log('Environment variables loaded:', {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '***exists***' : 'missing',
  EMAIL_FROM: process.env.EMAIL_FROM
});

// Option 1: Using Gmail (less secure, good for testing)
export const gmailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});