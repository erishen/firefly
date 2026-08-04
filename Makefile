# firefly 数字人 Demo —— 开发 / 构建 / Vercel 部署 一键命令
# 部署：Vercel（vercel.json + api/ Serverless Functions）
# 首次部署前请先：npx vercel login

.PHONY: help install dev build preview deploy-vercel deploy-prod clean

help:
	@echo "firefly 常用命令："
	@echo "  make install          安装依赖"
	@echo "  make dev              启动本地开发服务器 (Vite :5174 + 本地代理 :8787)"
	@echo "  make build            构建前端静态产物到 dist/"
	@echo "  make preview          本地预览构建产物"
	@echo "  make deploy-vercel    部署到 Vercel 预览环境 (npx vercel deploy)"
	@echo "  make deploy-prod      部署到 Vercel 生产环境 (npx vercel deploy --prod)"
	@echo "  make clean            清理 dist/ 与 vite 缓存"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

deploy-vercel:
	npx vercel deploy

deploy-prod:
	npx vercel deploy --prod

clean:
	rm -rf dist node_modules/.vite
