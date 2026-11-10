-- 复制爆款按商品参考图数量生成并逐张计费，目标图不计入输出数量。
ALTER TABLE "generation_jobs" DROP CONSTRAINT "generation_jobs_count_check";--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_count_check" CHECK (
  requested_count between 1 and 20 and unit_credits > 0 and (
    requested_count <= 4
    or (requested_count <= 10 and input ? 'textileSet')
    or input ? 'variation'
    or (requested_count <= 10 and input->>'replica' = 'true'
        and jsonb_array_length(input->'referenceAssetIds') = requested_count + 1)
  )
);
