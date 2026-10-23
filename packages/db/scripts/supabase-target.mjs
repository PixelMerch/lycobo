/** Validate the explicit migration target without exposing credentials in errors. */
export function supabaseMigrationTarget(env) {
  const project = env.SUPABASE_PROJECT_REF;
  if (!project || !/^[a-z]{20}$/.test(project)) {
    throw new Error("请在 .env 中填写 SUPABASE_PROJECT_REF。");
  }
  let url;
  try {
    url = new URL(env.SUPABASE_DATABASE_URL ?? "");
  } catch {
    throw new Error("请在 .env 中填写有效的 SUPABASE_DATABASE_URL。");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== `db.${project}.supabase.co` ||
    (url.port && url.port !== "5432") ||
    url.pathname !== "/postgres" ||
    url.username !== "postgres" ||
    url.hash
  ) {
    throw new Error("迁移目标须为 SUPABASE_PROJECT_REF 对应项目的 PostgreSQL 5432 直连地址。");
  }
  let password;
  try {
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error("数据库密码编码无效；请对密码中的特殊字符进行 URL 编码。");
  }
  if (!password || /\[YOUR-PASSWORD\]|YOUR_PASSWORD|CHANGE_ME/i.test(password)) {
    throw new Error("请先替换 .env 中 SUPABASE_DATABASE_URL 的 [YOUR-PASSWORD]，尚未连接数据库。");
  }
  const allowedOptions = new Set(["sslmode", "sslrootcert", "connect_timeout", "application_name"]);
  if ([...url.searchParams.keys()].some((key) => !allowedOptions.has(key))) {
    throw new Error("连接参数只支持 TLS、连接超时与应用名称，不能通过查询参数覆盖目标。");
  }
  if (url.searchParams.getAll("sslmode").length !== 1) {
    throw new Error("连接须且仅须包含一个 sslmode 参数。");
  }
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) {
    throw new Error("Supabase 连接须包含 sslmode=require、verify-ca 或 verify-full。");
  }
  return { url: url.href, host: url.hostname };
}
