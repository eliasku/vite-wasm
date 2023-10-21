import "dotenv/config";
import { defineConfig } from "vite";
import { cc } from "@eliasku/vite-plugin-wasm-c";

export default defineConfig({
    plugins: [
        cc({
            sources: [
                "./src/wasm/main.c",
            ],
        }),
    ],
});