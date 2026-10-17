# 健身卡计数器 v1.0

这是一个 React + TypeScript + Vite 前端项目。

## 本地运行

不要直接双击 `index.html`，需要先启动开发服务器：

```bash
pnpm install
pnpm run dev
```

然后打开终端里显示的 `http://127.0.0.1:端口号/`。

Windows 下也可以双击 `start-dev.bat` 启动。

注意：`pnpm run dev` 只启动前端页面。多人共享功能需要 Netlify Functions 和 Supabase 环境，部署到 Netlify 后才能完整使用。安装 Netlify CLI 并配置环境变量后，也可以尝试：

```bash
pnpm run dev:netlify
```

## 多人共享版

当前版本使用：

- Netlify 托管前端和 API
- Netlify Functions 作为后端代理
- Supabase 保存共享数据
- `?space=随机长字符串` 作为共享空间链接

## Supabase 初始化

1. 创建 Supabase 项目。
2. 打开 SQL Editor。
3. 执行 `supabase-schema.sql`。
4. 复制 Project URL 和新版 secret key。

## 环境变量

参考 `.env.example`，在 Netlify 中配置：

```bash
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SECRET_KEY=你的 Supabase sb_secret_... key
```

`SUPABASE_SECRET_KEY` 只允许配置在 Netlify Functions 这种服务端环境中，不要放进 Vite 前端变量，也不要使用任何 `VITE_*` 前缀。项目没有在浏览器端使用 Supabase key。

## 共享方式

首次打开网页时创建共享空间，创建成功后 URL 会变成：

```text
https://你的站点/?space=随机长字符串
```

把这个链接发给朋友，大家会共用同一份健身卡数据。
