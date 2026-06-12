# cloudImage

一个基于 `uni-app + Vue 3` 实现的微信小程序图片云存储示例项目。  
项目使用微信云开发能力完成图片上传、分组管理、图片预览与删除，适合用来学习：

- `uni-app` 小程序项目结构
- 微信云开发初始化与调用方式
- 图片上传到云存储的基本流程
- 基于云数据库实现简单的图片分组管理

## 项目简介

当前项目聚焦于“微信小程序端的图片云存储”这一场景，前端通过 `uni-app` 构建，运行时依赖微信小程序环境中的 `wx.cloud` 能力。

项目首页提供一个类似轻量图库的管理界面，支持创建分组、进入分组、上传图片、图片预览、删除单张图片、批量删除图片，以及通过面包屑进行路径导航。

需要注意的是：虽然 `package.json` 中包含了多个平台的 `uni-app` 脚本，但当前业务代码明确依赖 `wx.cloud`，因此实际功能仅适用于微信小程序端。

## 功能特性

- 图片上传到微信云存储
- 基于路径的图片分组管理
- 自动初始化根目录 `/root`
- 面包屑导航与返回上级目录
- 分组列表与图片列表混合展示
- 图片预览
- 图片名称与文件大小展示
- 单张图片删除
- 长按进入图片批量选择模式
- 批量删除图片
- 单张/批量图片移动到其他分组
- 图片重命名
- 分组重命名，并自动更新子分组与图片所属路径
- 当前分组内按名称或扩展名搜索
- 当前分组内按默认顺序、名称、最近更新、图片大小排序
- 下拉刷新
- 简单分页加载与上拉加载更多
- 图片加载失败占位处理
- 空状态与骨架屏展示

## 技术栈

- `uni-app`
- `Vue 3`
- `Vite`
- 微信小程序云开发
  - 云存储
  - 云数据库

## 项目结构

```text
cloudImage
├─ src
│  ├─ pages
│  │  └─ index
│  │     └─ index.vue       # 首页，负责图片管理界面与交互
│  ├─ utils
│  │  └─ cloud.js           # 云开发相关逻辑：目录、图片、数据库操作
│  ├─ App.vue               # 应用根组件
│  ├─ main.js               # 应用入口，初始化微信云开发
│  ├─ manifest.json         # 小程序 appid、cloudEnv 等配置
│  └─ pages.json            # 页面路由与导航配置
├─ index.html
├─ package.json
└─ README.md
```

## 运行前准备

在本地运行本项目前，需要先准备以下环境：

### 1. Node.js

建议使用较新的 LTS 版本，并确保本地可使用 `npm` 或 `yarn`。

### 2. 微信开发者工具

当前项目的核心能力依赖微信小程序环境，调试时需要使用微信开发者工具打开编译产物。

### 3. 微信云开发环境

项目运行依赖微信云开发，请提前在微信公众平台或微信开发者工具中创建并配置云开发环境。

当前项目在 [`src/manifest.json`](/D:/workspace/my_study/cloudImage/src/manifest.json:1) 中已经配置了：

- `mp-weixin.appid`
- `mp-weixin.cloudEnv`

如果你使用自己的小程序和云环境，需要把这里替换成你自己的配置。

## 安装依赖

推荐使用 `yarn`：

```bash
yarn install
```

也可以使用：

```bash
npm install
```

## 本地启动

启动微信小程序开发模式：

```bash
yarn dev:mp-weixin
```

启动后，`uni-app` 会生成微信小程序构建产物。随后可在微信开发者工具中导入对应输出目录进行调试。

如果你需要构建正式包，可使用：

```bash
yarn build:mp-weixin
```

## 微信云开发配置说明

### 云环境初始化

项目会在 [`src/main.js`](/D:/workspace/my_study/cloudImage/src/main.js:1) 中读取 `manifest.json` 的 `cloudEnv`，并在微信小程序端执行：

- `wx.cloud.init({ env, traceUser: true })`

如果当前不是微信小程序环境，云开发相关逻辑不会正常工作。

### 平台限制

云开发访问逻辑位于 [`src/utils/cloud.js`](/D:/workspace/my_study/cloudImage/src/utils/cloud.js:1)。

其中 `assertWechatCloud()` 会在非微信小程序环境下直接抛错：

- `当前环境不支持微信云开发，请在微信小程序端运行。`

这意味着：

- `dev:h5` 可以启动 `uni-app` 工程，但当前图片云存储功能并不适用于 H5
- 当前仓库更适合作为微信小程序示例项目，而不是多端通用图片管理项目

## 云数据库集合建议

当前代码中固定使用了两个集合：

- `folders`
- `images`

对应常量定义见 [`src/utils/cloud.js`](/D:/workspace/my_study/cloudImage/src/utils/cloud.js:1)。

### `folders` 集合建议字段

```json
{
  "name": "示例分组",
  "path": "/root/示例分组",
  "parentPath": "/root",
  "depth": 1,
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

字段说明：

- `name`：分组名称
- `path`：当前分组完整路径，作为唯一标识使用
- `parentPath`：父级路径
- `depth`：分组层级深度
- `createdAt` / `updatedAt`：时间戳

### `images` 集合建议字段

```json
{
  "name": "demo.jpg",
  "ext": "jpg",
  "size": 102400,
  "folderPath": "/root/示例分组",
  "cloudFileId": "cloud://xxx",
  "filePath": "images/root/示例分组/1710000000000_abcd12.jpg",
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

字段说明：

- `name`：图片名称
- `ext`：图片扩展名
- `size`：文件大小，优先使用选择文件时返回的大小，缺失时尝试通过 `uni.getFileInfo()` 补齐
- `folderPath`：所属分组路径
- `cloudFileId`：云存储文件 ID
- `filePath`：上传到云存储后的路径
- `createdAt`：上传时间
- `updatedAt`：最近重命名或移动时间

## 核心实现说明

### 1. 根目录自动初始化

应用启动后会先调用 `ensureRootFolder()`，如果数据库中不存在 `/root`，则自动创建一个根目录记录。

### 2. 分组管理

分组本质上通过 `path` 和 `parentPath` 来描述层级关系，而不是依赖嵌套文档结构。  
例如：

- 根目录：`/root`
- 一级分组：`/root/旅行`
- 二级分组：`/root/旅行/上海`

这种设计实现简单，适合当前学习型项目。

### 3. 图片上传

上传流程大致如下：

1. 页面通过 `uni.chooseImage()` 选择图片
2. 调用 `wx.cloud.uploadFile()` 上传到云存储
3. 将图片元数据写入 `images` 集合
4. 刷新当前目录内容

### 4. 图片展示

页面加载时会查询当前目录下的：

- 子分组列表
- 图片列表

图片展示前还会通过 `wx.cloud.getTempFileURL()` 获取临时访问地址，用于页面预览。

### 5. 删除逻辑

- 删除图片时，同时删除云存储文件与数据库记录
- 删除分组时，会先检查该分组下是否还有子分组或图片
- 非空分组不允许删除

### 6. 搜索与排序

首页在当前分组数据加载完成后进行前端筛选，支持按图片/分组名称以及图片扩展名匹配。排序同样在当前分组内完成，保留默认顺序，同时支持名称、最近更新与图片大小排序。

### 7. 重命名与移动

- 图片重命名会更新 `images.name`、`images.ext` 和 `images.updatedAt`
- 图片移动会更新 `images.folderPath` 和 `images.updatedAt`
- 分组重命名会更新当前分组的 `name/path/updatedAt`，并级联更新所有子分组 `path/parentPath/depth` 以及子树下图片的 `folderPath`
- 分组重命名不会迁移云存储中的 `filePath`，云存储文件 ID 保持不变

## 页面交互说明

首页位于 [`src/pages/index/index.vue`](/D:/workspace/my_study/cloudImage/src/pages/index/index.vue:1)，当前包含以下交互：

- 顶部工具栏：返回、新建分组、上传、刷新
- 面包屑路径导航
- 搜索框：在当前分组内按名称或扩展名过滤
- 排序选择：默认排序、名称排序、最近更新、图片大小
- 网格方式展示分组和图片
- 长按图片后弹出重命名、移动、删除、进入选择模式菜单
- 长按分组后弹出重命名、删除菜单
- 长按进入批量选择模式
- 批量选择后可批量移动或批量删除图片
- 下拉刷新与分页加载

## 可用脚本

常用命令如下：

```bash
yarn dev:mp-weixin
yarn build:mp-weixin
```

项目中还保留了 `uni-app` 默认提供的多端命令，例如：

- `yarn dev:h5`
- `yarn dev:mp-qq`
- `yarn dev:mp-alipay`

但这些平台当前没有适配 `wx.cloud` 依赖，请不要把它们视为已支持的平台能力。

## 已知限制

- 当前功能仅适用于微信小程序端
- 依赖微信云开发，未提供独立后端服务
- 历史图片记录如果是在旧版本中上传，`images.size` 仍可能为 `0`
- 分组重命名会更新数据库路径，但不会同步重命名云存储中的文件路径
- 未实现登录鉴权、用户隔离和权限控制
- 未实现缩略图压缩、回收站等增强能力
- 删除分组仅支持删除空分组
- 数据结构与查询方式更适合学习和中小规模场景

## 后续可优化方向

- 为图片记录补充宽高、上传用户等元数据
- 支持批量上传进度明细、图片跨分组复制、分组移动
- 接入云函数处理缩略图、压缩与图片审核
- 为数据库字段补充索引与更清晰的约束设计
- 补充权限控制，区分不同用户的私有图片空间
- 增加 README 截图或操作演示，降低接手成本
