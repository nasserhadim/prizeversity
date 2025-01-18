import User from '../models/User.js';

export const selectRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.user._id);
    user.globalRole = role;
    await user.save();

    res.json({ success: true, role: user.globalRole });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
