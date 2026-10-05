# 项目整合记录

本项目以已部署的 `20261005-moe-v1` 为基线，原两个项目的 158 个代码文件已与该次部署的 SHA-256 清单核对。保留页面样式、账号体系、后台权限、接口和数据格式，将开发、构建及部署配置改为一个项目。

## 目录对应

| 原位置                   | 新位置                                              |
| ------------------------ | --------------------------------------------------- |
| `ChiakyaKratos/src/`     | `src/`，Astro 公开页面                              |
| `ChiakyaKratos/source/`  | `source/`，文章、相册、图片、名片与追番内容         |
| `FF14_OopsieLog/src/`    | `apps/console/src/`，站点管理、模块管理及队伍工作区 |
| `FF14_OopsieLog/server/` | `server/`，统一 API 与 SQLite                       |
| `ChiakyaKratos/tests/`   | `tests/`，日历与完整浏览器检查                      |
| `FF14_OopsieLog/tests/`  | `apps/console/tests/`，React 界面测试               |
| `FF14_OopsieLog/test/`   | `test/`，API、权限与数据迁移测试                    |
| 两份依赖和锁文件         | 根目录一份 `package.json`、`package-lock.json`      |

直接依赖使用原锁文件中的确定版本。两个前端原先使用不同 React 版本，整合后统一到复盘模块的 React / React DOM 19.2.6。构建工具需要不同传递依赖时由 npm 锁文件管理，项目内不再存在子包或第二份安装入口。`OOPSIE_ROOT` 和跨仓库 CI 检出已移除。

开发端口统一从环境配置读取，三个 React 服务使用各自的 Vite 缓存。Astro 开发模式放宽代理路径的末尾斜杠校验，让 API、Vite 客户端和热更新模块交由对应服务器处理；生产构建继续使用原来的末尾斜杠规则。服务监听失败会保留原始端口错误，不再因读取空地址而产生额外异常。

原 Hexo 主题、静态站点发布配置、未启用的 Cloudflare Worker 和历史锁文件未纳入运行项目，仍保留在原目录中。FF14 原 MIT 许可证保留在根目录 `LICENSE`。

## 现有服务器采用新目录时

2026-10-05 已将单项目部署为 `20261005-single-v1`，线上工作目录为 `/www/wwwroot/chiakya_home/current`。根目录直接包含 `package.json`、`tools/`、`server/`、`apps/console/` 等文件。部署详情与历史版本见 [SERVER_DEPLOYMENT.md](../deploy/SERVER_DEPLOYMENT.md)。

新结构部署到独立版本目录，例如 `/www/wwwroot/chiakya_home/releases/<新版本>/`，该目录直接包含 `package.json`、`tools/`、`server/` 等文件。安装依赖后，把该版本的 `source` 链接到已有 `/www/wwwroot/chiakya_home/shared/source`，把 `.releases` 链接到已有 `shared/publications`，配置 `DB_PATH` 为已有 `shared/data/data.db`。保持原 `.auth-key`、`site.env`、内容和发布指针。

构建前应先在隔离内容和数据库副本中验证登录、权限和连续发布。正式切换前备份数据库、配套密钥、完整内容、发布版本、服务配置和代码指向，并使用切换时的最新内容重新构建。将 systemd `WorkingDirectory` 从 `current/ChiakyaKratos` 改为 `current`；新的服务模板已体现这一变化，`ExecStart` 仍为 `node tools/serve.mjs`。

切换 `current` 后重启服务，检查原管理员、队长及成员登录、三个 React 入口和工作区记录。回退代码时应同时恢复相应的服务工作目录，保留实时数据库和内容。不要把开发项目的初始 `source/` 覆盖到服务器持久化目录，也不要用开发数据库替换线上数据库。

## Docker 卷

新 Compose 的容器路径为 `/app/source`、`/app/.releases` 和 `/data`。已有部署需显式复用原数据库、内容及发布卷，或从完整备份迁入；Compose 项目名变化会创建另一套卷，不会自动采用旧卷。不要执行 `down -v` 清除已有内容。

## 本地验收

已用统一锁文件执行 `npm ci`，通过 React 与 Astro 类型检查、4 项日历测试、18 项 React 测试、全部 API 与旧数据迁移检查，以及三个 React 入口和 40 个公开页面构建。完整浏览器流程覆盖文章、相册、图片复用、游戏名片、后台权限、队伍复盘、内容发布和构建失败回退。

另用临时数据库验证统一开发地址的七个页面、三个管理/工作区入口与 API 转发。验证数据库已删除，开发进程已关闭。Compose 配置校验通过；本机 Docker 守护进程未运行，未执行镜像构建。

## 远端验收

服务器 Ubuntu 22.04 的 SQLite 预编译文件需要较新的 glibc，已增加安装时的加载检查：不兼容时使用本机 Node 头文件和编译工具重建。服务器上已实际执行统一 `npm ci`、类型检查、全部测试及构建，并验证原账号登录、三个 React 入口、独立权限与两次连续发布。

正式切换时备份最新数据库与内容，将 systemd 工作目录改为单项目根目录。原 12 个账号、5 个工作区、397 条犯错记录和 18 个内容文件的哈希核对一致；登录密钥保持原样。外网公开页面、旧 39015 入口及桌面/手机布局检查通过。
