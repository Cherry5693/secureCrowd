const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { verifyOrganizer } = require('../middleware/auth')
const { sendVerificationOTP } = require('../services/emailService')
const {sendResetPasswordLink} = require("../services/resetPasswordEmail")

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )

// POST /api/users/register  (organizer account)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Username, email, and password are required' })

    const existingUsername = await User.findOne({ username })
    if (existingUsername) return res.status(409).json({ error: 'Username already taken' })

    const existingEmail = await User.findOne({ email })
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 12)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Sign a temporary registration token (valid for 15 mins) - Stateless setup
    const registrationToken = jwt.sign(
      { username, email, password: hashed, role: 'organizer', verificationCode },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    // FIRE AND FORGET: Background email api call
    sendVerificationOTP(email, verificationCode, username).catch(err => {
      console.error('[Background Email Error]', err)
    })

    res.status(201).json({
      message: 'Registration successful. Check your email for the verification code.',
      requiresVerification: true,
      registrationToken,
      username
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' })

    const user = await User.findOne({ username })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ error: 'Invalid credentials' })

    // Check email verification for organizers
    if (user.role === 'organizer' && !user.isEmailVerified) {
      if (!user.verificationCode) {
         // Fallback if somehow registered without OTP (e.g. legacy accounts)
         user.verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
         await user.save()
         sendVerificationOTP(user.email, user.verificationCode, user.username).catch(() => {})
      }
      return res.status(403).json({ 
        error: 'Email not verified', 
        requiresVerification: true, 
        username: user.username,
        email: user.email 
      })
    }

    const token = signToken(user)
    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/verify-email
router.post('/verify-email', async (req, res) => {
  try {
    const { code, registrationToken } = req.body
    
    // 1. Stateless Verification (New Registration Flow)
    if (registrationToken) {
      if (!code) return res.status(400).json({ error: 'Verification code is required' })
      let decoded
      try {
        decoded = jwt.verify(registrationToken, process.env.JWT_SECRET)
      } catch(err) {
        return res.status(400).json({ error: 'Registration token expired or invalid. Please register again.' })
      }
      
      if (decoded.verificationCode !== code) {
        return res.status(400).json({ error: 'Invalid verification code' })
      }
      
      // Verification successful, create the user NOW!
      const user = await User.create({
        username: decoded.username,
        email: decoded.email,
        password: decoded.password,
        role: decoded.role,
        isEmailVerified: true
      })
      
      const token = signToken(user)
      return res.status(201).json({
        message: 'Account created and email verified successfully',
        token,
        user: { id: user._id, username: user.username, email: user.email, role: user.role }
      })
    }
    
    // 2. Stateful Verification (Login Intercepted flow for existing legacy unverified users)
    const username = req.body.username
    if (!username || !code)
      return res.status(400).json({ error: 'Provide a registration token, or username and code' })

    const user = await User.findOne({ username })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.isEmailVerified) {
      const token = signToken(user)
      return res.json({ token, user: { id: user._id, username: user.username, role: user.role } })
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    // Verify
    user.isEmailVerified = true
    user.verificationCode = undefined
    await user.save()

    const token = signToken(user)
    res.json({
      message: 'Email verified successfully',
      token,
      user: { id: user._id, username: user.username, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { username, registrationToken } = req.body
    
    if (registrationToken) {
       let decoded;
       try { decoded = jwt.verify(registrationToken, process.env.JWT_SECRET) }
       catch(e) { return res.status(400).json({ error: 'Registration session expired. Please register again.' }) }
       
       const newCode = Math.floor(100000 + Math.random() * 900000).toString()
       const newRegistrationToken = jwt.sign(
         { ...decoded, verificationCode: newCode },
         process.env.JWT_SECRET,
         { expiresIn: '15m' }
       )
       
       sendVerificationOTP(decoded.email, newCode, decoded.username).catch(err => {
         console.error('[Background Email Error]', err)
       })
       
       return res.json({ message: 'New code sent', registrationToken: newRegistrationToken })
    }
    
    // Legacy flow
    if (!username) return res.status(400).json({ error: 'Username or token is required' })

    const user = await User.findOne({ username })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (user.isEmailVerified) return res.status(400).json({ error: 'Email is already verified' })

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    user.verificationCode = verificationCode
    await user.save()

    // Async send
    sendVerificationOTP(user.email, verificationCode, user.username).catch(err => {
      console.error('[Background Email Error]', err)
    })

    res.json({ message: 'A new verification code has been sent to your email' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── SECURITY TEAM MANAGEMENT (ORGANIZER ONLY) ──────────────────────────────

// GET /api/users/security  — list all global security guards
router.get('/security', verifyOrganizer, async (req, res) => {
  try {
    const guards = await User.find({ role: 'security' }).select('-password').sort({ createdAt: -1 })
    res.json(guards)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users/security  — create a new security guard account
router.post('/security', verifyOrganizer, async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' })

    const existing = await User.findOne({ username })
    if (existing) return res.status(409).json({ error: 'Username already taken' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await User.create({ username, password: hashed, role: 'security' })

    res.status(201).json({ id: user._id, username: user.username, role: user.role, createdAt: user.createdAt })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/users/security/:id  — delete a security guard account
router.delete('/security/:id', verifyOrganizer, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, role: 'security' })
    if (!user) return res.status(404).json({ error: 'Security guard not found' })

    res.json({ message: 'Security guard removed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/reset-password', verifyOrganizer, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = await bcrypt.compare(oldPassword, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;

    await user.save();

    res.status(200).json({ message: "Password updated successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Validate input
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // 2. Find user
    const user = await User.findOne({ email });

    // 3. Always send same response (prevent user enumeration)
    const genericResponse = {
      message: "If an account with that email exists, a reset link has been sent.",
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // 4. Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 5. Hash token before saving
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 6. Save token + expiry (15 mins)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save();


    // 7. Reset URL (dynamic for production)
    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    sendResetPasswordLink(user.email, user.username, resetURL)
      .then(() => {
        console.log("Reset email sent");
      })
      .catch((err) => {
        console.error("Email send failed:", err.message);
      });
  

    return res.status(200).json(genericResponse);


  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.patch("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // 1. Validate input
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    // 2. Hash token (same way as stored)
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 3. Find user with valid token + not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // 4. Update password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;

    // 5. Clear reset fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      message: "Password reset successful. You can now log in.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router
