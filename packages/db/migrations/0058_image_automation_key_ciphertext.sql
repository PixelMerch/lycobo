-- 保留旧 Key 的摘要鉴权，新签发的 Key 保存可按需解密的密文。
SET LOCAL lock_timeout = '3s';--> statement-breakpoint
ALTER TABLE "generation_api_keys" ADD COLUMN "key_ciphertext" text;
