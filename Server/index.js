const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(express.json());

// 连接云端 MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('云端 MongoDB 连接成功'))
  .catch(err => console.error('MongoDB 连接失败:', err));

// 引入模型
const User = require('./UserSchema');
const Chat = require('./ChatSchema');

// 注册接口
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = new User({ email, password }); // 建议用 bcrypt 加密密码
    await user.save();
    res.status(201).send('注册成功');
  } catch (error) {
    if (error.name === 'MongoError' && error.code === 11000) {
      res.status(400).send('邮箱已存在');
    } else {
      res.status(400).send('注册失败：' + error.message);
    }
  }
});

// 登录接口
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(400).send('邮箱或密码错误');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).send('登录失败：' + error.message);
  }
});

// 保存或更新聊天记录
app.post('/chat', async (req, res) => {
  const { message, model } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('未授权');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, messages: [] });
    }

    chat.messages.push({ role: 'user', content: message });
    await chat.save();

    let response;
    try {
      if (model === 'wenxin') {
        const result = await axios.post('文心一言API地址', {
          prompt: message,
          history: chat.messages.map(msg => ({ role: msg.role, content: msg.content })),
        }, {
          headers: { 'Authorization': `Bearer ${process.env.WENXIN_API_KEY}` }
        });
        response = result.data.reply || result.data;
      } else if (model === 'deepseek') {
        // 实现 DeepSeek 的调用
        response = 'DeepSeek 回复（需实现）';
      } else if (model === 'tongyi') {
        // 实现通义的调用
        response = '通义回复（需实现）';
      }
    } catch (apiError) {
      throw new Error('AI 模型调用失败：' + apiError.message);
    }

    chat.messages.push({ role: 'ai', content: response });
    await chat.save();

    res.json({ reply: response });
  } catch (error) {
    res.status(500).send('聊天失败：' + error.message);
  }
});

// 获取聊天记录
app.get('/chat/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('未授权');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const chat = await Chat.findOne({ userId });
    if (!chat) return res.json({ messages: [] });

    res.json({ messages: chat.messages });
  } catch (error) {
    res.status(500).send('获取历史记录失败：' + error.message);
  }
});

// 删除单条聊天记录
app.delete('/chat/message/:messageId', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('未授权');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const messageId = req.params.messageId;

    const chat = await Chat.findOne({ userId });
    if (!chat) return res.status(404).send('聊天记录不存在');

    const messageIndex = chat.messages.findIndex(msg => msg._id.toString() === messageId);
    if (messageIndex === -1) return res.status(404).send('消息不存在');

    chat.messages.splice(messageIndex, 1);
    await chat.save();

    res.send('删除成功');
  } catch (error) {
    res.status(500).send('删除失败：' + error.message);
  }
});

// 删除所有聊天记录
app.delete('/chat/history', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('未授权');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    await Chat.deleteOne({ userId });
    res.send('所有聊天记录删除成功');
  } catch (error) {
    res.status(500).send('删除失败：' + error.message);
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('服务器错误：' + err.message);
});

// 启动服务器
app.listen(process.env.PORT, () => {
  console.log(`后端运行在端口 ${process.env.PORT}`);
});