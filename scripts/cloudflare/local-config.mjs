/** Local workerd fixtures only. These files must never be used to publish cloud resources. */
export function localConfig(name) {
  if (!["api", "worker", "assets"].includes(name)) throw new Error("Unknown local service");
  return {
    name: `${name === "worker" ? "lycobo-generation" : `lycobo-${name}`}-local`,
    main: name === "assets" ? "src/local.ts" : "cloudflare/local.ts",
    compatibility_date: "2026-10-23",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    images: { binding: "IMAGES" },
    r2_buckets: [{ binding: "IMAGES_BUCKET", bucket_name: "lycobo" }],
    ...(name === "assets"
      ? {}
      : {
          hyperdrive: [
            {
              binding: "HYPERDRIVE",
              id: "00000000000000000000000000000000",
              localConnectionString:
                "postgresql://lycoboai:local_dev_only@127.0.0.1:55432/lycoboai",
            },
          ],
        }),
  };
}
