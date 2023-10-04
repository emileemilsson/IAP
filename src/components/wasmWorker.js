// const wasm = require('stt-native-wasm');

// // https://github.com/webpack/webpack/issues/7647
// // https://developers.google.com/web/updates/2018/04/loading-wasm
// self.addEventListener('message', (message) => {
//     wasm().then((mod) => {
//         let result = mod.calculate(JSON.stringify(message.data), progressResult => {
//             self.postMessage({progressResult});
//         });

//         self.postMessage({result});

//         // close this worker
//         self.close();
//     });
// });
