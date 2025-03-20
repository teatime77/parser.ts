var katex : any;

namespace parser_ts {
//
export const sleep = i18n_ts.sleep;
const $dic = new Map<string, HTMLElement>();


export function $(id : string) : HTMLElement {
    let ele = $dic.get(id);
    if(ele == undefined){
        ele = document.getElementById(id)!;
        $dic.set(id, ele);
    }

    return ele;
}

export class MyError extends Error {
    constructor(text : string = ""){
        super(text);
    }
}

export class SyntaxError extends MyError{
    constructor(text : string = ""){
        super(text);
    }
}

export function assert(b : boolean, msg : string = ""){
    if(!b){
        throw new MyError(msg);
    }
}    

export function msg(txt : string){
    console.log(txt);
}

export function range(n: number) : number[]{
    return [...Array(n).keys()];
}

export function getUserMacros(){
    return {
        "\\dif" : "\\frac{d #1}{d #2}",
        "\\pdiff" : "\\frac{\\partial #1}{\\partial #2}",
        "\\pddif" : "\\frac{\\partial^2 #1}{\\partial {#2}^2}",
        "\\b" : "\\boldsymbol{#1}"
    };
}

export function renderKatexSub(ele: HTMLElement, tex_text: string){
    ele.innerHTML = "";
        
    katex.render(tex_text, ele, {
        throwOnError: false,
        displayMode : true,
        trust : true,
        strict : false, // "ignore", // false, // handler,
        // newLineInDisplayMode : "ignore",
        macros : getUserMacros()
    });
}


}