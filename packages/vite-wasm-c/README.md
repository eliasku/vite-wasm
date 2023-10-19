# vite plugin for building c files

Plugin provides `vite` commands to build and watch C source files without `stdlib` using `llvm` toolchain.

See [configuration example](https://github.com/eliasku/vite-wasm/blob/master/packages/vite-wasm-c-example/vite.config.ts)

Import `cc` plugin function

```typescript
import { cc } from "@eliasku/vite-plugin-wasm-c";
```

Add `cc` plugin to your vite config:

```typescript
plugins: [
    // ...
    cc({
        // set LLVM installation path, `process.env.LLVM_ROOT` by default
        llvm: "/usr/local/opt/llvm",
        // regular expression to allow watch your C source-code files
        watch: /src\/(wasm|include)\/.*\.[hc]$/,
        // translation units array to build and link
        sources: [
            "./src/wasm/main.c",
        ],
        // additional header search path directories
        headerSearchPath: [
            "./src/include",
        ],
        // change default output filename
        output: "main.wasm",
    }),
    // ...
],
```
