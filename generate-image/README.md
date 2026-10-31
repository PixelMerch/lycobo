# Claude Code 生图工具

独立 Node.js 24 命令行工具。Claude Code 可通过 Bash 调用，每次生成一张图片并保存到指定目录。不依赖浏览器或启动本地网站，不改网站后台配置、不扣网站用户积分；直接调用所配置中转站，按该中转站账户计费。默认模型为 `gpt-image-2.5`，当前支持 OpenAI 兼容 JSON Images 协议及当前中转站的异步任务回执，不用于 Gemini 原生协议。

## 本地配置

在仓库根目录执行：

```bash
cp generate-image/.env.example generate-image/.env
```

在 `generate-image/.env` 中填写当前中转站 API 地址和密钥。该文件已由仓库 `.gitignore` 排除；不要把密钥写进命令、提示词、Claude Code 配置或提交到 Git。工具不自动读取网站数据库中的加密渠道密钥。

## 调用

```bash
node generate-image/generate.mjs \
  --env-file generate-image/.env \
  --resolution 1.5K \
  --prompt '电商商品摄影，一只白色陶瓷杯放在浅灰桌面，自然侧光，无文字' \
  --folder ./output/product-images \
  --filename white-cup.png
```

四个业务参数：

| 参数 | 含义 |
| --- | --- |
| `--resolution` | `1K`=1024×1024、`1.5K`=1254×1254、`2K`=2048×2048、`4K`=3840×3840；也可直接传 `2880x3840` 等像素尺寸。具体尺寸仍需所选模型支持。 |
| `--prompt` | 非空生图提示词，支持中文 |
| `--folder` | 目标文件夹，支持相对／绝对路径，不存在时自动创建 |
| `--filename` | 文件名，不含目录；按实际返回图片格式补齐或修正扩展名 |

可选 `--model` 覆盖环境中的模型；`--timeout` 指定总等待秒数，默认1800，最大3600。不会自动放大／裁切返回图片，所选尺寸是提交给上游的请求值，实际输出取决于模型。工具不会覆盖已有图片。

标准输出只返回成功 JSON，Claude Code 从 `path` 获取最终图片的绝对路径；进度写入标准错误。退出码0表示已保存，非0表示未完成，不能当作生成成功。

```json
{"status":"saved","path":"/absolute/output/white-cup.png","bytes":123456,"format":"png","receipt":"/absolute/output/white-cup.png.task.json"}
```

## 异步续查与避免重复计费

工具仅提交一次 `POST /v1/images/generations`，携带同一次请求的 `Idempotency-Key` 和 `n: 1`；收到202后只查询原任务。支持同步 `data[].url/b64_json`，以及异步 `status_url`、`assets`、`result_url` 回执。下载原始结果，不将 API Key 转发给外部 CDN。

同目录 `.task.json` 保存提交标识与已受理任务地址，不保存密钥和提示词。网络超时、任务状态不明确或下载失败时，不要让 Claude Code重新创建任务。已取得任务地址时续查：

```bash
node generate-image/generate.mjs \
  --env-file generate-image/.env \
  --resume ./output/product-images/white-cup.png.task.json \
  --folder ./output/product-images \
  --filename white-cup.png
```

若回执只有 `submitting` 且没有任务地址，说明是否受理尚不明确；先在供应商后台核对原请求，工具拒绝盲目重发。任务明确失败也不自动重新生图。已成功保存后再次调用会拒绝覆盖，避免重复计费。

## 给 Claude Code 的调用约定

可在 Claude Code 的项目指令中引用本文，并告诉它：

> 需要生成图片时，使用本仓库 `generate-image/generate.mjs`。根据用户指定内容传入 resolution、prompt、folder、filename；配置文件为 `generate-image/.env`。用 Bash 参数正确引用提示词，不读取或打印密钥。只在退出码0且返回 status=saved 时报告完成。失败先查询已有回执，不自动再次提交付费任务。

输出目录建议放在仓库已忽略的 `data/` 内，或明确的项目素材目录。任务回执属于本地操作记录，不应当作可公开素材提交。
