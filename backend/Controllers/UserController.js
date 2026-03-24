const express = require("express")
const router = express.Router();
const User = require("../models/User")

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const user = new User({ username, password });
    await user.save();

    const safeUser = { id: user._id, username: user.username };
    res.status(201).json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const safeUser = { id: user._id, username: user.username };
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router

