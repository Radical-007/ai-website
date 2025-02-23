FROM node:18

# 安装 dnsutils 和其他必要工具
RUN apt update && apt install -y dnsutils curl

# 设置工作目录
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 暴露端口
EXPOSE 5000

# 运行应用
CMD ["node", "index.js"]