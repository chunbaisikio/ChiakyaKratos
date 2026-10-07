# 远端部署记录

当前为单项目结构。此前的双目录版本作为历史保留；目录对应与升级步骤见 [项目整合记录](../docs/PROJECT_INTEGRATION.md)。

2026-10-04 已在现有 Ubuntu 22.04 服务器部署统一站点，使用服务器现有 Node.js 22.22.3 和 systemd。

2026-10-05 已更新到可扩展游戏名片版本 `20261005-games-v1`。新代码在独立内容副本、数据库副本和本机端口完成登录与连续发布检查后切换；现有文章、资源和 FF14 业务数据的哈希均与切换前一致。本次没有新增数据库迁移。

2026-10-05 后台已进一步拆分，该次版本为 `20261005-admins-v1`。站点后台、FF14 模块后台与本队复盘工作区分别构建，登录共用，菜单、数据请求和权限按范围独立。先在隔离副本上用原账号验证登录与两次连续发布，再使用切换时的最新内容重建公开页面。原 12 个账号、5 个工作区和 397 条犯错记录保留，工作区快照与所有持久化内容的哈希一致。

2026-10-05 已更新到前端改版 `20261005-moe-v1`。参考 [绮凛的网站](https://moe.best/) 的紫色顶栏、头像侧栏、插画背景和紧凑文章列表，用本站已有图片重新设计首页、文章、相册、游戏页及两个后台和复盘工作区。默认浅色，保留手动明暗切换；手机导航默认收起。此次只调整前端，服务端代码、账号口令和业务结构保持一致；上线时使用最新持久化内容重新发布，并验证全部内容文件及工作区快照的哈希一致。

2026-10-05 首次部署整合后的单项目 `20261005-single-v1`。根目录统一依赖、开发、构建、测试和服务启动；systemd 工作目录改为 `/www/wwwroot/chiakya_home/current`。数据库、内容和发布版本继续使用原持久化目录，不用本地初始内容覆盖。先在隔离副本上验证原账号、权限及两次连续发布，再切换服务和公开版本。切换前后业务快照、身份与邀请关系、18 个内容文件和登录密钥核对一致。

2026-10-06 首次 GitHub Actions 自动部署通过：[运行 37417441668](https://github.com/chunbaisikio/ChiakyaKratos/actions/runs/37417441668)，提交 `b7c5922`，版本 `ci-37417441668-1-b7c5922e3961`。回归核对原账号、5 篇文章、397 条犯错记录、18 个内容文件和登录密钥保留，切换备份在 `backups/ci-37417441668-1-b7c5922e3961`。

2026-10-07 整合项目纳入 `main`，后续仅 `main` 通过检查后自动部署。当前实际版本读取 `current/deployment.json`，不以本文的历史版本号判断。

## 入口与管理

- 统一站点：<http://111.228.35.242:39016/>
- 博客：`/blog/`；相册：`/photos/`；游戏名片：`/games/`；追番：`/anime-calendar/`。
- 管理入口：`/manage/`。
- 站点后台：`/admin/`，负责文章、相册与随记、图片库、游戏名片和发布。
- FF14 模块后台：`/ff14/admin/`，负责队长邀请、工作区名单与跨队进度。
- 本队复盘工作区：`/ff14/oopsie/`，负责日常记录、复盘、副本、队伍、成员邀请、备份与个人偏好。
- 原 FF14 入口 <http://111.228.35.242:39015/> 通过独立 Nginx 配置跳转到新版工作区，保留 Hash 路由。
- 原站点管理员口令继续可用，共用会话可在两个后台之间切换。站点 `editor` 与 FF14 `admin` 分别校验；队长和成员只进入自己的复盘工作区。旧内容 Hash 地址自动跳到站点后台，管理员访问旧工作区会转到 FF14 模块后台。

目前沿用现有 HTTP 端口入口。确认正式域名后，再配置 HTTPS、`COOKIE_SECURE=true` 和新的 `SITE_URL`，重新生成公开页面。

## 服务与持久化

主目录为 `/www/wwwroot/chiakya_home`：

| 路径                           | 用途                                         |
| ------------------------------ | -------------------------------------------- |
| `current`                      | 当前代码版本链接，指向 `releases/<部署版本>` |
| `shared/data/data.db`          | 迁移后的实时 SQLite 数据库                   |
| `shared/data/data.db.auth-key` | 登录密钥，必须与数据库配套备份               |
| `shared/source`                | 文章、追番数据、相册、图片目录与上传资源     |
| `shared/publications`          | CMS 发布版本和 `current.json` 指针           |
| `shared/site.env`              | 端口、站点地址和数据库路径；仅 root 可读     |
| `backups`                      | 迁移前后备份，仅 root 可访问                 |

当前版本直接在根目录包含 `src`、`apps/console`、`server`、`tools` 和一份 npm 锁文件。根目录的 `source` 和 `.releases` 分别链接到 `shared/source` 和 `shared/publications`，升级代码不会覆盖后台新增内容；运行时从 `shared/site.env` 读取原配置。

游戏名片配置保存在 `shared/source/_data/games.json`。后台入口 `/admin/#/games` 支持新增任意游戏、自定义信息和链接、头像上传复用、排序及隐藏；保存后“更新公开页面”生效。初始公开 Steam、FF14、绯染天空三张名片，原神暂不展示。首页取前三张公开名片，游戏页展示全部。后续部署保留后台修改，本次未覆盖任何持久化内容。

站点接口为 `/api/site/*`，FF14 模块管理接口为 `/api/ff14/admin/*`，旧 API 别名保留。站点与模块后台只恢复身份，不初始化队伍快照。历史管理员的站点编辑权限通过 `app_settings` 中的 `migration.site-editor-roles.v1` 一次性初始化，后续重启不会恢复已撤销的站点权限。本次只增加迁移标记，不更改业务数据结构。

服务为 `chiakya-home.service`，以 `www` 运行，已启用开机启动。日志通过 `journalctl -u chiakya-home.service` 查看。服务配置模板见同目录 `chiakya-home.service.example`；兼容端口配置见 `chiakya-home-39015.conf.example`。

SSH 登录后查看当前服务和部署版本：

```sh
systemctl status chiakya-home.service --no-pager
journalctl -u chiakya-home.service -n 100 --no-pager
readlink -f /www/wwwroot/chiakya_home/current
cat /www/wwwroot/chiakya_home/current/deployment.json
curl --fail http://127.0.0.1:39016/api/health
```

旧 `ff14-oopsie-dev`、`chiakya-gh-pages-39016`、`chiakya-gh-pages-39015` 服务已停止并取消开机启动，文件和旧数据目录保留。历史 39015 静态博客服务原先不断重试占用 FF14 端口，此次一并停用。

## 数据保留与验收

保留原 12 个账号、5 个工作区、12 条成员关系、10 条工作区邀请、5 条队长邀请，以及 4 个副本、5 支队伍和 397 条犯错记录。迁移前后用户 ID、工作区 ID、成员与邀请关系一致；5 份工作区业务快照的 SHA-256 全部一致。12 个原口令与迁移后的哈希和登录索引全部匹配，管理员实际登录和编辑权限通过验证。

原数据库 `/www/wwwroot/ff14_oopsie_dev/shared/data/data.db` 保持原样。新服务使用切换时的完整副本迁移，未在原库上修改表结构或清空记录。

原博客 5 篇文章保留，正文已核对；旧公开目录作为只读资源后备，保留新站未覆盖的旧图片与地址。新站当前没有创建示例相册或向生产库写入测试犯错记录。

迁移前备份为 `backups/20261004-before-upgrade`；切换前的最新数据库备份为 `backups/20261004-232857-cutover`。旧服务配置、旧环境文件和两个静态博客归档均已保存。迁移后的完整备份为 `backups/20261004-after-upgrade`。

名片更新备份为 `backups/20261005-before-games`、切换时的一致备份 `backups/20261005-games-cutover` 和更新后备份 `backups/20261005-after-games`。包含数据库、登录密钥、完整内容和发布版本、环境与服务配置；切换备份还记录原代码指向和所有原内容的 SHA-256。原版本 `releases/20261004-albums-v1` 保留，可恢复代码和对应的公开指针，同时保留实时数据库。

后台拆分备份为 `backups/20261005-before-admins`、`backups/20261005-admins-cutover` 和 `backups/20261005-after-admins`，包含数据库、登录密钥、内容、发布版本、环境、服务配置与代码指向；切换备份记录所有内容的 SHA-256。前一版本 `releases/20261005-games-v1` 保留。验证副本和本机临时服务与生产数据隔离，验证完成后临时服务已停止。

前端改版备份为 `backups/20261005-before-moe`、`backups/20261005-moe-cutover` 和 `backups/20261005-after-moe`，包含数据库、登录密钥、内容、发布版本、环境、服务配置与代码指向；切换时短暂停止服务取得最新一致副本，再原子切换代码与公开发布指针。前一版本 `releases/20261005-admins-v1` 保留。隔离验证服务 `chiakya-style-candidate` 已停止，验证用数据库与内容副本独立于生产。

单项目部署备份为 `backups/20261005-before-single`、`backups/20261005-single-cutover` 和 `backups/20261005-after-single`，保存数据库、配套密钥、内容、发布版本、环境、服务配置和代码指向；切换备份记录所有内容的 SHA-256。前一版本 `releases/20261005-moe-v1` 保留。隔离验证服务 `chiakya-single-candidate` 已停止，私有数据库和发布副本不接入生产。

Ubuntu 22.04 上 SQLite 6 的预编译文件要求较新的 glibc，安装后的 `tools/ensure-native.mjs` 会检查并在需要时本机编译。本次使用服务器现有 Python、make、g++ 和 Node 22.22.3 的头文件完成编译，随后全部 API、图片处理、权限和旧数据迁移检查通过。

已通过本地接口和浏览器流程验收，以及远端原口令登录、连续内容发布、公开页面和 CSS、外网桌面/手机访问、原 FF14 入口及旧资源兼容检查。

## 日常备份

数据库、登录密钥、完整 `source` 和发布版本必须一起备份。短暂停止服务可取得一致的文件内容；SQLite 使用备份接口，包含可能仍在 WAL 中的已提交记录：

```bash
set -eu
app=/www/wwwroot/chiakya_home
backup_dir="$app/backups/$(date +%Y%m%d-%H%M%S)-snapshot"
umask 077
mkdir -m 700 "$backup_dir"
systemctl stop chiakya-home.service
trap 'systemctl start chiakya-home.service' EXIT
python3 - "$backup_dir/data.db" <<'PY'
import sqlite3, sys
source = sqlite3.connect('file:/www/wwwroot/chiakya_home/shared/data/data.db?mode=ro', uri=True)
target = sqlite3.connect(sys.argv[1])
source.backup(target)
assert target.execute('pragma integrity_check').fetchone()[0] == 'ok'
target.close()
source.close()
PY
cp -p "$app/shared/data/data.db.auth-key" "$app/shared/site.env" "$backup_dir/"
tar -czf "$backup_dir/source.tar.gz" -C "$app/shared" source
tar -czf "$backup_dir/publications.tar.gz" -C "$app/shared" publications
systemctl start chiakya-home.service
trap - EXIT
```

## 后续更新与回退

后续功能分支通过 PR 合入 `main`，由 `main` 自动检查及升级，流程、触发范围与回退见 [自动部署](AUTOMATIC_DEPLOYMENT.md)。新代码放入独立版本目录，在项目根目录按锁文件安装全部依赖，复制已有内容与数据库在本机验证，再备份并切换 `current` 和重启服务。不要将仓库内的初始 `source` 覆盖到 `shared/source`。三个 React 入口与 API 必须一起更新，内容后台始终保留构建依赖。

回退到历史双目录版本时，将 `current` 指向原版本，并同时恢复相应备份中的 systemd 服务文件（其工作目录为 `current/ChiakyaKratos`），执行 `systemctl daemon-reload` 后重启。回退单项目版本时使用根目录工作目录。代码回退始终保留实时数据库、登录密钥和完整内容。

内容发布失败时自动保留上一个公开版本。回退新服务代码时保留当前数据库和对应密钥；回到旧版服务需要升级前的旧库，但恢复旧库会遗漏升级后的新记录，因此必须先完整备份实时数据并核对新增内容。不要直接启动旧服务操作迁移后的数据库。

备份和历史发布当前由人工维护，未设置自动清理或定时备份。
