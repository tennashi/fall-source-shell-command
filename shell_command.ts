import { defineSource, type Source } from "jsr:@vim-fall/std@0.12.0";

export type Detail = {
  line: string;
}

export type ShellCommandOptions = {
  cmd: string;
  args?: string[];
};

const decoder = new TextDecoder();

async function* readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
) {
  let result;
  let buf = "";
  while (!(result = await reader.read()).done) {
    buf += decoder.decode(result.value, { stream: true });

    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      yield line;
    }
  }

  // flush
  const rest = decoder.decode();
  buf += rest;
  for (const line of buf.split("\n").filter((line) => line)) {
    yield line;
  }
}

export function shellCommand(
  options: Readonly<ShellCommandOptions>,
): Source<Detail> {
  return defineSource(async function* (_denops, _params, { signal }) {
    const command = new Deno.Command(options.cmd, {
      args: options.args,
      stdout: "piped",
    });

    const process = command.spawn();
    const reader = process.stdout.getReader();

    let id = 0;
    for await (const line of readStream(reader)) {
      if (signal?.aborted) {
        process.kill("SIGTERM");
        return;
      }

      yield {
        id: id++,
        value: line,
        detail: { line: line },
      };
    }

    await process.status;
  });
}
