# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 国内网络优化：npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制依赖清单并安装（利用 Docker 层缓存）
COPY package*.json ./
RUN npm install --no-audit --no-fund

# 复制源代码并构建
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine

# 复制构建产物到 nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置文件
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
