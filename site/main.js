(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = preference.matches;
  try { const saved = localStorage.getItem('boss-motion'); if (saved !== null) reduced = saved === 'off'; } catch {}
  const motion = document.querySelector('#motion');
  const canvas = document.querySelector('#atmosphere');
  const ctx = canvas.getContext('2d');
  const progress = document.querySelector('.reading-progress i');
  const scenes = [...document.querySelectorAll('[data-scene]')].map(el => ({el, img:el.querySelector('.panel img'),mode:el.dataset.mode,top:0,height:0,pin:el.classList.contains('cinematic')}));
  // Effects stay inside the artwork and only animate while a scene is visible.
  const effects = {cover:['scan-glow'],street:['headlight-beam','road-glow'],walk:['scan-glow'],shadow:['impact-ring'],boss:['iris-reveal'],offering:['reward-rays'],rain:['window-drops'],finale:['city-reflections']};
  scenes.forEach(s => {
    const panel=s.el.querySelector('.panel');
    (effects[s.mode]||[]).forEach(name=>{const fx=document.createElement('div');fx.className='scene-fx '+name;fx.setAttribute('aria-hidden','true');panel.append(fx);});
  });
  const activeObserver=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('fx-active',e.isIntersecting)),{threshold:.15});
  scenes.forEach(s=>activeObserver.observe(s.el));
  const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  let W=innerWidth,H=innerHeight,dirty=true,raf=0,lastTime=0,rain=0,targetRain=0;
  const particles = Array.from({length:W<760?32:55},()=>({x:Math.random(),y:Math.random(),s:.4+Math.random(),phase:Math.random()*6.28}));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting) entry.target.classList.add('is-visible'); }),{threshold:.12});
  scenes.forEach(s=>observer.observe(s.el));
  function layout(){
    W=innerWidth;H=innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
    scenes.forEach(s=>{s.top=s.el.getBoundingClientRect().top+scrollY;s.height=s.el.offsetHeight;});
    dirty=true;wake();
  }
  function update(){
    const y=scrollY;
    const max=document.documentElement.scrollHeight-H;
    progress.style.transform=`scaleX(${max>0?clamp(y/max):0})`;
    targetRain=0;
    scenes.forEach(s=>{
      const top=s.top-y;
      if(top>H*1.2||top+s.height< -H*.2)return;
      const p=s.pin?clamp(-top/Math.max(1,s.height-H)):clamp((H-top)/(H+s.height));
      s.el.style.setProperty('--p',p.toFixed(4));
      s.el.style.setProperty('--iris',`${lerp(9,115,clamp((p-.05)*1.8))}%`);
      s.el.style.setProperty('--beam',String(Math.max(0,1-Math.abs(p-.32)*3)));
      if(!reduced && s.mode==='shadow' && p>.25 && !s.hit){
        s.hit=true; s.el.classList.add('shadow-impact');
        setTimeout(()=>s.el.classList.remove('shadow-impact'),700);
      }
      if(p<.08)s.hit=false;
      if(top<H*.85&&top+s.height>0)s.el.classList.add('is-visible');
      if(s.mode==='rain'&&top<H*.4&&top+s.height>H*.4)targetRain=1;
      if(reduced||!s.img)return;
      let scale=1.03,x=0,yImage=0;
      switch(s.mode){
        case 'cover':scale=1.04+p*.06;yImage=p*12;break;
        case 'street':scale=lerp(1.16,1.03,p);x=lerp(-1.8,0,p);break;
        case 'walk':scale=lerp(1.02,1.23,p);yImage=-p*2;break;
        case 'shadow':scale=lerp(1.02,1.27,p);x=-p*4;break;
        case 'boss':scale=lerp(1.65,1.01,clamp(p*1.8));s.img.style.transformOrigin='70% 56%';break;
        case 'rain':scale=lerp(1.11,1.01,p);break;
        case 'finale':scale=lerp(1.01,1.06,p);s.img.style.transformOrigin='65% 50%';break;
        case 'offering':scale=1.04+Math.sin(p*Math.PI)*.035;break;
        default:scale=1.045;yImage=(p-.5)*-2.5;
      }
      s.img.style.transform=`translate(${x}%, ${yImage}%) scale(${scale})`;
      if(s.mode==='offering')s.el.querySelector('.can-glint').style.opacity=String(Math.max(0,1-Math.abs(p-.5)*9)*.65);
    });
  }
  function draw(time,dt){
    if(!ctx)return;
    ctx.clearRect(0,0,W,H);
    rain=lerp(rain,targetRain,Math.min(1,dt*.004));
    particles.forEach((p,i)=>{
      p.y+=dt*(.000009+p.s*.000008+rain*.00025);
      p.x+=Math.sin(time*.00025+p.phase)*dt*.000001-rain*dt*.00004;
      if(p.y>1.03){p.y=-.03;p.x=Math.random();}if(p.x<-.03)p.x=1.03;
      const x=p.x*W,y=p.y*H;
      if(rain>.1){ctx.strokeStyle=`rgba(163,210,222,${rain*.22})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4-rain*4,y+10+p.s*18);ctx.stroke();}
      else{ctx.fillStyle=i%3===0?'rgba(255,123,161,.25)':'rgba(103,230,219,.22)';ctx.beginPath();ctx.arc(x,y,p.s*1.3,0,Math.PI*2);ctx.fill();}
    });
  }
  function frame(time){
    raf=0;
    const dt=Math.min(40,time-(lastTime||time));lastTime=time;
    if(dirty){update();dirty=false;}
    if(!reduced)draw(time,dt);
    if(!reduced&&!document.hidden)raf=requestAnimationFrame(frame);
  }
  function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(frame);}
  function applyMotion(){
    root.classList.toggle('reduced',reduced);
    motion.setAttribute('aria-pressed',String(reduced));
    motion.setAttribute('aria-label',reduced?'Включить анимацию':'Отключить анимацию');
    motion.innerHTML=reduced?'<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"/></svg>':'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>';
    if(reduced){ctx?.clearRect(0,0,W,H);scenes.forEach(s=>{if(s.img)s.img.style.transform='none';});}
    layout();
  }
  motion.addEventListener('click',()=>{reduced=!reduced;try{localStorage.setItem('boss-motion',reduced?'off':'on');}catch{}applyMotion();});
  preference.addEventListener('change',event=>{reduced=event.matches;applyMotion();});
  addEventListener('scroll',()=>{dirty=true;wake();},{passive:true});
  addEventListener('resize',layout,{passive:true});
  addEventListener('load',layout);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;lastTime=0;}else{dirty=true;wake();}});
  document.querySelectorAll('img').forEach(img=>img.addEventListener('load',layout,{once:true}));
  let petTimer=0;
  document.querySelector('#pet').addEventListener('click',event=>{
    const button=event.currentTarget;
    root.classList.add('petting');clearTimeout(petTimer);petTimer=setTimeout(()=>root.classList.remove('petting'),1800);
    if(reduced)return;
    const r=button.getBoundingClientRect();
    const container=document.querySelector('#pet-reaction');
    if(container.children.length>20)return;
    for(let i=0;i<7;i++){
      const heart=document.createElement('span');heart.className='heart';heart.textContent='♥';
      heart.style.left=`${r.left+r.width/2+(Math.random()-.5)*50}px`;heart.style.top=`${r.top}px`;
      heart.style.setProperty('--drift',`${(Math.random()-.5)*140}px`);heart.style.animationDelay=`${i*.07}s`;
      container.append(heart);heart.addEventListener('animationend',()=>heart.remove(),{once:true});
    }
  });
  applyMotion();
})();
