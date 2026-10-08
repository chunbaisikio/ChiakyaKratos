# 依赖兼容性整合

2026-10-08 基于 `main` 的 `8a1f8f1` 整合现有 Dependabot 更新。只使用根目录 `package.json` 与 `package-lock.json`，安装时不使用 `--force` 或 `--legacy-peer-deps`。

| 原 PR | 处理 | 兼容性调整 |
| --- | --- | --- |
| #2 Vite React 插件 | 升级至 6.1.1 | 与 Vite 8.3.2 一起验证 |
| #3 Tailwind CSS | 升级至 4.3.3 | 同步升级 `@tailwindcss/vite` 至 4.3.3，避免编译插件继续使用旧版 Tailwind |
| #4 Node 类型 26.6.4 | 改为升级 24.x 至 24.19.1 | CI 和生产采用 Node 24，类型声明继续匹配该运行环境 |
| #5 TypeScript 7.0.2 | 暂缓，保留 6.0.3 | `@astrojs/check@0.9.10` 要求 `^5.0.0 || ^6.0.0`；`typescript-eslint@8.60.0` 要求 `>=4.8.4 <6.1.0`，当前最新版 8.71.1 也未支持 TypeScript 7 |
| #6 React Refresh ESLint 插件 | 升级至 0.5.7 | 验证现有 ESLint 配置和应用代码 |
| #7 React 与 React 类型 | 升级至 19.3.0 | 同步升级 `react-dom` 与 `@types/react-dom` 至 19.3.0，修复原 PR 中渲染器版本不匹配 |
| #8 Vite | 升级至 8.3.2 | 验证三个后台构建与 Astro 公开站构建 |
| #9 PapaParse | 升级至 5.7.0 | 保留现有 CSV 导出接口 |
| #10 jest-dom | 升级至 7.0.1 | 验证现有 React UI 测试 |
| #1 Hexo 8.1.2 | 不合入当前项目 | 当前运行项目为 Astro，不再依赖 Hexo；该历史分支还包含独立的 39015 静态部署工作流，不能作为当前主站的部署配置引入 |

依赖要求通过 npm 官方 registry 的 `npm view <包>@<版本> peerDependencies --json` 核对。React 要求与渲染器使用同一版本，见 [React 版本不匹配说明](https://react.dev/warnings/version-mismatch)；TypeScript 工具支持范围见 [typescript-eslint 依赖说明](https://typescript-eslint.io/users/dependency-versions/)。

Dependabot 将 React 及类型包、Tailwind 及编译插件分别分组。TypeScript 7 及以上和 Node 类型 25 及以上暂时忽略；升级检查工具或生产 Node 主版本时，需要同步检查并调整这些限制。

验证要求：按锁文件全新安装，执行 `npm run verify`（类型检查、站点/UI/API 测试、完整构建、浏览器验收），以及部署回退测试。浏览器验收覆盖登录、管理权限、内容发布和失败回退，使用隔离数据库与内容副本。

本地验证记录：Node 24.15.0、npm 11.19.0 全新安装成功，`npm ls --depth=0` 无依赖冲突；`npm run verify` 通过，包括 4 项站点测试、18 项 UI 测试、全部 API/迁移检查、三个后台及 40 个公开页面构建、完整浏览器验收。CSV 导出额外验证中文、逗号、引号与换行的往返转换。

Windows 部署测试通过 2 项，其余 3 项因目录符号链接权限跳过，由 Linux CI 执行。ESLint 存量结果为 38 个错误和 1 个警告；分别使用 React Refresh 插件 0.5.2 和 0.5.7 检查同一份代码，所有诊断完全一致，本次升级未增加诊断。
