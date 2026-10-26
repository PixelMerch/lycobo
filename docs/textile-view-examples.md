# 家纺主图裂变示例资源

这组静态 AI 示例用于解释裂变类型中的拍摄视角，不能作为用户上传图片、任务结果或功能已经接入的证明。实际生成链路见 [家纺主图裂变](textile-generation.md)，这些静态示例不会被发送给生图服务。

- 生成日期：2026-10-26。
- 生成方式：内置 image_gen，每个视角独立生成一张；不是从参考截图裁切。
- 最终位置：`apps/web/public/studio/textile-views/<视角ID>.webp`。
- 交付尺寸：每张480×480，WebP质量84；生成原稿等比缩小，避免在列表加载高分辨率原图。
- 引用：`apps/web/src/features/commerce/textile-set/textile-views.ts`，选择面板与已选项共用。
- 画面要求：同系列暖象牙白菱格绗缝被与两个同色枕套、浅橡木床头、奶白墙面、浅橡木地板和左侧柔和日光；无文字、水印、拼图或白边。

## 提示词

每张使用下列共同提示词，加上表格中对应的 Camera composition：

```text
Use case: product-mockup. Create one photorealistic premium home-textile ecommerce example photograph, square 480x480 intended final asset. Same coherent collection across all images: a warm ivory cotton quilt with subtle diamond quilting and TWO matching ivory rectangular pillowcases only, queen bed, simple light natural oak headboard, warm off-white bedroom walls, pale oak floor, small round light oak bedside tables, daylight softly entering from a window on the left. Restrained Scandinavian bedroom, realistic fabric texture, neutral exposure, no people, no additional throw pillows, no plants or distracting props. Fill the square with the photograph, no whitespace bands, no borders, no text, no labels, no watermark, no collage. Camera composition:
```

| 视角ID | 名称 | Camera composition |
| --- | --- | --- |
| overhead-wide | 俯拍全景 | High overhead view, camera above the foot of the bed looking down at 70 degrees, the entire bed and both bedside tables visible. |
| overhead-close | 俯拍近景 | True overhead near view from directly above the bed, crop to the pillows and upper two-thirds of the quilt, show its rectangular quilting. |
| close-up | 近距离特写 | Close product view from above the left side, focus on the junction of one pillow and casually folded duvet, a small section of bed only. |
| pillow | 枕头特写 | Eye-level close-up of the two ivory quilted pillowcases against the oak headboard, pillows fill most of the frame, only a little quilt visible. |
| bed-end | 床尾特写 | Low close-up of the foot corner of the bed, focus on the hanging ivory quilt edge, neat stitched hem and drape, bed feet and oak floor visible. |
| angled-overhead | 45度角俯拍 | Wide full bed view from front-left corner, elevated camera tilted downward 45 degrees, clear diagonal perspective, entire quilt and both pillows visible. |
| front | 正面 | Perfectly centered symmetrical straight-on view from the foot of the bed at mattress height, entire bed headboard and two nightstands visible. |
| angled-level | 45度角平拍 | Wide full bed view from front-right corner, camera level at mattress height with horizontal lens, 45 degree diagonal perspective, entire bed visible. |
| draped | 被子拖地 | Three-quarter front view, show the same ivory quilt pulled longer over the bed foot so its generous edge pools softly onto the oak floor, emphasize floor drape, full bed visible. |
| fabric | 面料特写 | Extreme macro detail of the ivory quilt surface, tactile fine cotton weave and raised diamond quilting stitch, soft folds and side lighting, no furniture visible. |
