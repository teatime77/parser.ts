namespace casts {

export let termDic : { [id : number] : Term } = {};

export const pathSep = ":";
export let variables : Variable[] = [];

export function isShapeName(name : string) : boolean {
    const names = [
        "Point", "Circle", "Arc", "Triangle", 
        "LineSegment", "HalfLine", "Line",
        "Intersection", "Foot", "Angle", "Parallel", "Thumb"
    ];
    return names.includes(name);
}

export function isSystemName(name : string) : boolean {
    const names = [
        "range",
        "sqrt",
        "length"
    ];
    return isShapeName(name) || names.includes(name);
}

export function getVariable(name : string) : Variable {
    const va = variables.find(x => x.name == name)!;
    assert(va != undefined);
    return va;
}
export function Zero() : ConstNum {
    return new ConstNum(0);
}


export function actionRef(name : string) : RefVar {
    return new RefVar(name);
}

export function parseMath(text: string) : Term {
    const parser = new Parser(text);
    const trm = parser.RootExpression();
    if(parser.token.typeTkn != TokenType.eot){
        throw new MyError();
    }

    trm.setParent(null);

    return trm;
}

export function setRefVars(root : Term){
    const all_refs = allTerms(root).filter(x => x instanceof RefVar && isLetter(x.name[0]) && !isSystemName(x.name)) as RefVar[];
    for(const ref of all_refs){
        ref.refVar = variables.find(x => x.name == ref.name);
        assert(ref.refVar != undefined);
    }
}

export function isGreek(text : string) : boolean {
    assert(typeof text == "string");
    if(text.length == 0){
        return false;
    }

    const greeks = [
        "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", 
        "vartheta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi", "varpi", "rho", "varrho", 
        "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega"
    ];

    if(greeks.includes(text)){
        return true;
    }

    const lower_case = text[0].toLowerCase() + text.substring(1);    
    if(greeks.includes(lower_case)){
        return true;
    }

    return false;
}

export function texName(text : string){
    switch(text){
    case "=="     : return "=";
    case "!="     : return "\\ne";
    case "<"      : return "\\gt";
    case ">"      : return "\\lt";
    case "<="     : return "\\ge";
    case ">="     : return "\\le";
    case "*"      : return "\\cdot";
    case "=>"     : return "\\implies";
    case "&&"     : return "\\land";
    case "hbar"   : return "\\hbar";
    case "nabla"  : return "\\nabla";
    case "nabla2" : return "\\nabla^2";
    case "sin"  :
    case "cos"  :
    case "in"   :
        return `\\${text}`;
    }

    if(isGreek(text)){
        return `\\${text}`;
    }

    return text;
}

let termId : number = 0;

export class Rational{
    numerator : number = 1;
    denominator : number = 1;
    parent : Term | null = null;

    constructor(numerator : number, denominator : number = 1){
        this.numerator = numerator;
        this.denominator = denominator;
    }

    eq(r : Rational) : boolean {
        return(this.numerator == r.numerator && this.denominator == r.denominator);
    }

    is(numerator : number, denominator : number = 1) : boolean{
        return(this.numerator == numerator && this.denominator == denominator);
    }

    set(numerator : number, denominator : number = 1){
        this.numerator   = numerator;
        this.denominator = denominator;
    }

    clone() : Rational {
        return new Rational(this.numerator, this.denominator);
    }

    str() : string {
        if(this.denominator == 1){

            return `${this.numerator}`;
        }
        else{

            return `${this.numerator} / ${this.denominator}`;
        }
    }

    tex() : string {
        if(this.denominator == 1){

            return `${this.numerator}`;
        }
        else{

            return `\\frac{${this.numerator}}{${this.denominator}}`;
        }
    }

    setmul(... rs : Rational[]){
        this.numerator   *= rs.reduce((acc, cur) => acc * cur.numerator,   1);
        this.denominator *= rs.reduce((acc, cur) => acc * cur.denominator, 1);
    }

    setdiv(r : Rational){
        this.numerator   *= r.denominator;
        this.denominator *= r.numerator;
    }

    fval() : number {
        return this.numerator / this.denominator;
    }

    abs() : number {
        return Math.abs(this.fval());
    }

    setAbs() {
        this.numerator   = Math.abs(this.numerator);
        this.denominator = Math.abs(this.denominator);
    }

    int() : number {
        assert(this.denominator == 1);
        return this.numerator;
    }

    sign() : number {
        return Math.sign(this.fval());
    }
}

export abstract class Term {
    static tabIdxCnt : number = 0;
    id : number;
    tabIdx : number = 0;
    parent : App | null = null;
    strval : string = "";
    partialTex : string | undefined;

    // 係数
    value : Rational = new Rational(1);

    canceled : boolean = false;
    colorName  : string | undefined;

    constructor(){
        this.id = termId++;
    }

    abstract tex2() : string;
    abstract clone() : Term;
    abstract strid() : string;

    uncolor(){
        this.colorName = undefined;
    }

    red(){
        this.colorName = "red";
    }

    blue(){
        this.colorName = "blue";
    }

    colored(){
        return this.colorName != undefined;
    }

    eq(trm : Term) : boolean {
        return this.str() == trm.str();
    }

    eq2(trm : Term) : boolean {
        return this.strval == trm.strval;
    }

    equal(trm : Term) : boolean {
        return this.value.eq(trm.value);
    }

    copy(dst : Term){
        dst.value  = this.value.clone();
        dst.canceled = this.canceled;
        dst.colorName  = this.colorName;
    }


    /**
     * 
     * @returns コピーしたルートと、thisと同じ位置の項を返す。
     */
    cloneRoot() : [ App, Term] {
        // ルートからthisに至るパスを得る。
        const path = this.getPath();

        // ルートを得る。
        const root = this.getRoot();
        assert(path.getTerm(root) == this);

        // ルートをコピーする。
        const root_cp = root.clone();

        // コピーしたルートから同じパスを辿って項を得る。
        const this_cp = path.getTerm(root_cp);
        assert(this_cp.str() == this.str());

        // コピーしたルートと、thisと同じ位置の項を返す。
        return [root_cp, this_cp];
    }

    getPath(path : Path = new Path([])) : Path {
        if(this.parent == null){

            return path;
        }
        let idx : number;
        if(this.parent.fnc == this){
            idx = -1;
        }
        else{

            idx = this.parent.args.indexOf(this);
            assert(idx != -1);
        }

        path.indexes.unshift(idx);
        return this.parent.getPath(path);
    }

    getRoot() : App {
        if(this.parent == null){
            if(this instanceof App){
                return this;
            }
            assert(false);
        }

        return this.parent!.getRoot();
    }

    setParent(parent : App | null){
        this.parent = parent;
        this.value.parent = this;
    }

    setTabIdx(){
        this.tabIdx = ++Term.tabIdxCnt;
    }

    verifyParent(parent : App | null){
        assert(this.parent == parent);
        assert(this.value.parent == this)
    }

    setStrVal(){
        this.strval = this.str();
    }

    replaceTerm(target : Term){
        const app : App = this.parent!;
        assert(app != null, "replace");

        if(app.fnc == this){
            app.fnc = target;
        }
        else{
            const idx = app.args.findIndex(x => x == this);
            assert(idx != -1, "replace idx");
            app.args[idx] = target;
        }

        target.parent = app;
    }

    index() : number {
        if(this.parent != null){
            if(this.parent.fnc == this){
                return -1;
            }
            const idx = this.parent!.args.indexOf(this);
            assert(idx != -1, "index 1");
            return idx;
        }
        else{

            throw new MyError("index 2");
        }
    }

    remArg() {
        assert(this.parent != null, "rem arg 1");
        const idx = this.parent!.args.indexOf(this);
        assert(idx != -1, "rem arg 2");
        this.parent!.args.splice(idx, 1);
    }

    putValue(text : string, in_tex : boolean) : string {
        let val : string;

        if(this instanceof ConstNum){

            val = text;
        }
        else{

            assert(this.value instanceof Rational);
            if(this.value.fval() == 1){
                val = text;
            }
            else if(this.value.fval() == -1){
                // val = "-" + tex2;
                val = `- ${text}`;
            }
            else if(this.value.denominator == 1){

                val = `${this.value.numerator} * ${text}`
            }
            else{
                throw new MyError();
            }
        }

        if(this.parent != null && this != this.parent.fnc && this.parent.isAdd()){
            const idx = this.parent.args.indexOf(this);
            assert(idx != -1, "tex");

            if(idx != 0){

                if(0 <= this.value.fval()){

                    val = "+ " + val;
                }
            }
        }

        if(in_tex){

            if(this.colored()){
                return `{\\color{${this.colorName}} ${val}}`;
            }

            if(this.canceled){
                return `\\cancel{${val}}`
            }
        }

        return val;
    }

    str2() : string {
        assert(false, "str2");
        return "";
    }

    str() : string {
        this.strval = this.strX();
        return this.strval;
    }

    strX() : string {
        const text = this.str2();
        return this.putValue(text, false);
    }


    htmldata(text : string) : string {
        termDic[this.id] = this;
        return `\\htmlData{id=${this.id}, tabidx=${this.tabIdx}}{${text}}`;
    }
    
    tex() : string {
        if(this.partialTex != undefined){
            if(this.colored()){
                return `{\\color{${this.colorName}} ${this.partialTex}}`;
            }
            else{
                return this.partialTex;
            }
        }

        const text = this.tex2();
        if(this.colored()){

            return `{\\color{${this.colorName}} ${this.putValue(text, true)}}`;
            return this.htmldata(this.putValue(text, true));
        }
        else{

            return this.putValue(text, true);
        }
    }

    isApp(fnc_name : string) : boolean {
        return this instanceof App && this.fncName == fnc_name;
    }

    isOperator() : boolean {
        return this instanceof App && this.precedence() != -1;
    }

    isNamedFnc() : boolean {
        return this instanceof RefVar && isLetter(this.name[0]);
    }

    isOprFnc() : boolean {
        return this instanceof RefVar && ! isLetter(this.name[0]);
    }

    isEq() : boolean {
        return this instanceof App && (this.fncName == "==" || this.fncName == "=");
    }

    isList() : boolean {
        return this instanceof App && this.fncName == "[]";
    }

    isAdd() : boolean {
        return this instanceof App && this.fncName == "+";
    }

    isMul() : boolean {
        return this instanceof App && this.fncName == "*";
    }

    isDiv() : boolean {
        return this instanceof App && this.fncName == "/";
    }

    isDot() : boolean {
        return this instanceof App && this.fncName == ".";
    }

    isSqrt() : boolean {
        return this instanceof App && this.fncName == "sqrt";
    }

    isZero() : boolean {
        return this.value.numerator == 0;
    }

    isValue(n : number) : boolean {
        return this instanceof ConstNum && this.value.fval() == n;
    }

    isOne() : boolean {
        return this.isValue(1);
    }

    isE() : boolean {
        return this instanceof RefVar && this.name == "e";
    }

    isI() : boolean {
        return this instanceof RefVar && this.name == "i";
    }

    isDiff() : boolean {
        return this instanceof App && (this.fncName == "diff" || this.fncName == "pdiff");
    }

    isLim() : boolean {
        return this instanceof App && this.fncName == "lim";
    }

    depend(dvar : RefVar) : boolean {
        return allTerms(this).some(x => dvar.eq(x));
    }

    calc() : number {
        if(this instanceof Rational){
            return this.fval();
        }
        else if(this instanceof ConstNum){
            return this.value.fval();
        }
        else if(this instanceof RefVar){
            const data = this.refVar!.expr;
            if(data instanceof Term){
                return data.calc();
            }
            else{
                throw new MyError("unimplemented");
            }
        }
        else if(this instanceof App){
            const app = this;
            if(app.isApp("sqrt")){
                assert(app.args.length == 1);
                return Math.sqrt(app.args[0].calc());
            }
            else if(app.entity != undefined){
                return app.entity.getNumber();
            }
            else{
                throw new MyError("unimplemented");
            }
        }
        throw new MyError("unimplemented");
    }

    getEntity() : Entity {
        if(this instanceof RefVar){
            if(this.refVar != undefined){
                return this.refVar.getEntity();
            }                 
        }
        else if(this instanceof App && this.entity != undefined){
            return this.entity;
        }
        throw new MyError();
    }

    copyValue(cns : ConstNum){
        assert(this instanceof ConstNum);
        this.value.set(cns.value.numerator, cns.value.denominator);
    }

    dmpTerm(nest : string){
        if(this instanceof App){

            msg(`${nest}${this.id}`);
            this.fnc.dmpTerm(nest + "\t");
            this.args.forEach(x => x.dmpTerm(nest + "\t"));
        }
        else{

            msg(`${nest}${this.id}:${this.str()}`);
        }
    }

    renderTex(div : HTMLDivElement){
        const tex = this.tex();
        renderKatexSub(div, tex);    
    }
}

export class Path extends Term {
    indexes : number[] = [];

    constructor(indexes : number[]){
        super();
        this.indexes = indexes.slice();
    }

    equal(trm : Term) : boolean {
        return super.equal(trm) && trm instanceof Path && range(this.indexes.length).every(i => this.indexes[i] == trm.indexes[i]);
    }

    strid() : string{
        throw new MyError();
    }

    strX() : string {
        return `#${this.indexes.join(pathSep)}`;
    }

    tex2() : string {
        assert(false, "path:tex2");
        return "";
    }

    clone() : Term {
        const path = new Path(this.indexes);
        this.copy(path);
        path.setStrVal();

        return path;
    }

    getTerm(root : App, get_parent : boolean = false) : Term {
        if(this.indexes.length == 0){
            return root;
        }
    
        let app = root;

        const last_i = (get_parent ? this.indexes.length - 2 : this.indexes.length - 1);

        for(const [i, idx] of this.indexes.entries()){
            if(i == last_i){
    
                return (idx == -1 ? app.fnc : app.args[idx]);
            }
            else{
                app = (idx == -1 ? app.fnc : app.args[idx]) as App;
                assert(app instanceof App, "pass:get term");
            }
        }
        throw new MyError("get term");
    }
}


export class Variable {
    name : string;
    expr : Term;
    depVars : Variable[];
    entity : Entity | undefined;

    constructor(name : string, expr : Term){
        variables.push(this);
        this.name = name;
        this.expr = expr;

        const refs = allTerms(expr).filter(x => x instanceof RefVar && !(x.parent instanceof App && x.parent.fnc == x)) as RefVar[];
        this.depVars = refs.map(ref => variables.find(v => v.name == ref.name)) as Variable[];
        assert(this.depVars.every(x => x != undefined));

        if(this.depVars.length != 0){
            msg(`${this.name} depends ${this.depVars.map(x => x.name).join(" ")}`);
        }
    }

    getEntity() : Entity {
        if(this.entity != undefined){
            return this.entity;
        }
        else if(this.expr instanceof App && this.expr.entity != undefined){
            return this.expr.entity;
        }
        else{
            throw new MyError();
        }
    }

    rename(new_name : string){
        this.name = new_name;
        const shape = this.getEntity();
        if(shape instanceof ShapeM){
            shape.name = new_name;
            if(shape.divCaption != null){
                shape.divCaption.textContent = new_name;
            }
        }
    }
}

export class RefVar extends Term{
    name: string;
    refVar! : Variable | undefined;

    constructor(name: string){
        super();
        this.name = name;
    }

    equal(trm : Term) : boolean {
        return super.equal(trm) && trm instanceof RefVar && this.name == trm.name;
    }

    strid() : string{
        if(this.value.is(1)){

            return `${this.name}`;
        }
        else{

            return `${this.value.str()} ${this.name}`;
        }
    }

    clone() : RefVar {
        const ref = new RefVar(this.name);
        this.copy(ref);
        ref.setStrVal();

        return ref;
    }

    str2() : string {
        return this.name;
    }

    tex2() : string {
        return texName(this.name);
    }
}


export class ConstNum extends Term{
    constructor(numerator : number, denominator : number = 1){
        super();
        this.value = new Rational(numerator, denominator);
    }

    equal(trm : Term) : boolean {
        return super.equal(trm);
    }

    strid() : string{
        return `${this.value.str()}`;
    }

    static fromRational(r : Rational) : ConstNum {
        return new ConstNum(r.numerator, r.denominator);
    }

    clone() : ConstNum {
        const cns = new ConstNum(this.value.numerator, this.value.denominator);
        this.copy(cns);
        cns.setStrVal();

        return cns;
    }

    str2() : string {
        return this.value.str();        
    }

    strX() : string {
        return this.value.str();        
    }

    tex2() : string {
        return this.value.tex();
    }
}


export class Str extends Term{
    text : string;

    constructor(text : string){
        super();
        this.text = text;
    }

    equal(trm : Term) : boolean {
        return trm instanceof Str && trm.text == this.text;
    }

    strid() : string{
        return `"${this.text}"`;
    }

    clone() : Str {
        return new Str(this.text);
    }

    str2() : string {
        return this.strid();        
    }

    strX() : string {
        return this.strid();        
    }

    tex2() : string {
        return this.strid();
    }
}

export class App extends Term{
    fnc : Term;
    args: Term[];
    entity : Entity | undefined;
    remParentheses : boolean = false;

    static startEnd : { [start : string] : string } = {
        "(" : ")",
        "[" : "]",
        "{" : "}",
    }

    get refVar() : RefVar | null {
        if(this.fnc != null && this.fnc instanceof RefVar){
            return this.fnc;
        }
        else{
            return null;
        }
    }

    get fncName() : string {
        if(this.fnc instanceof RefVar){
            return this.fnc.name;
        }
        else{
            return `no-fnc-name`;
        }
    }


    constructor(fnc: Term, args: Term[]){
        super();
        this.fnc    = fnc;
        this.fnc.parent = this;

        this.args   = args.slice();

        this.args.forEach(x => x.parent = this);
    }

    equal(trm : Term) : boolean {
        if(super.equal(trm) && trm instanceof App){
            if(this.fnc.equal(trm.fnc)){
                if(this.args.length == trm.args.length){
                    return range(this.args.length).every(i => this.args[i].equal(trm.args[i]));
                }
            }
        }

        return false;
    }


    strid() : string{
        let s : string;
        if(this.fnc.isOprFnc()){
            s = this.args.map(x => x.strid()).join(this.fncName);
        }
        else{
            s = `${this.fncName}(${this.args.map(x => x.strid()).join(", ")})`;

        }
        if(this.value.is(1)){

            return s;
        }
        else{

            return `${this.value.str()} ${s}`;
        }
    }

    clone() : App {
        const app = new App(this.fnc.clone(), this.args.map(x => x.clone()));

        this.copy(app);
        app.setStrVal();

        return app;
    }

    setParent(parent : App | null){
        super.setParent(parent);

        this.fnc.setParent(this);

        this.args.forEach(x => x.setParent(this));
    }

    setTabIdx(){
        super.setTabIdx();
        this.fnc.setTabIdx();
        this.args.forEach(x => x.setTabIdx());
    }


    verifyParent(parent : App | null){
        super.verifyParent(parent);

        this.fnc.verifyParent(this);

        this.args.forEach(x => x.verifyParent(this));
    }

    setStrVal(){
        this.strval = this.str();
        this.fnc.setStrVal();
        this.args.forEach(x => x.setStrVal());
    }

    str2() : string {
        const args = this.args.map(x => x.str());
        
        let text : string;
        if(this.fnc instanceof App){
            const args_s = args.join(", ");
            text = `(${this.fnc.str()})(${args_s})`;
        }
        else if(isLetterOrAt(this.fncName)){
            const args_s = args.join(", ");
            text = `${this.fncName}(${args_s})`;
        }
        else{

            switch(this.fncName){
                case "+":
                    switch(args.length){
                    case 0: return " +[] ";
                    case 1: return ` +[${args[0]}] `;
                    }
                    text = args.join(` `);
                    break
    
                case "/":
                    if(this.args.length != 2){
                        throw new MyError();
                    }
                    text = `${args[0]} / ${args[1]}`;
                    break
        
                default:
                    text = args.join(` ${this.fncName} `);
                    break
            }
        }

        if(this.isOperator() && this.parent != null && this.parent.isOperator()){
            if(this.parent.precedence() <= this.precedence()){
                return `(${text})`;
            }            
        }

        return text;
    }

    tex2() : string {
        const args = this.args.map(x => x.tex());

        let text : string;
        if(this.fnc instanceof App){

            const args_s = args.join(", ");
            text = `(${this.fnc.tex()})(${args_s})`;
        }
        else if(this.fncName == "lim"){
            text = `\\lim_{${args[1]} \\to ${args[2]}} ${args[0]}`;
        }
        else if(this.fncName == "in"){
            let ids : string;
            if(this.args[0].isApp(",")){

                ids = (this.args[0] as App).args.map(x => x.tex()).join(" , ");
            }
            else{
                ids = args[0];
            }
            text = `${ids} \\in ${args[1]}`;
        }
        else if(this.isDiff()){
            const n = (this.args.length == 3 ? `^{${args[2]}}`:``);

            const d = (this.fncName == "diff" ? "d" : "\\partial");

            if(args[0].indexOf("\\frac") == -1){

                text = `\\frac{ ${d} ${n} ${args[0]}}{ ${d}  ${args[1]}${n}}`;
            }
            else{

                text = `\\frac{ ${d} ${n} }{ ${d}  ${args[1]}${n}} (${args[0]})`;
            }
        }
        else if(isLetterOrAt(this.fncName)){
            if(["sin", "cos"].includes(this.fncName) && ! (this.args[0] instanceof App)){

                text = `${texName(this.fncName)} ${args[0]}`;
            }
            else if(this.fncName == "sqrt"){
                assert(args.length == 1, "tex2");
                text = `\\sqrt{${args[0]}}`;
            }
            else{

                const args_s = args.join(", ");
                text = `${texName(this.fncName)}(${args_s})`;
            }
        }
        else{

            switch(this.fncName){
            case "+":
                switch(args.length){
                case 0: return " +[] ";
                case 1: return ` +[${args[0]}] `;
                }
                text = args.join(` `);
                break

            case "/":
                if(this.args.length != 2){
                    throw new MyError();
                }
                text = `\\frac{${args[0]}}{${args[1]}}`;
                break

            case "^":
                if(this.args[0] instanceof App && ["sin","cos","tan"].includes(this.args[0].fncName)){

                    const app = this.args[0];
                    text = `${texName(app.fncName)}^{${args[1]}} ${app.args[0].tex()}`;
                }
                else{

                    text = `${args[0]}^{${args[1]}}`;
                }
                break

            default:
                if(args.length == 1){
                    text = `${texName(this.fncName)} ${args[0]}`;
                }
                else{
                    text = args.join(` ${texName(this.fncName)} `);
                }
                break
            }
        }

        if(this.parent != null){

            if(this.remParentheses){
                return `\\textbf{ {\\color{red} (} } ${text} \\textbf{ {\\color{red} )} }`;
            }
            else if((this.isAdd() || this.isMul()) && this.parent.fncName == "lim"){

                return `(${text})`;
            }
            else if(this.isOperator() && this.parent.isOperator() && !this.parent.isDiv()){
                if(this.parent.fncName == "^" && this.parent.args[1] == this){
                    return text;
                }

                if(this.parent.precedence() <= this.precedence()){
                    return `(${text})`;
                }            
            }

        }

        return text;
    }

    precedence() : number {
        switch(this.fncName){
        case "^": 
            return 0;

        case "/": 
            return 1;

        case "*": 
            return 2;

        case "+": 
        case "-": 
            return 3;
        }

        return -1;
    }

    setArg(trm : Term, idx : number){
        this.args[idx] = trm;
        trm.parent = this;
    }
    
    addArg(trm : Term){
        this.args.push(trm);
        trm.parent = this;
    }

    addArgs(trms : Term[]){
        this.args.push(... trms);
        trms.forEach(x => x.parent = this);
    }

    insArg(trm : Term, idx : number){
        this.args.splice(idx, 0, trm);
        trm.parent = this;
    }

    insArgs(args : Term[], idx : number){
        assert(idx != -1, "ins parent mul 1");

        const args_cp = args.slice();
        while(args_cp.length != 0){
            const trm = args_cp.pop()!;
            this.insArg(trm, idx);
        }
    }
}

export class Parser {
    tokens: Token[];
    tokens_cp: Token[];
    token!: Token;

    constructor(text: string){
        this.tokens = lexicalAnalysis(text);
        if(this.tokens.length == 0){
            
        }
        this.tokens_cp = this.tokens.slice();

        this.next();
    }

    next(){
        if(this.tokens.length == 0){

            this.token = new Token(TokenType.eot, TokenSubType.unknown, "", 0);
        }
        else{

            this.token = this.tokens.shift()!;
        }
    }

    showError(text : string){
        const i = this.tokens_cp.length - this.tokens.length;
        const words = this.tokens_cp.map(x => x.text);

        words.splice(i, 0, `<<${text}>>`);
        msg(`token err:${words.join(" ")}`);
    }

    nextToken(text : string){
        if(this.token.text != text){
            this.showError(text);
            throw new MyError();
        }

        this.next();
    }

    current(){
        return this.token.text;
    }

    peek() : Token | null {
        return this.tokens.length == 0 ? null : this.tokens[0];
    }

    readArgs(start: string, end : string, app : App){
        this.nextToken(start);

        while(true){
            const trm = this.RelationalExpression();
            app.args.push(trm);

            if(this.token.text == ","){
                this.nextToken(",");
            }
            else{
                break;
            }
        }

        this.nextToken(end);
    }

    PrimaryExpression() : Term {
        let trm : Term;

        if(this.token.typeTkn == TokenType.identifier){
            let refVar = new RefVar(this.token.text);
            this.next();

            if(this.token.text == '('){

                let app = new App(refVar, []);
                this.readArgs("(", ")", app);

                return app;
            }
            else if(this.token.text == "."){
                let app = new App(operator("."), [refVar]);

                do {
                    this.nextToken(".");
                    
                    assert(this.token.typeTkn == TokenType.identifier);
                    app.addArg(new RefVar(this.token.text));
                    this.next();
                
                } while(this.token.text == ".");

                return app;
            }
            else{

                return refVar;
            }
        }
        else if(this.token.typeTkn == TokenType.Number){
            let n = parseFloat(this.token.text);
            if(isNaN(n)){
                throw new MyError();
            }

            trm = new ConstNum(n);
            this.next();
        }
        else if(this.token.typeTkn == TokenType.String){
            trm = new Str(this.token.text);
            this.next();
        }
        else if(this.token.typeTkn == TokenType.path){
            assert(this.token.text[0] == "#", "parse path");
            if(this.token.text == "#"){

                trm = new Path([]);
            }
            else{

                const indexes = this.token.text.substring(1).split(pathSep).map(x => parseFloat(x));
                trm = new Path(indexes);
            }

            this.next();
        }
        else if(this.token.text == '('){

            this.next();
            trm = this.RelationalExpression();

            if(this.current() != ')'){
                throw new MyError();
            }
            this.next();

            if(this.token.text == '('){

                let app = new App(trm, []);
                this.readArgs("(", ")", app);

                return app;
            }

            return trm;
        }
        else{
            throw new MyError();
        }

        return trm;
    }

    PowerExpression() : Term {
        const trm1 = this.PrimaryExpression();
        if(this.token.text == "^"){

            this.nextToken("^");

            const trm2 = this.PowerExpression();

            return new App(operator("^"), [trm1, trm2]);
        }

        return trm1;
    }

    UnaryExpression() : Term {
        if (this.token.text == "-") {
            // 負号の場合

            this.nextToken("-");

            // 基本の式を読みます。
            const t1 = this.PowerExpression();

            // 符号を反転します。
            t1.value.numerator *= -1;

            return t1;
        }
        else {

            // 基本の式を読みます。
            return this.PowerExpression();
        }
    }

    
    DivExpression() : Term {
        let trm1 = this.UnaryExpression();
        while(this.token.text == "/"){
            let app = new App(operator(this.token.text), [trm1]);
            this.next();

            while(true){
                let trm2 = this.UnaryExpression();
                app.args.push(trm2);
                
                if(this.token.text == app.fncName){
                    this.next();
                }
                else{
                    trm1 = app;
                    break;
                }
            }
        }
    
        return trm1;
    }

    
    MultiplicativeExpression() : Term {
        let trm1 = this.DivExpression();
        while(this.token.text == "*"){
            let app = new App(operator(this.token.text), [trm1]);
            this.next();

            while(true){
                let trm2 = this.DivExpression();
                app.args.push(trm2);
                
                if(this.token.text == app.fncName){
                    this.next();
                }
                else{
                    trm1 = app;
                    break;
                }
            }
        }
    
        return trm1;
    }
    
    AdditiveExpression() : Term {
        let nagative : boolean = false;
        if(this.token.text == "-"){
            nagative = true;
            this.next();
        }

        const trm1 = this.MultiplicativeExpression();
        if(nagative){
            trm1.value.numerator *= -1;
        }

        if(this.token.text == "+" || this.token.text == "-"){
            let app = new App(operator("+"), [trm1]);

            while(this.token.text == "+" || this.token.text == "-"){
                const opr = this.token.text;
                this.next();

                const trm2 = this.MultiplicativeExpression();
                if(opr == "-"){
                    trm2.value.numerator *= -1;
                }

                app.addArg(trm2);
            }

            return app;
        }

        return trm1;
    }

    ArithmeticExpression() : Term {
        return this.AdditiveExpression();
    }

    VariableDeclaration() : App {
        const ref_vars : RefVar[] = [];

        while(true){
            const id = this.token;
            assert(id.typeTkn == TokenType.identifier);

            this.next();

            ref_vars.push(new RefVar(id.text));

            if(this.token.text == ","){
                this.nextToken(",");
            }
            else{
                break;
            }
        }

        const id_list = new App(operator(","), ref_vars);

        this.nextToken("in");

        const set = this.ArithmeticExpression();

        return new App(operator("in"), [id_list, set]);
    }

    RelationalExpression(in_and : boolean = false) : Term {
        const next_token = this.peek();
        if(in_and && this.token.typeTkn == TokenType.identifier && next_token != null && next_token.text == ","){
            return this.VariableDeclaration();
        }

        let trm1 : Term;
        if(this.token.text == "["){

            const ref = new RefVar("[]");
            trm1 = new App(ref, []);
            this.readArgs("[", "]", trm1 as App);
        }
        else{

            trm1 = this.ArithmeticExpression();
        }

        while([ "==", "=", "!=", "<", "<=", "in" ].includes(this.token.text)){
            let app = new App(operator(this.token.text), [trm1]);
            this.next();

            while(true){
                let trm2 = this.ArithmeticExpression();
                app.args.push(trm2);
                
                if(this.token.text == app.fncName){
                    this.next();
                }
                else{
                    trm1 = app;
                    break;
                }
            }
        }

        return trm1;
    }

    AndExpression() : Term {
        const trm1 = this.RelationalExpression(true);

        if(! [";", "&&"].includes(this.token.text)){

            return trm1;
        }

        const app = new App(operator("&&"), [trm1]);

        while( [";", "&&"].includes(this.token.text) ){
            this.next();

            const trm2 = this.RelationalExpression(true);
            app.addArg(trm2);
        }

        return app;
    }

    LogicalExpression(){
        const trm1 = this.AndExpression();

        if(this.token.text != "=>"){
            
            return trm1;
        }

        this.next();

        let trm2 = this.AndExpression();
        return new App(operator("=>"), [trm1, trm2]);
    }

    RootExpression(){
        if([ "==", "=", "!=", "<", "<=", "in" ].includes(this.token.text)){
            let app = new App(operator(this.token.text), []);
            this.next();

            let trm = this.ArithmeticExpression();
            app.args.push(trm);

            return app;
        }
        else{
    
            return this.LogicalExpression();
        }
    
    }
}

export function operator(opr : string) : RefVar {
    return new RefVar(opr);
}

export function getAllTerms(t : Term, terms: Term[]){
    terms.push(t);

    if(t instanceof App){
        assert(t.fnc != null, "get all terms");
        getAllTerms(t.fnc, terms);

        t.args.forEach(x => getAllTerms(x, terms));
    }
}

export function makeTermMap(root : Term) : Map<string, Term>{
    const terms : Term[] = [];
    getAllTerms(root, terms);

    const map = new Map<string, Term>();
    terms.forEach(x => map.set(x.str(), x));

    return map;
}

export function getSubTerms(root : Term, target : Term) : Term[]{
    const terms : Term[] = [];
    getAllTerms(root, terms);

    const target_str = target.str2();
    return terms.filter(x => x.str2() == target_str );
}

export function allTerms(trm : Term) : Term[] {
    const terms : Term[] = [];
    getAllTerms(trm, terms);

    return terms;
}

}