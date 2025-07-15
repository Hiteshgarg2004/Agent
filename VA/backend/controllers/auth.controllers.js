import genToken from "../config/token.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

// ✅ SIGN UP
export const signUp = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existEmail = await User.findOne({ email });
    if (existEmail) {
      return res.status(400).json({ message: "Email already exists!" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = genToken(user._id); // genToken likely returns synchronously

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
      secure: false, // set to true in production with HTTPS
    });

    return res.status(201).json(user); // You may exclude password in frontend
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ message: `Signup error: ${error.message}` });
  }
};

// ✅ LOGIN
export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email does not exist!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password!" });
    }

    const token = genToken(user._id);

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
      secure: false, // true in production
    });

    return res.status(200).json(user); // Consider using .select("-password") if needed
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: `Login error: ${error.message}` });
  }
};

// ✅ LOGOUT
export const logOut = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
    });
    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ message: `Logout error: ${error.message}` });
  }
};
