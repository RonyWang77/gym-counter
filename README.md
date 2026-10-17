# 健身卡计数器

一个面向朋友共同使用的健身卡次数管理小应用。创建共享空间后，把链接发给朋友，大家就能在同一份健身卡中记录成员、打卡和使用进度，并统计日常及月度成员使用情况。

> 这是一个用于学习与作品展示的全栈 Web 项目：前端负责交互，Netlify Functions 提供 API，Supabase 保存共享数据。

## 功能亮点

- **多人共享**：通过包含随机共享标识的链接进入同一空间。
- **健身卡管理**：创建健身卡、设置总次数和有效期，并查看剩余次数。
- **成员与打卡**：添加成员、记录每次打卡的日期和备注。
- **记录撤销**：可撤销单条打卡记录；最新已用完的卡会在撤销后按规则恢复可用状态。
- **北京时间统计**：统一按 `Asia/Shanghai` 计算日期、时间和连续打卡天数。
- **移动端优先**：界面按手机使用场景设计，也可在电脑浏览器中运行。

## 技术栈

| 领域 | 使用的技术 |
| --- | --- |
| 前端 | React、TypeScript、Vite |
| 后端 API | Netlify Functions |
| 数据库 | Supabase（PostgreSQL） |
| 部署 | Netlify |
| 包管理 | pnpm |

## 项目结构

```text
gym-counter/
├── src/                    # React 前端页面、样式与业务时间逻辑
├── netlify/functions/      # 服务端 API
├── tests/                  # 北京时间与连续打卡逻辑测试
├── supabase-schema.sql     # 数据库表和索引定义
├── netlify.toml            # Netlify 构建与路由配置
├── .env.example            # 环境变量示例（不含真实密钥）
└── README.md
```

## 本地运行

### 1. 准备工具

请先安装：

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### 2. 安装依赖并启动前端

```bash
pnpm install
pnpm run dev
```

然后访问终端显示的本地地址（通常类似 `http://127.0.0.1:5173/`）。

> 仅运行 `pnpm run dev` 时，页面可以预览，但多人共享数据功能需要 Netlify Functions 与 Supabase 环境。

### 3. 运行完整本地环境（可选）

安装并登录 Netlify CLI 后：

```bash
pnpm run dev:netlify
```

这样可以同时运行前端和本地 Netlify Function。

## Supabase 配置

1. 创建一个 Supabase 项目。
2. 打开 Supabase 的 **SQL Editor**。
3. 执行仓库根目录的 `supabase-schema.sql`。
4. 记录项目 URL 与服务端 Secret Key。
5. 在 Netlify 项目的环境变量中配置：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SECRET_KEY=你的 Supabase sb_secret_... key
```

## 部署到 Netlify

本仓库已经包含 `netlify.toml`：

- 构建命令：`pnpm run build`
- 发布目录：`dist`
- Functions 目录：`netlify/functions`

将 GitHub 仓库导入 Netlify 后，在 Netlify 后台添加上述两个环境变量并部署即可。

## 数据与安全说明

- 请勿提交真实的 `.env`、Supabase Secret Key 或其他令牌。
- `.env.example` 只用于说明变量名称，可以安全公开。
- Supabase 密钥仅由 Netlify Function 在服务端读取，前端不使用 `VITE_*` 形式的密钥。
- 共享链接应仅发给可信任的人：获得链接的人可以访问该共享空间的数据。

## 可继续改进的方向

- 增加登录与成员权限管理。
- 增加数据导出和备份功能。
- 为前端交互和服务端接口补充更多自动化测试。
- 增加项目截图、在线演示链接和 GitHub Actions 自动构建检查。

