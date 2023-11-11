import { Logger, Plugin } from "vite";
import * as path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fvn32 } from "./fvn32";
import { existsSync } from "node:fs";

const wasmPageSize = 0x10000;

export interface CCFlags {
    compiler?: string[];
    linker?: string[];
}

export interface CCOptions {
    llvm?: string;
    watch?: RegExp;
    sources?: string[];
    headerSearchPath?: string[];
    output?: string;
    stackSize?: number;
    totalMemory?: number;
    buildDir?: string;
    compilerFlags?: string[];
    linkerFlags?: string[];
    stdlib?: string;
    std?: string;
    debug?: boolean;
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
    const llvm: string = options.llvm ?? (process.env.LLVM_PATH ?? "");
    const watch: RegExp = options.watch ?? /src\/.*\.[hc]$/;
    const sources: string[] = options.sources ?? [];
    const headerSearchPath: string[] = options.headerSearchPath ?? [];
    const output: string = options.output ?? "main.wasm";
    const buildDir: string = options.buildDir ?? "build";
    let stackSize: number | undefined = options.stackSize;
    let totalMemory: number | undefined = options.totalMemory;

    // check if file should be trig recompilation
    const checkFile = (filepath: string) => watch.test(filepath);
    const alignMemoryWithWarning = (bytes: number, name: string) => {
        const memorySize = Math.ceil(bytes / wasmPageSize) * wasmPageSize;
        if (memorySize !== bytes) {
            logger.warn(`[cc] ${name} value increased from ${bytes} to ${memorySize}`);
        }
        return memorySize;
    };

    const build = async (command: string) => {
        const stdlib: string = options.stdlib ?? "";
        const std: string = options.std ?? "c17";
        const debug = options.debug ?? command === "serve";
        const compilerFlags: string[] = options.compilerFlags ?? (
            debug ? [
                "-Og",
                "-g"
            ] : [
                "-Os",
                "-flto",

                "-fomit-frame-pointer",
                "-ffunction-sections",
                "-fdata-sections",
                
                // "-fstrict-aliasing",
                // "-fstrict-overflow",
                // "-fno-align-functions",
                
                // "-falign-jumps",
                // "-fno-align-loops",
                // "-falign-labels",
                // "-fno-inline-small-functions",
                // "-fno-inline-functions-called-once",
                // "-fno-inline-functions",
            ]
        );
        const linkerFlags: string[] = options.linkerFlags ?? (
            debug ? [
                "--lto-O0",
                "-O0",
            ] : [
                "--strip-all",
                "--lto-O3",
                "-O3",
            ]
        );

        try {
            await mkdir(buildDir, { recursive: true });
        }
        catch {
            // ignore
        }

        try {
            const compileFlags: string[] = [
                ...headerSearchPath.map((includeDir) => `-I${includeDir}`),
                "-Wall",
                "--target=wasm32",
                "-fvisibility=hidden",
                `-std=${std}`,
                "-ffast-math",
                "-fno-vectorize",
                "-fno-tree-vectorize",
                // wasm features:
                "-mnontrapping-fptoint",
                // "-msimd128",
                "-msign-ext",
                "-mbulk-memory",
                "-mmutable-globals",
                "-mmultivalue",
                ...compilerFlags,
            ];
            if (stdlib) {
                compileFlags.push(`-stdlib=${stdlib}`);
            }
            else {
                compileFlags.push("-nostdlib");
            }

            const linkFlags: string[] = [
                "--no-entry",
                "--export-dynamic",
                "--allow-undefined",
                "--error-limit=0",
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
            let errorsCount = 0;
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
                const result = await run(clang, [
                    "-c", ...compileFlags, "-o", outputFilepath, src,
                ]);
                const compileError = result !== 0;
                if (compileError) {
                    ++errorsCount;
                }
                try {
                    output1 = await readFile(outputFilepath);
                }
                catch {
                    // not found: error
                    logger.error("[cc] output compiled object file is not found");
                }
                const isObjectChanged = (output0 && output1 && 0 !== Buffer.compare(output0, output1)) || !output0;
                if (compileError || isObjectChanged) {
                    anyObjectFileChanged = true;
                }
                return outputFilepath;
            }));
            logger.info(`[cc] ${objectFiles} objects done in ${(performance.now() - ts) | 0} ms`);

            if (anyObjectFileChanged) {
                if (errorsCount) {
                    logger.error("[cc] failed, check compile errors");
                }
                else {
                    ts = performance.now();
                    // link object files to wasm file
                    const linkResult = await run(ld, [
                        ...linkFlags,
                        "-o", outputWasmFilepath,
                        ...objectFiles,
                    ]);
                    if (linkResult) {
                        logger.error("[cc] link failed (" + ((performance.now() - ts) | 0) + " ms)");
                    }
                    else {
                        logger.info("[cc] binary linked (" + ((performance.now() - ts) | 0) + " ms)");
                    }
                }
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
                        await build(config.command);
                        buildInProgress = false;
                    }
                }, 200);
            }
            else {
                await build(config.command);
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