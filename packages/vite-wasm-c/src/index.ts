import { Logger, Plugin } from "vite";
import * as path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fvn32 } from "./fvn32";
import { existsSync } from "node:fs";

const wasmPageSize = 0x10000;

export interface CCOptions {
    llvm?: string,
    watch?: RegExp,
    sources?: string[],
    headerSearchPath?: string[],
    output?: string,
    stackSize?: number,
    totalMemory?: number,
    buildDir?: string,
    compilerFlags?: string[],
    linkerFlags?: string[],
}

const run = (cmd: string, args: string[]): Promise<number> => {
    const child = spawn(cmd, args, {
        stdio: "inherit",
    });

    return new Promise((resolve) => {
        child.on("close", resolve);
    });
};

export const cc = (options: CCOptions): Plugin => {
    let logger: Logger;
    const llvm: string = options.llvm ?? process.env.LLVM_PATH ?? "";
    const watch: RegExp = options.watch ?? /src\/.*\.[hc]$/;
    const sources: string[] = options.sources ?? [];
    const headerSearchPath: string[] = options.headerSearchPath ?? [];
    const output: string = options.output ?? "main.wasm";
    const buildDir: string = options.buildDir ?? "build";
    let stackSize: number | undefined = options.stackSize;
    let totalMemory: number | undefined = options.totalMemory;
    const compilerFlags: string[] = options.compilerFlags ?? [];
    const linkerFlags: string[] = options.linkerFlags ?? [];

    // check if file should be trig recompilation
    const checkFile = (filepath: string) => watch.test(filepath);
    const alignMemoryWithWarning = (bytes: number, name: string) => {
        const memorySize = Math.ceil(bytes / wasmPageSize) * wasmPageSize;
        if (memorySize !== bytes) {
            logger.warn(`[cc] ${name} value increased from ${bytes} to ${memorySize}`);
        }
        return memorySize;
    };

    const build = async (...files: string[]) => {
        /*ignore */files;

        try {
            await mkdir(buildDir, { recursive: true });
        }
        catch {
            // ignore
        }

        try {
            const compileFlags: string[] = [
                ...headerSearchPath.map((includeDir) => `-I${includeDir}`),
                //"-Wall",
                "--target=wasm32",
                "-nostdlib",
                "-fvisibility=hidden",
                "-std=c11",
                "-ffast-math",
                "-O0",
                ...compilerFlags,
            ];
            const linkFlags: string[] = [
                "--no-entry",
                "--export-dynamic",
                "--allow-undefined",
                "--error-limit=0",
                "--lto-O0",
                "-O0",
                ...linkerFlags,
            ];
            if (stackSize) {
                linkFlags.push("-z", `stack-size=${stackSize}`);
            }
            if (totalMemory) {
                linkFlags.push(`--initial-memory=${totalMemory}`);
            }

            const clang = path.join(llvm, "bin", "clang");
            const ld = path.join(llvm, "bin", "wasm-ld");
            let ts = performance.now();
            const outputWasmFilepath = path.join(buildDir, output);
            let anyObjectFileChanged = !existsSync(outputWasmFilepath);
            // for each source file create object file
            const objectFiles = await Promise.all(sources.map(async (src) => {
                // logger.info("[cc] compile: " + src);

                // const translation = await runReadText(clang, [
                //     "-c", ...compileFlags, "-E", "-P", src,
                // ]);
                // writeFile(outputAssembledSourceCode, translation, { encoding: "utf8" });
                const outputFilepath = path.join(buildDir, path.parse(src).name + "-" + fvn32(src).toString(16) + ".o");
                let output0;
                let output1;
                try {
                    output0 = await readFile(outputFilepath);
                }
                catch {
                    // not found
                }
                await run(clang, [
                    "-c", ...compileFlags, "-o", outputFilepath, src,
                ]);
                try {
                    output1 = await readFile(outputFilepath);
                }
                catch {
                    // not found: error
                    logger.error("[cc] output compiled object file is not found");
                }
                if (output0 && output1 && 0 !== Buffer.compare(output0, output1)) {
                    anyObjectFileChanged = true;
                }
                return outputFilepath;
            }));
            logger.info("[cc] all files compiled: " + ((performance.now() - ts) | 0) + " ms");

            if (anyObjectFileChanged) {
                ts = performance.now();
                // link object files to wasm file
                await run(ld, [
                    ...linkFlags,
                    "-o", outputWasmFilepath,
                    ...objectFiles,
                ]);
                logger.info("[cc] binary linked: " + ((performance.now() - ts) | 0) + " ms");
            }
            else {
                logger.info("[cc] binary not affected");
            }
        }
        catch (error) {
            logger.error(error);
            logger.warn("[cc] build error");
        }
    };

    let changed = true;
    let buildInProgress = false;

    return {
        name: "cc",
        enforce: "pre",
        async configResolved(config) {
            logger = config.logger;
            if (!llvm) {
                logger.error("[cc] set `LLVM_PATH` environment variable or define `{ llvm }` option");
            }
            if (stackSize) {
                stackSize = alignMemoryWithWarning(stackSize, "stackSize");
            }
            if (totalMemory) {
                totalMemory = alignMemoryWithWarning(totalMemory, "totalMemory");
            }
            if (config.command === "serve") {
                setInterval(async () => {
                    if (changed && !buildInProgress) {
                        changed = false;
                        buildInProgress = true;
                        await build();
                        buildInProgress = false;
                    }
                }, 200);
            }
            else {
                build();
            }
        },
        async configureServer(server) {
            server.watcher.on("add", (filepath) => {
                if (checkFile(filepath)) {
                    logger.info("[cc] file is added: " + filepath);
                    changed = true;
                }
            }).on("change", (filepath) => {
                if (checkFile(filepath)) {
                    logger.info("[cc] file is changed: " + filepath);
                    changed = true;
                }
            }).on("unlink", (filepath) => {
                if (checkFile(filepath)) {
                    logger.info("[cc] file is removed: " + filepath);
                    changed = true;
                }
            }).on("error", (error) => {
                logger.error("[cc] error: " + error);
            })
        },
    };
};