import { spawnSync } from "node:child_process";

export const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: options.env ?? process.env,
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout ?? "";
};

export const runJson = (command, args, options = {}) =>
  JSON.parse(run(command, args, options));
