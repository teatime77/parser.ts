namespace casts {
//
class Glb {
    eventPos!: Vec2;
    orgPos!: Vec2;    
}

let glb = new Glb();

export let captionShift : { [name: string]: [number, number] } = {};


/**
 * ShapeのCaptionのイベント処理
 */
export function setCaptionEventListener(shape: ShapeM){
    shape.divCaption!.addEventListener("pointerdown", shape.captionPointerdown);
    shape.divCaption!.addEventListener("pointermove", shape.captionPointermove);
    shape.divCaption!.addEventListener("pointerup"  , shape.captionPointerup);
}

    export class ViewM {
        width      : number = 0;
        height     : number = 0;
        svg : SVGSVGElement;
        svgRatio: number = 0;
        rect! : DOMRect;
    
        divView : HTMLDivElement;
        div : HTMLDivElement;
        subtitle : HTMLDivElement;
        FlipY : boolean = true;
        capture: ShapeM | null = null;
    
        constructor(){
            this.divView = document.createElement("div");
            this.divView.style.padding = "0px";
            $div("movie-div").appendChild(this.divView);
    
            this.svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
            this.svg.style.backgroundColor = "cornsilk";
            this.svg.style.position = "sticky";
            this.svg.style.left = "0px";
            this.svg.style.top = "0px";
            this.divView.appendChild(this.svg);

            this.div = document.createElement("div");
            this.div.style.position = "absolute";
            this.div.style.pointerEvents = "none";
            this.div.style.backgroundColor = "transparent";
    
            this.divView.appendChild(this.div);

            this.subtitle = $div("subtitle");
        }
    
        initView(width : number, height : number, x1 : number, y1 : number, x2 : number, y2 : number){
            $div("movie-div").style.display = "";
            
            this.width = width;
            this.height = height;
    
            this.divView.style.width  = `${this.width}px`;
            this.divView.style.height = `${this.height}px`;
    
            this.svg.style.width  = `${this.width}px`;
            this.svg.style.height = `${this.height}px`;
            this.svg.setAttribute("viewBox", `${x1} ${y1} ${x2 - x1} ${y2 - y1}`);
            this.svg.setAttribute("transform", "scale(1, -1)");
        
            this.rect = this.divView.getBoundingClientRect();
            this.div.style.left = `${this.rect.x}px`;
            this.div.style.top  = `${this.rect.y}px`;
            this.div.style.width  = `${this.width}px`;
            this.div.style.height = `${this.height}px`;

            const rc = this.svg.getBoundingClientRect();
            this.svgRatio = this.svg.viewBox.baseVal.width / rc.width;
        }
        
        SvgToDomPos(v: Vec2) : Vec2 {
            var pt = this.svg.createSVGPoint();
            pt.x = v.x; 
            pt.y = v.y;
    
            const mat = this.svg.getScreenCTM()!;
            const loc : DOMPoint = pt.matrixTransform(mat);
    
            return new Vec2(loc.x, loc.y);
        }
    }
    
    export abstract class Entity {
        getNumber() : number {
            throw new MyError();
        }
    }
    
    export abstract class ShapeM extends Entity {
        name : string = "";
        caption : string = "";
        parentView! : ViewM;
        color : string = "black";
        focused : boolean = false;
    
        captionPos = new Vec2(0, 0);
        divCaption : HTMLDivElement | null = null;
        abstract recalcShape() : void;
    
        constructor(view : ViewM){
            super();
            this.parentView = view;
        }
    
        makeCaptionDiv(){
            if(this.constructor.name != "PointM"){
                return;
            }
            assert(this.name != "");
            const caption = this.caption != "" ? this.caption : this.name;
    
            this.divCaption = document.createElement("div");
            this.divCaption.style.position = "absolute";
            this.divCaption.style.backgroundColor = "transparent";
            this.divCaption.style.cursor = "move";
            this.divCaption.style.pointerEvents = "all";
            this.divCaption.style.zIndex = "4";
            this.divCaption.style.color = this.color;
            this.divCaption.style.fontSize = "24pt";
            this.divCaption.style.fontWeight = "bold";
            this.divCaption.textContent = caption;

            const pos = captionShift[this.name];
            if(pos != undefined){
                this.captionPos.x = pos[0];
                this.captionPos.y = pos[1];
            }
    
            this.updateCaptionPos();
    
            this.parentView.div.appendChild(this.divCaption);

            setCaptionEventListener(this);
        }

        setCaptionPos(ev: MouseEvent | PointerEvent){
            this.captionPos.x = glb.orgPos.x + (ev.screenX - glb.eventPos.x);
            this.captionPos.y = glb.orgPos.y + (ev.screenY - glb.eventPos.y);
    
            this.updateCaptionPos();
        }
    
        updateCaptionPos(){
            if(this.divCaption != null){

                let [x, y] = this.getCaptionXY();
                this.divCaption.style.left  = `${x}px`;
                this.divCaption.style.top   = `${y}px`;
            }
        }
    
        captionPointerdown =(ev: PointerEvent)=>{    
            glb.eventPos = new Vec2(ev.screenX, ev.screenY);
            glb.orgPos   = this.captionPos.copy();
    
            this.parentView.capture = this;
            this.divCaption!.setPointerCapture(ev.pointerId);
        }
    
        captionPointermove =(ev: PointerEvent)=>{
            if(this.parentView.capture != this){
                return;
            }
            
            this.setCaptionPos(ev);
        }
    
        captionPointerup =(ev: PointerEvent)=>{    
            this.divCaption!.releasePointerCapture(ev.pointerId);
            this.parentView.capture = null;
    
            this.setCaptionPos(ev);
            captionShift[this.name] = [ this.captionPos.x, this.captionPos.y ];
            msg(`caption pos:[${JSON.stringify(captionShift)}]`);
        }    

        hide(){
            throw new MyError();
        }

        focus(is_focused : boolean){
            this.focused = is_focused;
        }
    
        getCenterXY() : Vec2{
            throw new MyError();
        }
    
        getCaptionXY(){
            const pos = this.getCenterXY();
            let p = this.parentView.SvgToDomPos(pos);
            p.x -= this.parentView.rect.x;
            p.y -= this.parentView.rect.y;
    
            return [p.x + this.captionPos.x, p.y + this.captionPos.y];
        }
    }
    
    }