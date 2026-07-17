# LAW_AI

Monorepo fullstack: **Next.js 14** (frontend) + **NestJS 10** (backend) + **TypeORM** + **PostgreSQL**, quản lý bằng **Turborepo** + **pnpm workspaces**.

## 📁 Cấu trúc

```
LAW_AI/
├── apps/
│   ├── backend/        # NestJS + TypeORM + REST API + JWT
│   └── frontend/       # Next.js (App Router) + Tailwind + shadcn/ui + NextAuth.js
├── packages/
│   ├── config/         # Shared tsconfig presets
│   ├── shared/         # Shared types + zod DTOs (FE↔BE)
│   └── ui/             # (reserved)
├── docker-compose.yml  # Postgres + 2 apps
└── turbo.json
```

## 🛠 Yêu cầu

- Node.js ≥ 20 ([`.nvmrc`](.nvmrc))
- pnpm ≥ 9 (`npm i -g pnpm`)
- Docker Desktop (chạy Postgres)

## 🚀 Setup lần đầu

```bash
# 1. Cài dependencies cho toàn bộ monorepo
pnpm install

# 2. Copy env files
cp .env.example apps/backend/.env
cp .env.example apps/frontend/.env.local
# (Windows PowerShell: Copy-Item .env.example apps/backend/.env)

# 3. Khởi động Postgres
pnpm db:up

# 4. Tạo migration đầu tiên cho User entity
pnpm db:migrate:generate -- src/database/migrations/InitialSchema

# 5. Chạy migration để tạo bảng
pnpm db:migrate

# 6. Chạy dev (cả FE + BE song song)
pnpm dev
```

Sau khi chạy:

- **Backend**: http://localhost:4000 (Swagger: http://localhost:4000/api/docs)
- **Frontend**: http://localhost:3000

## 📜 Scripts (root)

| Script                               | Mô tả                          |
| ------------------------------------ | ------------------------------ |
| `pnpm dev`                           | Chạy FE + BE song song (turbo) |
| `pnpm build`                         | Build tất cả apps/packages     |
| `pnpm lint`                          | Lint toàn bộ                   |
| `pnpm type-check`                    | TypeScript check               |
| `pnpm format`                        | Format code với Prettier       |
| `pnpm db:up`                         | Khởi động Postgres             |
| `pnpm db:down`                       | Dừng Postgres                  |
| `pnpm db:migrate`                    | Chạy TypeORM migrations        |
| `pnpm db:migrate:generate -- <name>` | Tạo migration mới từ entities  |

## 🔐 Authentication flow

```
[FE Login form] → signIn('credentials')
   → POST /api/v1/auth/login (BE)
   → BE verify bcrypt → ký JWT bằng JWT_SECRET
   → FE lưu accessToken trong NextAuth JWT session
   → FE gọi /api/v1/auth/me kèm Authorization: Bearer <token>
   → BE passport-jwt verify bằng cùng JWT_SECRET
```

**Quan trọng**: `NEXTAUTH_SECRET` (FE) phải giống `JWT_SECRET` (BE).

## 🐳 Docker

```bash
# Chỉ Postgres
pnpm db:up

# Cả 3 services
docker compose up -d
```

## ☁️ OCR Worker (Cloudflare)

Worker này xử lý các file PDF scan được upload lên R2 — dùng Cloudflare Workers AI để OCR tiếng Việt rồi gọi callback về backend.

### Cấu trúc

```
workers/ocr-worker/
├── package.json       # pnpm workspace member
├── wrangler.toml      # R2 + AI + KV bindings, cron trigger
├── src/index.ts       # scheduled() + fetch() handlers
└── tsconfig.json
```

### Setup một lần (Cloudflare dashboard + CLI)

```bash
# 1. Login Cloudflare (mở browser xác thực)
pnpm --filter @law-ai/ocr-worker exec wrangler login

# 2. Tạo R2 bucket (nếu chưa có)
#    → Vào dashboard: R2 Object Storage → Create bucket → "law-ai-rag-ocr"

# 3. Tạo KV namespace cho việc track file đã OCR
pnpm --filter @law-ai/ocr-worker exec wrangler kv:namespace create "OCR_STATE"
pnpm --filter @law-ai/ocr-worker exec wrangler kv:namespace create "OCR_STATE" --preview
# → Copy 2 ID trên vào wrangler.toml ([[kv_namespaces]])

# 4. Enable Workers AI
#    → Dashboard: Workers & Pages → Settings → Workers AI → Enable

# 5. Set secrets cho Worker
pnpm --filter @law-ai/ocr-worker exec wrangler secret put OCR_CALLBACK_SECRET
# → paste chuỗi 32+ chars hex (giống giá trị trong backend .env)
pnpm --filter @law-ai/ocr-worker exec wrangler secret put BACKEND_CALLBACK_URL
# → paste: https://<backend-domain>/api/v1/admin/rag/documents/ocr-complete
```

### Deploy

```bash
pnpm --filter @law-ai/ocr-worker deploy
```

Sau khi deploy:

- Worker chạy cron mỗi 1 phút, list R2 `ocr-inbox/`, OCR file mới
- Backend env phải có `OCR_CALLBACK_SECRET` (cùng giá trị với Worker)

### Dev local

```bash
pnpm --filter @law-ai/ocr-worker dev
# → Wrangler sẽ chạy local với R2 + AI binding trỏ về account thật
# → Test thủ công: POST http://localhost:8787/process body {"key":"ocr-inbox/<uuid>.pdf"}
```

### Tại sao Cron Trigger (không phải R2 Event Notifications)?

- R2 Event Notifications yêu cầu **Workers Paid plan ($5/tháng)**
- Cron Triggers có sẵn trong **Workers Free plan** (5 triggers/Worker, đủ dùng)
- Đánh đổi: thêm 30s-1 phút delay giữa upload và OCR xong — acceptable vì bản thân OCR cũng mất vài chục giây
- Khi nào nâng cấp: nếu latency quan trọng (>1000 uploads/ngày cần real-time) → cân nhắc mua Workers Paid và chuyển sang Event Notifications

## 📦 Thêm shadcn component

```bash
cd apps/frontend
pnpm dlx shadcn-ui@latest add <component-name>
```

## 📝 Thêm module BE mới

1. Tạo folder `apps/backend/src/modules/<name>/`
2. Tạo `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/*.entity.ts`
3. Import module vào `apps/backend/src/app.module.ts`
4. Nếu có entity mới: `pnpm db:migrate:generate -- src/database/migrations/<Name>`
5. `pnpm db:migrate`
