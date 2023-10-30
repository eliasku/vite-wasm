import wasmUrl from "../../build/main.wasm?url";

const p = document.createElement("p");
p.innerText = "Test test";
p.style.fontFamily = "monospace";
document.body.appendChild(p);

WebAssembly.instantiateStreaming(fetch(wasmUrl), {
    env: {
        // print
        p: (num: number) => {
            p.innerText = "output: " + num;
        },
    },
}).then((source) => {
    const exports = source.instance.exports;
    const update = exports.u as Function;
    const raf = requestAnimationFrame;
    const loop = (ts: DOMHighResTimeStamp) => {
        update(ts);
        raf(loop);
    };
    raf(loop);
});
