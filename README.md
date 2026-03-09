# 🔥 共学营挑战日历 | Co-Learning Challenge Calendar

> 一站式可视化共学营打卡挑战追踪系统，实时展示学员闯关进度与成绩统计。

[![GitHub Repo](https://img.shields.io/badge/仓库-0xherstory%2FWWW6.5-orange?logo=github)](https://github.com/0xherstory/WWW6.5)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8?logo=tailwindcss)](https://tailwindcss.com)

---

## 📖 项目简介

本项目为 [0xherstory/WWW6.5](https://github.com/0xherstory/WWW6.5) 共学营提供的**挑战日历看板**，数据全部实时从 GitHub API 获取。

**共学营规则概述：**

- 学员 fork 仓库后，新建以个人昵称命名的文件夹
- 每日提交包含 `Day` / `day` / `DAY` 等命名的 `.sol` 合约代码（大小写不敏感）
- 通过 Pull Request 提交作业，PR 合并（merge）即提交成功，关闭（close）即拒绝
- 共 **30 天**，分 **4 周**进行，每周有截止时间
- 超时提交的作业会被标记为 `weekN-late` 标签

### 📅 每周安排

| 周次 | 天数范围 | 截止时间 |
|------|---------|---------|
| 第 1 周 | Day 1 ~ Day 7 | 2026-03-09 00:00 (UTC+8) |
| 第 2 周 | Day 8 ~ Day 14 | 2026-03-16 00:00 (UTC+8) |
| 第 3 周 | Day 15 ~ Day 21 | 2026-03-23 00:00 (UTC+8) |
| 第 4 周 | Day 22 ~ Day 30 | 2026-03-30 00:00 (UTC+8) |

### ✅ 当周闯关成功条件

1. **交满**当周范围内每天的作业（所有 `.sol` 文件）
2. 当周**没有** `weekN-late` 超时标记

---

## ✨ 功能特性

### 📊 总体统计概览（默认视图）

- **关键指标卡片**：学员总数、总提交数、平均完成率、全勤学员数
- **30 天挑战热力图日历**：按周分组，颜色深浅反映提交人数密度
- **每日提交趋势柱状图**：按周配色的交互式 Recharts 图表
- **每周闯关成功名单**：可展开的周折叠面板，含学员昵称、GitHub 账号、完成天数
- **学员排行榜**：可搜索，显示进度条与各周闯关状态徽章

### 👤 个人详情视图

- 点击任意学员进入个人仪表盘
- 个人日历（✅/❌ 每日打卡状态）
- 逐周汇总：成功 / 超时 / 未完成
- 个人统计：完成天数、完成率、通过周数、超时周数

### 🛠️ 运营工具

- 每周闯关成功名单，含**昵称 + GitHub 用户名 + 个人主页链接**
- **📋 一键复制名单**，格式化输出方便结算
- **⚙️ GitHub Token 配置**：解除 API 频率限制（60 → 5000 次/小时）
- API 限流时，错误页面直接提供「配置 Token」入口，无需刷新

### 🌐 双语支持

- 默认中文（中文）界面
- 一键切换 English
- 所有 UI 文案完整翻译

### 🎨 设计风格

- 温暖渐变背景 + 浮动 emoji 装饰 🌟
- 每周独立配色主题（橙/玫红/紫/琥珀）
- 毛玻璃效果头部、圆角卡片、柔和阴影
- 流畅动画：滑入、悬停缩放、浮动效果
- 响应式布局，适配手机、平板、桌面

---

## 🏗️ 技术栈

| 技术 | 用途 |
|-----|------|
| [React 19](https://react.dev) | 前端框架 |
| [TypeScript 5.9](https://www.typescriptlang.org) | 类型安全 |
| [Vite 7](https://vitejs.dev) | 构建工具 |
| [Tailwind CSS 4](https://tailwindcss.com) | 原子化样式 |
| [Recharts 3](https://recharts.org) | 图表库 |
| [GitHub REST API](https://docs.github.com/en/rest) | 数据源 |

---

## 📂 项目结构

```
├── index.html              # HTML 入口
├── src/
│   ├── main.tsx            # React 挂载点
│   ├── App.tsx             # 主应用（所有页面组件）
│   ├── api.ts              # GitHub API 请求 & 数据解析
│   ├── i18n.tsx            # 国际化（中/英）
│   ├── index.css           # 全局样式 & 动画
│   └── utils/
│       └── cn.ts           # clsx + tailwind-merge 工具函数
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔧 数据处理逻辑

### 作业识别规则

通过 GitHub API 获取仓库文件树，遍历所有 `.sol` 文件：

```
{学员昵称文件夹}/{任意子路径}/[包含 day + 数字].sol
```

- **大小写不敏感**：`day1.sol`、`Day1.sol`、`DAY1.sol`、`DAy_01.sol` 均可识别
- 正则表达式：`/day[_\-\s]?0*(\d+)/i`
- 支持前导零：`Day01` → Day 1
- 支持分隔符：`Day_1`、`Day-1`、`Day 1`

### 学员与 GitHub 账号关联

1. 获取仓库所有已合并 PR
2. 对每位 PR 作者，获取其 PR 修改的文件列表
3. 通过文件路径中的顶层文件夹名关联到学员昵称

### 超时判定

- 检查 PR 标签中是否包含 `weekN-late`（`N` = 1~4）
- 正则匹配：`/week(\d+)[_\-\s]?late/i`

### 周闯关成功

同时满足以下两个条件：
1. 该周范围内**每天**都有作业提交
2. 该学员在该周**没有** `weekN-late` 标签

---

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

浏览器打开 `http://localhost:5173` 查看。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录，为单文件 HTML（`vite-plugin-singlefile`）。

### 预览构建结果

```bash
npm run preview
```

---

## ⚙️ GitHub Token 配置

GitHub API 未认证请求限额为 **60 次/小时**，数据较多时容易触发限流。

配置 Token 后可提升至 **5000 次/小时**：

1. 前往 [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. 创建一个 Token（无需勾选任何权限，public repo 读取无需额外权限）
3. 在看板右上角点击 **⚙️ 设置**，输入 Token 并点击「应用」
4. 如遇 API 限流错误，错误页面也会直接显示「配置 Token」按钮

> ⚠️ Token 仅在浏览器内存中使用，页面关闭后自动清除，不会被存储或上传。

---

## 📸 界面预览

### 总体统计

- 🔢 关键数据指标卡
- 📅 30 天热力图日历（按周分组）
- 📊 每日提交趋势图
- 🏆 每周闯关成功名单（可展开、可复制）
- 👥 学员排行榜（可搜索）

### 个人详情

- 👤 个人信息卡
- 📅 个人打卡日历（✅/❌）
- 📊 个人统计指标
- 🗓️ 逐周状态汇总

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 License

MIT

---

<p align="center">
  🌟 <strong>一起学习，一起成长</strong> · Learn together, grow together 🌟
</p>
