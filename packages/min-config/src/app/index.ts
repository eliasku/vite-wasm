import wasmUrl from "../../build/main.wasm?url";

declare const info: HTMLParagraphElement;

WebAssembly.instantiateStreaming(fetch(wasmUrl), {
    env: {
        print: (num: number) => {
            info.innerText = "info: " + num;
        },
    },
}).then((source) => {
    const exports = source.instance.exports;
    const update = exports.update as Function;
    const raf = requestAnimationFrame;
    const loop = (ts: DOMHighResTimeStamp) => {
        update(ts);
        raf(loop);
    };
    raf(loop);
});
