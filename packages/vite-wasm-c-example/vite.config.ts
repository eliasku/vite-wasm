import { defineConfig, loadEnv } from "vite";
import { cc } from "@eliasku/vite-plugin-wasm-c";
import "dotenv/config";

export default defineConfig(async ({ command, mode }) => {
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