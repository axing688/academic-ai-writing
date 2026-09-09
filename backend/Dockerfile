# 构建阶段
FROM golang:1.21-alpine AS builder

# 国内网络优化：Go 模块代理
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

RUN apk add --no-cache git

# 先复制 go.mod 下载依赖（利用 Docker 层缓存）
COPY go.mod ./
RUN go mod download

# 复制源代码并生成 go.sum 后构建
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/server/main.go

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
