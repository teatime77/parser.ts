namespace parser_ts {
//
type AbstractSpeech = i18n_ts.AbstractSpeech;

export interface Highlightable {
    highlight(highlighted : boolean) : void;
}

function symbol2words(symbol: string) : string {
    const tbl: { [symbol: string]: string } = {
        "sin" : "sine",
        "cos" : "cosine",
        "tan" : "tangent",
        "sec" : "secant",
        "cosec" : "cosecant",
        "cot" : "cotangent",
        "=" : "equals",
        "==" : "equals",
        "!=" : "not equal to",
        "<" : "is less than",
        ">" : "is greater than",
        "<=" : "is less than or equal to",
        ">=" : "is greater than or equal to",
        "+" : "plus",
        "-" : "minus",
        "*" : "times"
    };

    const text = tbl[symbol];
    if(text != undefined){
        return text;
    }
    else{
        return symbol;
    }
}

const tex2words : {[key:string]:string} = {
    "dif"   : "diff",
    "Delta" : "delta",
    "lim"   :  "limit",
    "sqrt"  : "square root",
    "ne"    : "not equals",
    "lt"    : "is less than",
    "gt"    : "is greater than",
    "le"    : "is less than or equals",
    "ge"    : "is greater than or equals",
    "hbar"  : "h bar",
};

const oprs = new Set<string>();

function isLetter(str : string) : boolean {
    return /^\p{Letter}+$/u.test(str);
}

function isDigit(str : string) {
    return /^\d+$/.test(str);
}

function pronunciationF(tex_node : TexNode, word : string) : Phrase | undefined {
    if(word.endsWith("{")){
        word = word.substring(0, word.length - 1);
    }
    if(word.endsWith("_")){
        word = word.substring(0, word.length - 1);
    }
    if(word.startsWith("\\")){
        word = word.substring(1);
        const text = tex2words[word];
        if(text != undefined){
            return new Phrase(tex_node, text.split(" "));
        }
    }
    else{
        const text = symbol2words(word);
        if(text != word){

            return new Phrase(tex_node, text.split(" "));
        }
    }

    if(isLetter(word)){
        if(isGreek(word)){
            const char0 = word.charAt(0)
            if(char0.toUpperCase() == char0){
                
                return new Phrase(tex_node, [ "large", word.toLowerCase()]);
            }
        }
        return new Phrase(tex_node, [word]);
    }

    if(isDigit(word)){
        return new Phrase(tex_node, [word]);
    }

    if(! oprs.has(word)){
        oprs.add(word);
        msg(`operators : [${word}]`);
    }

    return undefined;
}


export class Phrase {
    texNode : TexNode;
    words   : string[];
    start!  : number;
    end!    : number;

    constructor(tex_node : TexNode, words : string[]){
        this.texNode = tex_node;
        this.words   = words;
        for(const word of words){
            if(! oprs.has(word)){
                oprs.add(word);
                // msg(`word : ${word}`);
            }        
        }
    }
}

export function makeTextFromPhrases(phrases : Phrase[]) : string {
    let text = "";
    for(const phrase of phrases){
        phrase.start = text.length;
        for(const word of phrase.words){
            if(word != ""){
                if(text != ""){
                    text += " ";
                }
                text += word;
            }
        }
        phrase.end = text.length;
    }

    return text;
}

abstract class TexNode {
    diction : string | undefined;
    termTex : App | undefined;

    abstract makeSpeech(phrases : Phrase[]) : void;

    term() : Term | undefined {
        return this.termTex;
    }

    initString() : string {
        return "";
    }

    *genTex(speech : AbstractSpeech | null, highlightables? : Map<string, Highlightable>) : IterableIterator<string> {
        yield "";
    }

    say(text : string) : TexNode {
        this.diction = text;
        return this;
    }

    dmpNode(nest : string){
        const term = this.term();
        const id = (term == undefined ? "" : `${term.id}`);
        if(this instanceof TexLeaf){

            msg(`${nest}${id}:${this.texText()}`);
        }
        else if(this instanceof TexBlock){

            msg(`${nest}${id}`);
            this.nodes.forEach(x => x.dmpNode(nest + "\t"));
        }
        else{
            throw new MyError();
        }
    }
}

abstract class TexBlock extends TexNode {
    nodes : TexNode[];

    constructor(nodes : TexNode[]){
        super();
        this.nodes = nodes;
    }

    makeSpeech(phrases : Phrase[]) : void {
        this.nodes.forEach(x => x.makeSpeech(phrases));
    }
}


class TexSeq extends TexBlock {
    constructor(nodes : TexNode[]){
        super(nodes);
    }

    *genTex(speech : AbstractSpeech | null, highlightables? : Map<string, Highlightable>) : IterableIterator<string> {
        const arg_strs = this.nodes.map(x => x.initString());

        for(let [idx, node] of this.nodes.entries()){
            for(const s of node.genTex(speech, highlightables)){
                arg_strs[idx] = s;

                yield `${arg_strs.join(" ")}`;
            }
        }

        yield `${arg_strs.join(" ")}`;
    }
}

abstract class TexLeaf extends TexNode {
    charPos! : number;
    phrase : Phrase | undefined;

    constructor(){
        super();
    }

    abstract texText() : string;
    
    speechText() : string {
        return this.texText();
    }

    makeSpeech(phrases : Phrase[]) : void {
        let text : string;
        if(this.diction != undefined){
            text = this.diction;
        }
        else{
            text = this.speechText();
        }
        this.phrase = pronunciationF(this, text);
        if(this.phrase != undefined){
            phrases.push(this.phrase);
        }
    }

    *genTex(speech : AbstractSpeech | null, highlightables? : Map<string, Highlightable>) : IterableIterator<string> {
        const tex_text = this.texText()

        if(speech != null && this.phrase != undefined){
            while(speech.speaking && speech.prevCharIndex < this.phrase.start){
                yield tex_text;
            }
        }

        yield tex_text;
    }
}

class TexNum extends TexLeaf {
    num : ConstNum;

    constructor(num : ConstNum){
        super();
        this.num = num;
    }

    term() : Term | undefined {
        return this.num;
    }

    texText() : string {
        return this.num.value.str();
    }
}

class TexRef extends TexLeaf {
    ref : RefVar;

    constructor(ref : RefVar){
        super();
        this.ref = ref;
    }

    term() : Term | undefined {
        return this.ref;
    }

    texText() : string {
        if(isGreek(this.ref.name)){

            return `\\${this.ref.name}`;
        }
        else{

            return this.ref.name;
        }
    }

    *genTex(speech : AbstractSpeech | null, highlightables? : Map<string, Highlightable>) : IterableIterator<string> {
        if(highlightables != undefined){

            const highlightable = highlightables.get(this.ref.name);
            if(highlightable != undefined){
                highlightable.highlight(true);
            }
        }

        const tex_text = this.texText()

        if(speech != null && this.phrase != undefined){
            while(speech.speaking && speech.prevCharIndex < this.phrase.start){
                yield tex_text;
            }
        }

        yield tex_text;
    }
}

class TexStr extends TexLeaf {
    str : string;

    constructor(str : string){
        super();
        this.str = str;
    }

    speechText() : string {
        if(this.str == "\\lim_{"){
            msg("speech-Text:lim");
        }
        const list = [
            "{", "}", "(", ")", "}{", "}^{", "\\frac{"
        ];
        if(list.includes(this.str)){
            return "";
        }
        return symbol2words(this.str);
    }
    
    texText() : string {
        return texName(this.str);
    }

    initString() : string {
        const list = [
            "{", "}", "(", ")", "}{", "}^{","^{"
        ];
        if(list.includes(this.str)){
            return this.str;
        }
        if(this.str.startsWith("\\") && this.str.endsWith("}")){
            return this.str;
        }
        return "";
    }
}

class TexSpeech extends TexStr {
    constructor(text : string){
        super(text);
    }

    *genTex(speech : AbstractSpeech | null, highlightables? : Map<string, Highlightable>) : IterableIterator<string> {
        yield "";
    }
}

function spc(text : string) : TexSpeech {
    return new TexSpeech(text);
}

function seq(...params:any[]) : TexSeq {
    return new TexSeq(params.map(x => makeFlow(x)));
}

function join(trms:Term[], delimiter : string) : TexNode {
    const nodes = trms.map(x => makeFlow(x));
    if(trms.length == 1){
        return makeFlow(trms[0]);
    }
    else{
        const nodes : TexNode[] = [];
        for(const [i, trm] of trms.entries()){
            if(i != 0){
                nodes.push(new TexStr(delimiter));
            }

            nodes.push(makeFlow(trm));
        }

        return new TexSeq(nodes);
    }
}

export function makeFlow(trm : TexNode | Term | string) : TexNode {
    if(trm instanceof TexNode){
        return trm;
    }
    else if(typeof trm === "string"){
        return new TexStr(trm);
    }
    else if(trm instanceof RefVar){
        const ref = trm;
        return new TexRef(ref);
    }
    else if(trm instanceof ConstNum){
        const num = trm;
        return new TexNum(num);
    }
    else if(trm instanceof App){
        const app = trm;

        let node : TexNode;

        if(app.fnc instanceof App){

            if(app.fnc instanceof RefVar){

                node = seq( app.fnc, seq("(", join(app.args, ","), ")") );
            }
            else{

                node = seq( "(", app.fnc, ")", seq("(", join(app.args, ","), ")") );
            }
        }
        else if(app.fncName == "lim"){

            node = seq( "\\lim_{", app.args[1], "\\to", app.args[2], "}", app.args[0] );
        }
        else if(app.fncName == "in"){
            const ids = join(app.args, " , ");
            node = seq( ids , "\\in" , app.args[1] );
        }
        else if(app.isDiff()){
            const n = (app.args.length == 3 ? seq("^{", app.args[2], "}") : ``);

            const d = (app.fncName == "diff" ? "d" : "\\partial");

            if(app.args[0].isDiv()){

                node = seq("\\frac{", d, n, "}{", spc("over"), d, app.args[1], n, "}", seq("(", app.args[0], ")"))
            }
            else{

                node = seq("\\frac{", d, n, app.args[0], "}{", spc("over"), d, app.args[1], n, "}")
            }
        }
        else if(isLetterOrAt(app.fncName)){
            if(["sin", "cos"].includes(app.fncName) && ! (app.args[0] instanceof App)){

                node = seq( app.fnc, app.args[0] )
            }
            else if(app.fncName == "sqrt"){

                assert(app.args.length == 1);
                node = seq("\\sqrt{", app.args[0], "}");
            }
            else{

                node = seq( app.fnc, seq("(", join(app.args, ","), ")") )
            }
        }
        else{

            switch(app.fncName){
            case "+":
                switch(app.args.length){
                case 0: 
                    throw new MyError();

                case 1:
                    node = makeFlow(app.args[0]);
                    break;

                default:
                    const nodes : TexNode[] = [];
                    for(const [i, arg] of app.args.entries()){
                        if(i != 0){
                            const coefficient = arg.value.fval();
                            if(0 <= coefficient){

                                nodes.push(new TexStr("+"));
                            }
                            else if(coefficient == -1){

                                nodes.push(new TexStr("-"));
                            }
                        }
            
                        nodes.push(makeFlow(arg));
                    }
            
                    node = new TexSeq(nodes);
                    break;
                }
                break;

            case "/":
                if(app.args.length == 3){
                    msg(`/ 3args [${app.args[0].strval}] [ ${app.args[1].strval}] [ ${app.args[2].strval}]`);
                }
                else if(app.args.length == 1){
                    msg(`/ 1arg [${app.args[0].strval}]`);
                    return makeFlow(app.args[0]);
                }
                else{
                    assert(app.args.length == 2);
                }
                node = seq("\\frac{", app.args[0], "}{", spc("over"), app.args[1], "}");
                break;

            case "^":
                let exponent = makeFlow(app.args[1]);
                if(app.args[1].isValue(2)){
                    exponent.say("squared");
                }
                else if(app.args[1].isValue(3)){
                    exponent.say("cubed");
                }
                else{
                    exponent = seq("to the power of", exponent);
                }

                if(app.args[0] instanceof App && ["sin","cos","tan"].includes(app.args[0].fncName)){

                    const app2 = app.args[0];
                    node = seq("{", app2.fncName, `}^{`, exponent, "}", app2.args[0] )
                }
                else{

                    node = seq("{", app.args[0], "}^{", exponent, "}");
                }
                break

            default:
                if(app.args.length == 1){

                    node = seq(app.fncName, app.args[0]);
                }
                else{

                    node = join(app.args, app.fncName);
                }
                break
            }
        }

        if(app.parent != null){

            if((app.isAdd() || app.isMul()) && app.parent.fncName == "lim"){

                node = seq("(", node, ")");
            }
            else if(app.isOperator() && app.parent.isOperator() && !app.parent.isDiv()){
                if(app.parent.fncName == "^" && app.parent.args[1] == app){
                    ;
                }
                else if(app.parent.precedence() <= app.precedence()){
                    node = seq("(", node, ")");
                }            
            }
        }

        const fval = app.value.fval();
        if(fval == -1){            
            node = seq("-", node);
        }
        else if(fval !=  1){
            assert(app.value.denominator == 1);
            node = seq(app.value.numerator.toFixed(), node);
        }

        node.termTex = app;
        return node;
    }
    else{

        throw new MyError();
    }
}



function getAllTexNodes(node : TexNode, nodes: TexNode[]){
    nodes.push(node);

    if(node instanceof TexBlock){
        node.nodes.forEach(x => getAllTexNodes(x, nodes));
    }
}

export function allTexNodes(node : TexNode) : TexNode[] {
    const terms : TexNode[] = [];
    getAllTexNodes(node, terms);

    return terms;
}

export function makeNodeTextByApp(root : Term) : [TexNode, string]{
    root.setParent(null);
    root.setTabIdx();

    const node = makeFlow(root);
    const phrases : Phrase[] = [];
    node.makeSpeech(phrases);

    const text = makeTextFromPhrases(phrases);

    return [node, text];
}

export async function showFlow(speech : AbstractSpeech, root : Term, div : HTMLDivElement, highlightables? : Map<string, Highlightable>){
    div.innerHTML = "";

    const [node, text] = makeNodeTextByApp(root);

    await speech.speak(text);

    for(const s of node.genTex(speech, highlightables)){
        renderKatexSub(div, s);
        await sleep(10);
    }

    while(speech != null && speech.speaking){
        await sleep(10);
    }
}

}