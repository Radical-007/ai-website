const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // 建议使用 bcrypt 加密（这里简化为明文）
});

module.exports = mongoose.model('User', UserSchema);