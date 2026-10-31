ALTER TABLE "model_catalog" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "model_catalog" ADD COLUMN "capability_summary" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Preserve the existing public menu copy while moving ownership to the catalog.
UPDATE model_catalog m SET description=v.description,capability_summary=v.summary
FROM (VALUES
  ('gpt-image-2','商品展示与日常图片编辑','图文生成 · 参考图编辑'),
  ('gpt-image-2.5','商业摄影与创意海报','文字排版 · 写实画面'),
  ('nano-banana-2.1','商品、人像与场景创作','场景生成 · 创意表达'),
  ('gemini-nano-banana-2.1','商品、人像与场景创作','场景生成 · 创意表达'),
  ('gemini-3.1-flash-image-preview','商品、人像与场景创作','场景生成 · 创意表达')
) AS v(code,description,summary)
WHERE m.code=v.code;
