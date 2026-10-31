import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const cloudbaseEnvironment = "lycobo-d9gyvxkegc54a1257";
export const cloudbaseApplication = "lycobo-web";

export async function prepareWeb(source, destination) {
  if (
    !destination ||
    path.resolve(source) === path.resolve(destination) ||
    path.resolve(destination).startsWith(`${path.resolve(source)}${path.sep}`)
  )
    throw new Error("A separate empty deployment directory is required.");
  const inspect = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        entry.isSymbolicLink() ||
        /^(?:\.env(?:\..*)?|node_modules|backups|functions|_worker\.js|cloudbaserc\.json)$/.test(
          entry.name,
        )
      )
        throw new Error("Only built static assets may enter the deployment package.");
      if (entry.isDirectory()) await inspect(path.join(directory, entry.name));
      else if (!entry.isFile()) throw new Error("Unsupported deployment file.");
    }
  };
  await inspect(source);
  const html = await readFile(path.join(source, "index.html"), "utf8");
  if (!html.includes('<div id="root">')) throw new Error("Build the Vite frontend first.");
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error("Deployment directory must be empty.");
  for (const entry of await readdir(source))
    await cp(path.join(source, entry), path.join(destination, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  if (!html.includes("<head>")) throw new Error("Frontend HTML must have a head element.");
  await writeFile(
    path.join(destination, "cloudbase-entry.js"),
    `if (location.origin === "https://${cloudbaseEnvironment}-1311968085.tcloudbaseapp.com") {\n` +
      `  location.replace("https://${cloudbaseEnvironment}-1311968085.ap-shanghai.app.tcloudbase.com" + location.pathname + location.search + location.hash);\n}\n`,
  );
  await writeFile(
    path.join(destination, "index.html"),
    html.replace("<head>", '<head><script src="/cloudbase-entry.js"></script>'),
  );
  await writeFile(
    path.join(destination, "cloudbaserc.json"),
    `${JSON.stringify(
      {
        envId: cloudbaseEnvironment,
        app: {
          serviceName: cloudbaseApplication,
          framework: "static",
          installCommand: "",
          buildCommand: "",
          outputDir: "./",
          deployPath: "/",
        },
      },
      null,
      2,
    )}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  await prepareWeb(path.join(root, "apps/web/dist"), process.argv[2]);
  console.info("CloudBase deployment package prepared: static frontend only.");
}
