# 主站字体与切片

主站使用阿里巴巴普惠体 3.0，字体文件版本 3.01，来自[官方站点](https://www.alibabafonts.com/)。页面不向字体 CDN 发请求。字标仍是独立的 SVG 路径，不参与正文加载。

## 字重与加载

| 用途                         | 字重 | 官方文件    |
| ---------------------------- | ---- | ----------- |
| 正文、说明、用户输入         | 400  | 55 Regular  |
| 导航、按钮、字段标题         | 500  | 65 Medium   |
| 区块标题、当前导航、首页标语 | 600  | 75 SemiBold |
| 少量重点、会员价格           | 700  | 85 Bold     |

每个字重按固定字符分组生成 WOFF2：西文、界面常用字、其余字符。`unicode-range` 控制按需下载，`font-display: swap` 保留加载期间的系统字体。每个字重的切片互不重叠，覆盖对应官方源字体的全部 Unicode 映射；缺字继续使用系统字体回退，不把字体不支持的字符伪装成已覆盖。

字体在 `apps/web/public/fonts/alibaba-puhuiti-3`，声明在 `apps/web/src/styles/fonts`；内容哈希写入 WOFF2 文件名，`_headers` 对这些文件设置一年不可变缓存。CSS 随 Vite 打包并生成版本化文件名，不缓存可变名字的字体声明。没有全量字体或全部切片的 preload，浏览器只请求实际用到的字符和字重。

## 重新生成

生成不是开发启动、CI 或部署的前置步骤；提交的 WOFF2 可以直接构建发布。只有更新字体来源或分组时才重新生成。

1. 建立隔离 Python 环境，按 `scripts/fonts/requirements.txt` 安装固定版本工具。
2. 从官方源下载 `scripts/fonts/subsets.json` 中的四个 TTF，放到仓库外的同一临时目录。下载链接为 `https://fonts.alibabadesign.com/AlibabaPuHuiTi-3/<不含扩展名的文件名>/<文件名>`；官方资源要求来自 `https://www.alibabafonts.com/` 的 Referer。原始文件不提交到仓库。
3. 在仓库外备份当前 `manifest.json` 后，运行 `python scripts/fonts/build-subsets.py --source-dir <临时字体目录>`。脚本先验证源文件 SHA256，再验证每个切片不丢字、分组不重叠、总覆盖完整；来源改变时校验失败，不静默采用新版。
4. 对照新旧 `manifest.json` 检查字符数、文件数和大小，只删除旧 manifest 中已经不再引用的哈希文件。运行 `pnpm exec biome check --write apps/web/src/styles/fonts scripts/fonts/subsets.json` 格式化生成的声明，用浏览器检查中英文及实际字体请求，执行 `pnpm check`。

`subsets.json` 的常用字分组来自当前界面文案频率，其他字符按码点划分。文案变化不会破坏覆盖或要求重新生成；它只可能让浏览器多下载一个已有切片。切片保留源字体版权和排版元数据，来源及授权链接见字体目录的 `NOTICE.txt`。

## 验证范围

本次以桌面与手机视口检查中文、英文、导航及输入区；不调用真实付费模型，不为字体外观运行全量 E2E。字体构建脚本自身校验数据完整性，浏览器检查是否实际使用目标字体与按需下载。
