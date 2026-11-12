/**
 * Folhear: as páginas que o Paged.js montou (as mesmas do PDF) viram folhas de um livro aberto,
 * sempre com as duas páginas lado a lado. O livro encolhe para caber na tela; dá para aproximar
 * (dois dedos, toque duplo, roda do mouse ou os botões) e arrastar para ler de perto.
 * Roda dentro do documento paginado (por isso é texto: entra no iframe).
 */
export const FLIP_CSS = `
@media screen{
  html,body{margin:0;height:100%;overflow:hidden;background:#1a1e1c}
  .pagedjs_pages{visibility:hidden}
  #flip{position:fixed;inset:0;display:flex;flex-direction:column;font:600 14px system-ui,sans-serif;color:#e3e8e5}
  #flip-stage{flex:1;position:relative;overflow:hidden;touch-action:none;perspective:2800px;cursor:pointer}
  #flip-book{position:absolute;left:50%;top:50%;transform-origin:center;transform-style:preserve-3d;transition:transform .18s ease-out}
  #flip-book.panning{transition:none}
  .flip-base{position:absolute;left:0;top:0;background:#d8d1c1;box-shadow:inset -14px 0 20px -12px rgba(0,0,0,.45)}
  .flip-leaf{position:absolute;top:0;transform-origin:left center;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.35,.55,.2,1)}
  .flip-leaf.on{transform:rotateY(-180deg)}
  .flip-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;background:#fff}
  .flip-back{transform:rotateY(180deg)}
  .flip-face .pagedjs_page{margin:0!important;box-shadow:none!important}
  .flip-face::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.18),transparent 7%)}
  .flip-back::after{background:linear-gradient(270deg,rgba(0,0,0,.18),transparent 7%)}
  .flip-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(0,0,0,.28));opacity:0;transition:opacity .8s;backface-visibility:hidden;-webkit-backface-visibility:hidden}
  .flip-leaf.turning .flip-shade{opacity:1}
  #flip-bar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;padding:10px 12px;background:#121614;border-top:1px solid #262d2a}
  #flip-bar button{min-width:44px;min-height:40px;padding:0 12px;border:1px solid #2f3733;border-radius:10px;background:#1d2320;color:inherit;font:inherit;cursor:pointer}
  #flip-bar button:disabled{opacity:.35;cursor:default}
  #flip-bar button:focus-visible{outline:2px solid #6fd0ae;outline-offset:2px}
  #flip-count{min-width:8.5em;text-align:center;font-variant-numeric:tabular-nums;color:#b9c3be}
  #flip-hint{position:absolute;top:8px;left:0;right:0;text-align:center;font:400 12px system-ui,sans-serif;color:#8d9792;pointer-events:none;transition:opacity .4s}
  @media (prefers-reduced-motion:reduce){.flip-leaf,.flip-shade,#flip-book{transition:none}}
}
@media print{#flip{display:none}}
`

export const FLIP_JS = `
function papirusFlip(){
  var d=document, pages=[].slice.call(d.querySelectorAll('.pagedjs_page'));
  if(!pages.length) return;
  var W=pages[0].offsetWidth, H=pages[0].offsetHeight, N=pages.length;
  var root=d.createElement('div'); root.id='flip';
  root.innerHTML='<div id="flip-stage"><div id="flip-book"></div><p id="flip-hint">Toque à direita ou à esquerda para virar · dois dedos ou toque duplo para aproximar</p></div>'+
    '<nav id="flip-bar" aria-label="Folhear"><button id="flip-prev" aria-label="Voltar a página">‹</button><span id="flip-count" aria-live="polite"></span><button id="flip-next" aria-label="Virar a página">›</button>'+
    '<button id="flip-out" aria-label="Afastar">−</button><button id="flip-in" aria-label="Aproximar">+</button></nav>';
  d.body.appendChild(root);
  var stage=d.getElementById('flip-stage'), book=d.getElementById('flip-book'), hint=d.getElementById('flip-hint');
  book.style.width=(2*W)+'px'; book.style.height=H+'px'; book.style.marginLeft=(-W)+'px'; book.style.marginTop=(-H/2)+'px';
  var base=d.createElement('div'); base.className='flip-base'; base.style.width=W+'px'; base.style.height=H+'px'; book.appendChild(base);
  // Folha i: frente = página da direita (2i), verso = a da esquerda seguinte (2i+1).
  var leaves=[];
  for(var i=0;i<N;i+=2){
    var leaf=d.createElement('div'); leaf.className='flip-leaf'; leaf.style.width=W+'px'; leaf.style.height=H+'px'; leaf.style.left=W+'px';
    var f=d.createElement('div'); f.className='flip-face'; f.appendChild(pages[i]);
    var b=d.createElement('div'); b.className='flip-face flip-back'; if(pages[i+1]) b.appendChild(pages[i+1]);
    var sh=d.createElement('div'); sh.className='flip-shade';
    leaf.appendChild(f); leaf.appendChild(b); leaf.appendChild(sh); book.appendChild(leaf); leaves.push(leaf);
  }
  var at=0, zoom=1, px=0, py=0;
  function fit(){ return Math.min((stage.clientWidth-16)/(2*W),(stage.clientHeight-16)/H) }
  function view(){ book.style.transform='translate('+px+'px,'+py+'px) scale('+(fit()*zoom)+')' }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)) }
  function paint(anim){
    leaves.forEach(function(l,i){
      var on=i<at;
      if(anim && l.classList.contains('on')!==on){ l.classList.add('turning'); setTimeout(function(){ l.classList.remove('turning') },820) }
      l.classList.toggle('on',on);
      l.style.zIndex=on?String(i+1):String(leaves.length-i+1);
    });
    var c=d.getElementById('flip-count');
    c.textContent = at===0 ? ('1 de '+N) : (Math.min(2*at,N)+(2*at+1<=N?'–'+(2*at+1):'')+' de '+N);
    d.getElementById('flip-prev').disabled=at===0;
    d.getElementById('flip-next').disabled=at>=leaves.length;
  }
  function go(k){ var n=clamp(at+k,0,leaves.length); if(n===at) return; at=n; hint.style.opacity='0'; paint(true) }
  function zoomTo(z,cx,cy){
    var r=stage.getBoundingClientRect(); var ox=(cx===undefined?r.width/2:cx-r.left)-r.width/2, oy=(cy===undefined?r.height/2:cy-r.top)-r.height/2;
    var k=z/zoom; px=ox-(ox-px)*k; py=oy-(oy-py)*k; zoom=z; if(zoom===1){ px=0; py=0 } view();
  }
  d.getElementById('flip-prev').onclick=function(){ go(-1) };
  d.getElementById('flip-next').onclick=function(){ go(1) };
  d.getElementById('flip-in').onclick=function(){ zoomTo(clamp(zoom*1.4,1,4)) };
  d.getElementById('flip-out').onclick=function(){ zoomTo(clamp(zoom/1.4,1,4)) };
  d.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight') go(1); else if(e.key==='ArrowLeft') go(-1);
    else if(e.key==='Escape'){ try{ parent.postMessage({papirusFlipClose:true},'*') }catch(x){} }
  });
  // Gestos: tocar vira (lado direito avança, esquerdo volta); deslizar vira; com zoom, arrastar move.
  var pts={}, start=null, pinch=null, moved=false, lastTap=0, tapTimer=0;
  function list(){ return Object.keys(pts).map(function(k){ return pts[k] }) }
  function two(){ var p=list(); return { d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1, x:(p[0].x+p[1].x)/2, y:(p[0].y+p[1].y)/2 } }
  stage.addEventListener('pointerdown',function(e){
    pts[e.pointerId]={x:e.clientX,y:e.clientY}; try{ stage.setPointerCapture(e.pointerId) }catch(x){}
    var n=list().length; moved=false;
    if(n===1) start={x:e.clientX,y:e.clientY,px:px,py:py};
    if(n===2){ var t=two(); pinch={d:t.d,x:t.x,y:t.y,z:zoom,px:px,py:py}; start=null }
  });
  stage.addEventListener('pointermove',function(e){
    if(!pts[e.pointerId]) return; pts[e.pointerId]={x:e.clientX,y:e.clientY};
    if(pinch && list().length>=2){
      var t=two(); var z=clamp(pinch.z*t.d/pinch.d,1,4); book.classList.add('panning');
      zoom=pinch.z; px=pinch.px; py=pinch.py; zoomTo(z,pinch.x,pinch.y); px+=t.x-pinch.x; py+=t.y-pinch.y; view(); moved=true;
    } else if(start){
      var dx=e.clientX-start.x, dy=e.clientY-start.y;
      if(Math.abs(dx)+Math.abs(dy)>6) moved=true;
      if(zoom>1){ book.classList.add('panning'); px=start.px+dx; py=start.py+dy; view() }
    }
  });
  function lift(e){
    var was=pts[e.pointerId]; delete pts[e.pointerId];
    var n=list().length; if(n<2) pinch=null;
    if(n===0){
      book.classList.remove('panning');
      if(start && was){
        var dx=e.clientX-start.x;
        if(zoom===1 && Math.abs(dx)>40){ go(dx<0?1:-1) }
        else if(!moved){
          var now=Date.now(), x=e.clientX, y=e.clientY;
          if(now-lastTap<300){ clearTimeout(tapTimer); lastTap=0; zoomTo(zoom>1?1:2.2,x,y) }
          else { lastTap=now; if(zoom===1){ tapTimer=setTimeout(function(){ var r=stage.getBoundingClientRect(); go(x>r.left+r.width/2?1:-1) },280) } }
        }
      }
      start=null;
    }
  }
  stage.addEventListener('pointerup',lift); stage.addEventListener('pointercancel',lift);
  stage.addEventListener('wheel',function(e){ e.preventDefault(); zoomTo(clamp(zoom*(e.deltaY<0?1.15:1/1.15),1,4),e.clientX,e.clientY) },{passive:false});
  window.addEventListener('resize',view);
  view(); paint(false); stage.focus && stage.setAttribute('tabindex','-1');
}
`
