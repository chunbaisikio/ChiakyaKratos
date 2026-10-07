# Chiakya Home

一个项目维护个人博客、相册与随记、游戏名片、站点后台、FF14 模块后台和固定队复盘。公开页面使用 Astro，三个后台/工作区入口使用 React + TypeScript，API 使用 Express + SQLite。根目录统一安装依赖、开发、构建和验证，无需再检出或安装另一个仓库。

`main` 是完整项目的开发基线和生产部署分支，保留原博客提交历史。线上入口为 <http://111.228.35.242:39016/>；实际部署版本记录在服务器 `current/deployment.json`，与 GitHub Actions 的提交和运行记录对应。原账号、API、后台权限和工作区数据格式保持兼容。

| 文档                                        | 内容                                           |
| ------------------------------------------- | ---------------------------------------------- |
| [自动部署](deploy/AUTOMATIC_DEPLOYMENT.md)  | 分支策略、CI、部署凭据、升级与代码回退         |
| [服务器与备份](deploy/SERVER_DEPLOYMENT.md) | 线上入口、持久化目录、服务管理、备份命令与历史 |
| [数据兼容](docs/DATA_COMPATIBILITY.md)      | 账号迁移、数据库密钥、工作区与内容持久化约定   |
| [项目整合](docs/PROJECT_INTEGRATION.md)     | 原两个项目的目录对应、整合及验收记录           |

## 开始开发

使用 Node.js 24，或 Node.js 22.19 及以上。首次检出：

```sh
git clone --branch main https://github.com/chunbaisikio/ChiakyaKratos.git ChiakyaHome
cd ChiakyaHome
npm ci
```

创建本地配置（已有 `.env` 时保留它），然后启动。Windows PowerShell：

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Linux / macOS：

```sh
test -f .env || cp .env.example .env
npm run dev
```

打开 <http://127.0.0.1:4321/>。该命令启动 Astro、三个 Vite 开发入口和 API，公开页面及管理入口通过 Astro 转发，统一从 4321 访问。API 监听 3001，三个 Vite 分别监听 5173、5174、5175，退出时关闭子进程。

端口被占用时，在 `.env` 中调整 `PORT`（API）、`DEV_PORT`（公开站）、`DEV_WORKSPACE_PORT`、`DEV_SITE_ADMIN_PORT` 或 `DEV_FF14_ADMIN_PORT`，五个端口必须不同，各模块代理同步使用配置。例如将 `PORT=31001`、`SITE_URL=http://localhost:31001`，开发页面仍从 4321 进入。生产访问地址应与 `SITE_URL` 一致。

本地默认使用 `server/data.db`，不附带生产数据库或密钥。首次打开 `/admin/`，在“初始化管理员”中填写站点名称、管理员显示名和至少 8 位口令，创建的账号同时拥有站点编辑和 FF14 管理权限。已有管理员时只显示登录与邀请入口，使用原口令登录；没有统一默认口令。继续开发时原数据库会保留。需要验证旧数据时使用备份副本，不要把开发服务连接到线上实时库。

## 目录与常用命令

```text
ChiakyaHome/
├── src/                 # Astro 页面、组件、内容读取与公开站样式
├── apps/console/        # 三个 React 入口、共享组件和 UI 测试
├── server/              # 登录、站点内容与 FF14 协作 API
├── source/              # 文章、相册、图片、游戏名片与追番数据
├── static/              # 公开资源及构建生成的后台入口
├── tools/               # 统一开发、构建、启动与内容发布
├── tests/               # 日历与完整浏览器检查
├── test/                # API、权限和数据迁移检查
├── deploy/              # systemd、反向代理示例与部署历史
├── docs/                # 整合说明与数据兼容约定
├── package.json
└── package-lock.json
```

| 命令                   | 用途                                      |
| ---------------------- | ----------------------------------------- |
| `npm ci`               | 按唯一锁文件安装全部依赖                  |
| `npm run dev`          | 同时启动全部开发服务                      |
| `npm run check`        | React TypeScript 与 Astro 检查            |
| `npm test`             | 日历、React UI、API、权限和旧数据迁移检查 |
| `npm run build`        | 构建三个 React 入口及全部公开页面         |
| `npm start`            | 运行完整站点与 API，默认 3001             |
| `npm run test:browser` | 验证完整编辑、发布及失败回退流程          |
| `npm run verify`       | 检查、测试、构建与浏览器验收              |

生产方式本地体验：先 `npm run build`，再 `npm start`，打开 <http://127.0.0.1:3001/>。不要与开发模式同时占用 3001。`npm run preview` 只预览静态页面，完整登录、上传和发布使用 `npm start`。

只检查某个模块时可使用 `npm run test:site`、`npm run test:ui`、`npm run test:api`；例如 `npm run test:ui -- tests/admin-ui.test.tsx`。

## 管理范围与入口

公开页面使用参考 [绮凛的网站](https://moe.best/) 的个人博客布局：紫色顶栏、头像侧栏、推荐文章与更新列表、右侧分类和博客信息，复用原有插画。手机端点击顶栏菜单展开导航。默认浅色，明暗切换保留浏览器中的选择；后台与复盘工具使用对应的白色内容面板和分组侧栏。

站点导航的“管理入口”打开 `/manage/`，可按任务进入对应后台：

| 入口            | 管理范围                                                           | 权限                              |
| --------------- | ------------------------------------------------------------------ | --------------------------------- |
| `/admin/`       | 站点总览、文章、相册与随记、图片库、游戏名片、公开发布             | `site_roles.editor`               |
| `/ff14/admin/`  | FF14 模块总览、队长邀请与工作区、跨队进度                          | FF14 `admin`                      |
| `/ff14/oopsie/` | 本队犯错记录、队伍、副本、明细、复盘手记、成员邀请、备份与个人偏好 | 所在工作区的 `captain` / `member` |

登录会话共用，权限分别校验。拥有站点编辑权限的队长不会因此获得 FF14 模块管理员权限。两个管理后台只恢复身份，不读取或保存队伍业务快照；日常复盘仍在各自工作区。后台侧栏分别提供自己的管理菜单，通过“切换管理范围”进入另一个区域。

站点 API 使用 `/api/site/*`，FF14 全局管理使用 `/api/ff14/admin/*`，本队协作继续使用原工作区 API。原 `/api/editor/*`、`/api/admin/*` 保留兼容。旧 `/ff14/oopsie/#/editor`、`#/albums`、`#/games` 自动跳到站点后台；FF14 管理员进入旧工作区会跳到模块管理。原账号、口令和工作区保持可用。

## 文章与内容工作台

原有 5 篇文章继续从 `source/_posts/*.md` 读取，`/posts/FF14/` 等文章地址保持不变。文章、分类、标签、归档、全文搜索、Atom 和 sitemap 在构建时生成。封面等资源从 `source/assets/` 读取。旧 Hexo 配置、主题和历史锁文件保留在原目录，不再纳入本项目；依赖以根目录 `package-lock.json` 为准。

可以直接编辑 Markdown，也可以使用内容工作台：

1. 新建文章，填写标题、文章标识、发布时间、标签和分类，编写 Markdown。
2. 上传封面，或关联从 FF14 工作区导出的副本 JSON 模板。
3. 保存文章。勾选“保留为草稿”的文章只存在于内容库；未来日期的文章同样不会提前出现在公开页面。
4. 取消草稿并保存，再点击“更新公开页面”。构建成功后切换到新版本；失败时继续提供上一版本。

未保存的正文会在当前浏览器保留恢复副本，文章保存有版本检查。封面与模板上传后需要保存文章。草稿附件不复制到公开构建，后台可预览图片。未保存修改、草稿或未来文章不会因点击更新而公开；未来文章到期后需要再次更新页面，当前没有定时发布任务。

普通队长和成员可以在“复盘手记”按队伍、日期生成 Markdown。默认不包含成员名字和原始备注，选择后可主动附上姓名。下载的 Markdown 可导入内容工作台，经编辑者审核再公开；队长权限不会自动获得博客发布权限。

追番数据保留在 `source/anime-calendar/data.json`，日期按上海时区计算。链接页在 `src/pages/links/index.astro`，导航与站点信息在 `src/layouts/SiteLayout.astro`，外观在 `src/styles/site.css` 和 `src/styles/theme.css`；后台与复盘外观在 `apps/console/src/app-theme.css`。

## 相册与随记

公开相册在 `/photos/`，编辑者登录后从“相册与随记”进入后台。可以记录旅行或日常、日期、地点和随记，批量添加照片，为每张照片填写说明和拍摄日期、调整顺序和封面，并关联一篇博客。没有照片也能保存文字随记。

图片库支持 JPEG、PNG、WebP，单张上限 20 MB；上传后自动校正方向，生成最长边 2200 像素的 WebP 和缩略图，去除 EXIF/GPS。当前不保留原图，不支持 HEIC。已上传图片可以直接作为博客封面或插入 Markdown 正文，无需重复上传。

相册默认是草稿。保存后取消草稿并点击“更新公开页面”才公开；未公开相册的照片仅能通过登录后台预览，若同一照片已用于公开文章或相册，则该照片会公开。公开页面支持分类、手机浏览和大图键盘切换。

相册保存在 `source/_albums/`，图片目录在 `source/_media/`，处理后的图片在 `source/assets/uploads/`。这些目录都随 `source/` 一起备份；从相册移除照片不会删除图片库文件或影响其他文章。

## 游戏名片

公开入口在 `/games/`，首页展示前三张公开名片。后台入口为 `/admin/#/games`，仅内容编辑者可管理。可以自由添加游戏、昵称或角色、简介、颜色、头像、自定义信息（服务器、UID、公会等）和链接，并调整顺序、隐藏或删除名片。新增名片默认不公开。填写后先“保存名片”，再“更新公开页面”。未保存修改在当前浏览器保留恢复副本，版本冲突时可下载副本再合并。

初始名片包含 Steam、FF14 和绯染天空，原神暂不展示。Steam 与图鉴通过原链接访问，目前不自动同步在线状态、游戏时长或收藏数量。公开信息可以一键复制，头像复用现有图片库；只用于隐藏名片的上传头像不会复制到公开版本。名片配置保存在 `source/_data/games.json`，随整个 `source/` 一起备份，升级代码时保留持久化内容。

## 配置、迁移与备份

`.env` 由运行脚本加载，不提交到 Git：

| 配置                                                                 | 用途                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SITE_URL`                                                           | 正式域名，影响 canonical、Atom 和 sitemap；修改后需要重新构建                           |
| `HOST` / `PORT`                                                      | Node 监听地址与端口；默认 `127.0.0.1:3001`                                              |
| `DB_PATH`                                                            | SQLite 文件；默认 `server/data.db`                                                      |
| `COOKIE_SECURE`                                                      | 本地 HTTP 为 `false`；正式 HTTPS 为 `true`                                              |
| `AUTH_LOOKUP_SECRET`                                                 | 可选，至少 32 字符；已有数据库必须沿用原值。未设置时自动使用数据库旁的 `.auth-key` 文件 |
| `DEV_PORT`                                                           | Astro 开发入口，默认 `4321`                                                             |
| `DEV_WORKSPACE_PORT` / `DEV_SITE_ADMIN_PORT` / `DEV_FF14_ADMIN_PORT` | 三个 Vite 开发端口，默认 `5173` / `5174` / `5175`                                       |
| `LEGACY_BLOG_DIST_PATH`                                              | 可选，只读的旧博客公开目录；保留新站未覆盖的旧资源和地址                                |

旧数据库首次启动自动增加表和列、迁移口令哈希，保留用户 ID、工作区和业务记录。旧登录缓存会要求重新登录，原口令仍可使用。协作保存增加 `baseRevision`；旧前端不能继续向新接口写入，应与服务端一起更新。

迁移前备份原数据库。升级后应一起备份数据库及同目录的 `data.db.auth-key`、完整 `source/`、`.releases/` 和环境配置。数据库通过 SQLite 备份接口复制，包含 WAL 中已提交的记录；仅复制运行中的 `data.db` 不足以保证完整。可执行命令见 [日常备份](deploy/SERVER_DEPLOYMENT.md#日常备份)。如设置 `AUTH_LOOKUP_SECRET`，必须保存原密钥；换密钥会导致登录索引失效。数据库密钥丢失或不匹配时服务会拒绝启动。

协作发生冲突或断网时会停止上传，保留当前本地修改并提供备份下载；重新同步读取服务端最新版本。当前没有自动合并两个人的编辑。仅支持单个 Node 实例。历史发布保存在 `.releases/`，尚未自动清理；定期备份并维护磁盘空间。

原来不同域名下的浏览器数据不会自动搬到新域名。纯本地旧版用户需在旧站导出 JSON，在新站队长工作区的“数据备份”导入。该页面的“清除本机缓存并重新同步”只删除本机工作区缓存并重新读取服务器，不删除共享记录。

## 部署

构建和启动都从根目录执行：`npm ci`、`npm run build`、`npm start`。后台内容发布需要运行 Astro，因此生产环境也要保留构建依赖，不能使用 `npm ci --omit=dev` 或仅部署 `dist/`。

安装时会检查 SQLite 原生模块；Ubuntu 22.04 等系统如果无法加载预编译文件，会自动使用本机 Node 头文件重新编译。此时需要 Python 3、make 和 g++，Docker 构建阶段已包含这些工具。

Docker 直接在本目录执行：

```sh
docker compose config
docker compose up -d --build
```

Docker 的构建上下文是本项目，数据库、内容和发布版本分别使用持久卷。已有服务器采用新目录时，继续使用原 `shared/data`、`shared/source` 和 `shared/publications`，不要用开发初始文件覆盖持久化内容。具体路径、服务工作目录变化和回退方法见 [项目整合记录](docs/PROJECT_INTEGRATION.md)；历史部署与备份见 [远端部署记录](deploy/SERVER_DEPLOYMENT.md)。

后续开发从最新 `main` 创建功能分支：

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/your-feature
```

提交功能后推送分支、创建目标为 `main` 的 PR。PR 执行检查、接口测试、部署回退测试、构建与浏览器验收；合并到 `main` 后再次检查，通过后自动更新现有服务器。功能分支不部署生产，避免旧整合分支覆盖线上版本；Actions 手动部署也只接受 `main`。服务器先用独立数据库和内容副本验证，切换时备份并读取最新持久化内容；升级失败回退代码和公开版本，保留实时数据库、密钥和上传内容。具体凭据、运行记录及手动回退见 [自动部署](deploy/AUTOMATIC_DEPLOYMENT.md)。

## 验证与数据兼容

```sh
npm run verify
```

浏览器检查使用临时数据库和内容副本，覆盖桌面/手机、搜索、日历、相册、游戏名片、独立后台、权限、草稿附件隔离、发布和失败回退，不修改实际内容和工作区。Windows 自动使用已安装的 Chrome / Edge；其他环境先运行 `npx playwright install chromium`，或通过 `BROWSER_EXECUTABLE` 指定浏览器。截图写入忽略提交的 `.qa/`。

服务端迁移、工作区快照、个人偏好、数据库密钥和内容持久化的约定见 [数据兼容说明](docs/DATA_COMPATIBILITY.md)。

部署脚本另外使用 `python3 -m unittest discover -s deploy/tests -v` 验证切换失败回退和数据保留，CI 会执行；Windows 可使用 `python`，部分符号链接测试可能因系统权限跳过。

## 常见问题

| 现象                                   | 处理                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 本地没有网页                           | 开发运行 `npm run dev` 后访问 4321；生产方式先构建，再 `npm start` 并访问配置的 `PORT`。同时检查终端启动日志 |
| `EADDRINUSE` / 端口占用                | 修改 `.env` 中对应端口，停止旧进程后重新启动；开发的五个端口必须互不重复                                     |
| 登录成功但无法进入某个后台             | 检查对应的站点编辑、FF14 管理或队伍成员权限；登录成功不代表拥有全部管理权限                                  |
| 保存文章、相册或名片后公开页面没有变化 | 保存只更新内容库；取消草稿或启用名片展示后，再点击“更新公开页面”                                             |
| SQLite 报 `GLIBC_*` 或原生模块加载错误 | Linux 安装 Python 3、make、g++ 和对应 Node 头文件，再执行 `npm ci`；安装脚本会按需本机编译                   |
| 浏览器测试找不到浏览器                 | 执行 `npx playwright install chromium`；Linux CI 使用 `--with-deps`，也可设置 `BROWSER_EXECUTABLE`           |
| 数据库登录密钥缺失或不匹配             | 恢复该数据库配套的 `.auth-key` 或原 `AUTH_LOOKUP_SECRET`，不能通过重新生成密钥修复旧账号                     |

提交前检查 `git status`，数据库、密钥、`.env`、上传内容、构建产物和 `.qa/` 均不应纳入提交。仓库 `source/` 是初始内容，线上内容由持久化目录与备份管理。
