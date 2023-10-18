import { defineConfig, loadEnv } from "vite";
import { cc } from "@eliasku/vite-plugin-wasm-c";

export default defineConfig(async ({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const llvm = env.LLVM_ROOT;
    console.info("llvm: " + llvm);

    return {
        build: {
            terserOptions: {
                mangle: {
                    properties: {
                        regex: /^_[a-zA-Z]/,
                        keep_quoted: true,
                    },
                },
                compress: {
                    evaluate: true,
                    dead_code: true,
                    passes: 1000,
                },
            },
            minify: "terser",
            assetsInlineLimit: 0,
            modulePreload: false,
        },
        server: {
            port: 8080,
        },
        base: "",
        plugins: [
            cc({
                llvm,
                watch: /src\/(wasm|include)\/.*\.[hc]$/,
                sources: [
                    "./src/wasm/main.c",
                ],
                headerSearchPath: [
                    "./src/include",
                ],
                output: "main.wasm",
            }),
        ],
    };
});