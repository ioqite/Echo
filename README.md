# Echo · 个人文本传输助手

基于 **Cloudflare Workers + D1** 的多设备文本传输工具，类似微信「文件传输助手」，但只为自己使用。

## 特性

- 🔐 单密码登录，长期保持登录状态（10 年 cookie），可在 UI 中改密码
- 💬 单人聊天界面：发送 / 编辑 / 删除 / 复制 / 多选批量删除（顶栏多选按钮 + 移动端长按）
- 📝 三种消息格式：纯文本 / Markdown / 代码（带语法高亮）
- 🌈 CodeMirror 6 编辑器，GitHub 主题，支持 70+ 语言代码高亮（C/C++、Python、Java、JS/TS、HTML、CSS、XML、JSON、SQL、Rust、Go、Ruby、PHP、YAML、Shell、Dockerfile ……）
- 📑 Markdown 渲染：GFM、KaTeX 数学公式、Mermaid 图表、自动链接、SmartyPants
- 🔄 窗口聚焦时按设定间隔轮询自动刷新（可在设置中调整，0=禁用）
- 🔍 全文搜索（D1 FTS5，索引所有文字，回车立即搜索）
- 📜 首屏可配置加载条数，向上滚动懒加载（每次条数可配置）
- 📦 单条消息上限 600 KiB
- 🗜 长消息自动折叠（行数阈值可在设置中调整），展开按钮大而明显
- 🎨 现代化 UI，支持 浅色 / 深色 / 跟随系统 三种主题，自动检测失败时默认深色，记忆上次选择
- 📱 移动端适配，长按消息进入多选模式
- ⌨️ Enter 换行，Ctrl/Cmd+Enter 发送（使用最高优先级 keymap，确保不被默认绑定拦截），Tab 插入可配置空格数
- ⏰ 时间戳：相对（"5 分钟前"）+ 完整（hover 显示）
- 🛠 编辑历史消息弹出近全屏窗口；新建消息底部编辑框
- 💾 草稿自动保存到云端，跨设备同步（下次打开恢复未发送内容 + 格式 + 语言）
- ⚙️ 设置面板（右上角齿轮）支持 UI 调节：主题、悬浮窗宽/高（屏幕 %）、图标大小倍率、编辑器字号、Tab 宽度、默认格式、默认编程语言、首屏/懒加载条数、轮询间隔、折叠行数、消息字号 —— 全部跨设备同步
- 📨 新消息插入到底部（聊天流式），符合直觉
- 🪟 悬浮卡片式界面（居中显示，带阴影），移动端自动全屏
- 🔄 轮询间隔=0（禁用）时左上角显示手动刷新按钮
- 🚀 一键部署：`./scripts/deploy.sh` 或 GitHub Actions 推送即部署

## 项目结构

```
echo/
├── src/
│   └── worker.js          # Worker 入口（API 路由 + 静态资源代理）
├── frontend/              # 前端源码（esbuild 打包到 public/）
│   ├── main.js            # 前端入口
│   ├── editor.js          # CodeMirror 6 封装
│   ├── markdown.js        # Markdown 渲染（KaTeX + Mermaid + highlight.js）
│   ├── languages.js       # 语言列表
│   └── theme.js           # 主题切换
├── public/                # 静态资源（由 Worker 托管）
│   ├── index.html
│   ├── styles.css
│   ├── main.js            # 构建产物
│   └── chunks/            # 构建产物（懒加载分块）
├── scripts/
│   ├── deploy.sh          # 一键部署脚本
│   └── prepare-wrangler.js # 从环境变量注入 database_id
├── .github/workflows/
│   └── deploy.yml         # GitHub Actions 自动部署
├── schema.sql             # D1 数据库 schema
├── wrangler.toml          # Cloudflare Workers 配置
├── build.js               # 前端构建脚本
└── package.json
```

## 部署步骤

### 方式 A：一键部署脚本（推荐）

```bash
cd echo
npm install
./scripts/deploy.sh
```

脚本会自动完成：安装依赖 → 创建/复用 D1 数据库 → 注入 database_id → 初始化 schema → 设置 PASSWORD secret → 构建前端 → 部署。

如果还没有 D1 数据库，脚本会自动创建并把 ID 存到 `.dev.vars`（下次自动复用）。也可以预先 `export ECHO_DB_ID=xxx`。

### 方式 B：GitHub Actions 自动部署（推送即部署）

1. 把本仓库推到 GitHub
2. 在仓库 Settings → Secrets and variables → Actions 添加：
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API Token（权限：Edit Cloudflare Workers 模板）
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID（`wrangler whoami` 可查）
   - `ECHO_DB_ID` — D1 数据库 ID（首次可本地 `npx wrangler d1 create echo-db` 创建后填入）
   - `ECHO_PASSWORD` — 初始登录密码
3. 推送到 `main` 分支，GitHub Actions 自动构建+部署

详见 `.github/workflows/deploy.yml`。

### 方式 C：手动分步部署

#### 1. 安装依赖

```bash
cd echo
npm install
```

#### 2. 创建 D1 数据库

```bash
npx wrangler d1 create echo-db
```

#### 3. 配置 database_id（三种方式任选其一）

**方式 1：直接改 wrangler.toml** — 把打印的 database_id 粘贴到 `wrangler.toml` 里替换 `REPLACE_WITH_YOUR_DATABASE_ID`。

**方式 2：用 .dev.vars（本地开发推荐）** — 在项目根创建 `.dev.vars` 文件（已被 gitignore）：
```
ECHO_DB_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PASSWORD=your-password
```
然后部署前运行 `node scripts/prepare-wrangler.js` 把 ID 注入 wrangler.toml。

**方式 3：用环境变量（CI 推荐）** — `ECHO_DB_ID=xxx node scripts/prepare-wrangler.js`

> Wrangler 目前不支持在 wrangler.toml 里直接引用环境变量，所以需要用 prepare-wrangler.js 在部署前做替换。`scripts/deploy.sh` 和 GitHub Actions workflow 都已内置这一步。

#### 4. 初始化数据库

```bash
# 本地（开发）
npx wrangler d1 execute echo-db --local --file=./schema.sql

# 远程（生产）
npx wrangler d1 execute echo-db --remote --file=./schema.sql
```

#### 5. 设置初始密码

```bash
npx wrangler secret put PASSWORD
# 然后输入密码
```

> 注意：`PASSWORD` 仅作为首次访问时的初始密码。一旦登录后在 UI 中修改了密码，新密码会写入 D1 数据库的 `meta` 表，环境变量不再生效。

#### 6. 构建前端并部署

```bash
npm run build
npx wrangler deploy
```

部署后访问 Worker 域名（如 `https://echo.<account>.workers.dev`）即可使用。

## 本地开发

```bash
# 监听前端改动并自动重打包
npm run build:frontend -- --watch

# 另开一个终端运行 wrangler dev
npx wrangler dev --local
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/status` | 检查登录状态 |
| POST | `/api/login` | 登录（设置长期 cookie） |
| POST | `/api/logout` | 登出 |
| POST | `/api/password` | 修改密码（需当前密码 + 两次新密码） |
| GET  | `/api/messages?before=<id>&limit=<n>` | 列出消息（向前分页，DESC 返回） |
| POST | `/api/messages` | 新建消息 |
| PUT  | `/api/messages/:id` | 编辑消息（覆盖原内容） |
| DELETE | `/api/messages/:id` | 删除单条 |
| POST | `/api/messages/batch-delete` | 批量删除（body: `{ids:[...]}`) |
| GET  | `/api/search?q=<q>&before=<id>&limit=<n>` | 搜索消息（FTS5，失败回退 LIKE） |
| GET  | `/api/stats` | 统计信息 |
| GET  | `/api/settings` | 读取用户设置（JSON） |
| POST | `/api/settings` | 保存用户设置（JSON） |
| GET  | `/api/draft` | 读取云端草稿 |
| POST | `/api/draft` | 保存草稿（content + format + language） |
| DELETE | `/api/draft` | 清空草稿 |

## 数据库结构

```sql
messages(id, content, format, language, created_at, updated_at, is_edited)
messages_fts -- FTS5 虚拟表，索引 content
meta(key, value) -- 存储 password_hash / settings / draft 等
```

> 不需要为新功能执行迁移：`meta` 表已支持任意键值。设置和草稿直接存为 JSON 字符串。

## 安全说明

- 密码以 SHA-256 哈希存储在 `meta.password_hash`
- 登录后 cookie 内容即当前密码哈希；密码一改，旧 cookie 立即失效
- Cookie 设置：`HttpOnly` `Secure` `SameSite=Lax`，10 年有效期
- Markdown 输出经过 DOMPurify 清洗（禁用 `<script>` `<iframe>` 等以及所有 `on*` 属性）
- Mermaid 安全级别 `strict`，禁止 HTML 注入
- 所有用户输入长度有上限（密码 1 KiB，消息 600 KiB，搜索 256 字符）

## 浏览器支持

需要支持 ES Modules + dynamic import 的现代浏览器：
- Chrome 109+ / Edge 109+
- Firefox 109+
- Safari 16+

## 自定义

大多数常量都可在「设置」面板里 UI 调节（无需改代码），且会跨设备同步：

- 主题（跟随系统 / 浅色 / 深色）
- 悬浮窗宽度（屏幕的 40–100%）
- 悬浮窗高度（屏幕的 50–100%）
- 图标大小倍率（0.7–2.0，相对于默认尺寸）
- 编辑器字号（12–32 px）
- Tab 宽度（2–8 空格）
- 默认格式（纯文本 / Markdown / 代码）
- 默认编程语言（代码格式下自动使用）
- 首屏加载条数（5–100）
- 每次懒加载条数（5–100）
- 轮询间隔（0–60 秒，0=禁用并显示手动刷新按钮）
- 长消息折叠阈值（0–500 行，0=永不折叠）
- 消息字号（12–24 px）

仅消息字节数上限（600 KiB）需在 `src/worker.js` 的 `MAX_BYTES` 和 `frontend/main.js` 的 `MAX_BYTES` 中修改。

## License

MIT
