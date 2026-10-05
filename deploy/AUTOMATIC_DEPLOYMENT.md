# 自动部署

仓库为 <https://github.com/chunbaisikio/ChiakyaKratos>，当前开发及部署分支为 `feat/chiakya-home-unified`。该分支保留原博客提交历史，根目录包含完整整合项目。`main` 暂保留旧版本；后续整合分支合入 `main` 时，新工作流会替换旧静态博客部署。

## 触发与检查

推送整合分支自动触发 `.github/workflows/check.yml`：Node 24 按锁文件安装，执行类型检查、全部站点/React/API 测试、Python 部署回退测试、三个管理入口和站点构建，以及 Playwright 浏览器验收。全部通过后自动部署。PR 不部署；合并至 `main` 后推送 `main` 也部署。工作流在默认分支可用后，可在 Actions 中手动运行。

检查按分支取消旧任务；生产部署单独排队，不取消已经开始的切换。过时提交在部署前跳过；服务器另有 `shared/deploy.lock` 防止并行升级。提交 SHA 和 Actions run ID、attempt 共同构成版本目录名，便于定位代码与流水线。

## 部署凭据

复用仓库原部署工作流引用的 Actions secrets：

| Secret | 用途 |
| --- | --- |
| `GH_PAGES_SERVER_HOST` | 当前服务器 `111.228.35.242` |
| `GH_PAGES_SERVER_USERNAME` | 原部署账号，需要管理现有 systemd 服务与备份目录 |
| `GH_PAGES_SERVER_PASSWORD` | SSH 登录口令，仅通过进程环境提供给 sshpass |
| `GH_PAGES_SERVER_SSH_PORT` | 可选，默认 `22` |

仓库不保存服务器口令、环境配置、数据库或登录密钥。`deploy/known_hosts` 保存已核实的公开 SSH 主机密钥，连接要求严格匹配。端口变化时需同步 known_hosts 的主机格式；主机密钥变化时先独立核实再修改。

## 保留数据的升级

流水线上传当前提交的代码归档并验证 SHA-256。服务器以 `www` 在新 `releases/ci-...` 目录安装和本机编译 SQLite，保留构建依赖；不使用 CI 机器的 node_modules。

`deploy/deploy.py` 仅支持已有的单项目服务，不初始化生产库。它忽略归档内初始 `source/`，从 `shared/source` 复制验证内容，使用数据库备份接口复制实时数据库和配套密钥。候选服务只监听临时本机端口，检查公开页、脚本和样式、健康接口及未登录管理接口限制，并核对既有账号、工作区、邀请关系与复盘数据的指纹。

准备完成后短暂停止生产服务，创建 `backups/ci-...` 一致备份，包含数据库、配套密钥、环境文件、完整内容、公开发布版本、服务配置和原代码指向。此时重新使用最新 `shared/source` 构建公开版本，再原子切换代码链接和公开指针，启动并检查新服务。最后流水线从外网检查健康和首页。

安装、构建或候选验证失败不切换。停止服务之后发生失败，会恢复原代码和公开指针并启动原服务；不恢复旧数据库或覆盖上传文件。中断信号也进入回退。备份、旧代码、旧发布及验证副本暂不自动清理。

## 定位与手动回退

Actions 日志显示对应版本和备份目录；当前代码的 `deployment.json` 记录原版本、备份路径、公开版本和部署时间。服务日志为 `journalctl -u chiakya-home.service`。

手动回退单项目版本时，先确认 `backups/<版本>/code-target.txt` 对应代码目录仍在，再停止服务，将 `current` 原子指回该目录，并恢复同一备份的 `current.json`（属主 `www:www`），然后启动和验证服务。必须保留 `shared/data`、配套登录密钥及 `shared/source` 的实时版本，不能将历史备份直接覆盖回生产数据。

历史双目录版本还需要恢复对应的服务工作目录；详见 [远端部署记录](SERVER_DEPLOYMENT.md)。

部署脚本的回退测试：`python3 -m unittest discover -s deploy/tests -v`。测试使用临时目录，包含构建失败、切换后健康失败，以及失败期间新增数据和上传文件仍保留的验证。
