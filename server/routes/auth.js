import { sendWelcomeEmail } from '../utils/emailService.js';

// In your registration route handler
app.post('/register', async (req, res) => {
  try {
    // ... user creation logic ...
    
    // Send welcome email
    await sendWelcomeEmail(user.email, user.username);
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}); 