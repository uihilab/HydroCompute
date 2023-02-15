import * as scripts from './scripts.js'

export const jsScripts = () => { 
    let r = Object.keys(scripts).map((script) => {
      return script;
    });
    let fun = new Map();
    for (let func of r) {
      let fn = []
      for (var i = 0; i < Object.keys(func).length; i++){
        fn.push(Object.keys(scripts[func])[i])
      }

      fn = fn.filter((ele) => ele === undefined || ele === "main" ? null : ele)
      fun.set(func, fn)
    }
    return fun;
}