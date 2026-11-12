(() => {
  'use strict';
  if(document.getElementById('notion-links-local-panel')) return;
  const {pageLink}=NotionLinksCore,dom=NotionLinksDOM,prefs=NotionLinksSettings;
  const CAP=2000,wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=(tag,text,parent)=>{const n=document.createElement(tag);if(text)n.textContent=text;parent?.append(n);return n;};
  const host=el('div');host.id='notion-links-local-panel';const shadow=host.attachShadow({mode:'open'});
  el('style',NotionLinksPanelStyle,shadow);
  const pane=el('aside','',shadow);pane.id='pane';pane.hidden=true;pane.setAttribute('aria-label','Notionナビゲーション');
  // Left edge of the pane: drag to change its width (settings.paneWidth, also in the popup).
  const resizer=el('div','',pane);resizer.className='resizer';resizer.setAttribute('role','separator');resizer.setAttribute('aria-orientation','vertical');resizer.tabIndex=0;resizer.title='ドラッグで幅を変更';
  const content=el('div','',pane);content.className='content';
  // Shown only when the page cannot be read; the page name itself is already visible in Notion.
  const title=el('p','',content);title.id='page-error';title.hidden=true;
  // No refresh button: opening the pane always re-reads the page structure and backlinks.
  /* Sections share the pane height by weight (settings.sizes); each section body scrolls on its
   * own. A collapsed section is only its header. There is a splitter between every two adjacent
   * sections, collapsed or not; it moves weight between the nearest open section above it and the
   * nearest open section below it, and collapsed headers in between move with it. Collapsed
   * sections with no open section below them sit at the bottom, because the open sections above
   * take all the remaining height. */
  function section(name,index){const box=el('div','',content);box.className='section';box.style.setProperty('--w','1');const summary=el('button','',box);summary.className='summary';summary.setAttribute('aria-expanded','true');el('span',name,summary);const count=el('small','',summary),body=el('div','',box);body.className='body';const status=el('p','',body);status.className='status';summary.onclick=()=>{const open=box.hasAttribute('data-collapsed');box.toggleAttribute('data-collapsed',!open);summary.setAttribute('aria-expanded',String(open));layout();};return{details:box,index,count,status,list:el('ul','',body)};}
  const outline=section('Outline',0),forward=section('Forward links',1),backward=section('Backward links',2);
  const sections=[outline,forward,backward],MIN_SECTION=64;
  function layout(){for(const s of sections)s.details.style.setProperty('--w',String(settings.sizes[s.index]));for(const n of content.querySelectorAll('.splitter'))n.remove();const shown=sections.filter(s=>!s.details.hidden);for(let i=1;i<shown.length;i++){const a=shown[i-1],b=shown[i],bar=el('div');bar.className='splitter';bar.setAttribute('role','separator');bar.setAttribute('aria-orientation','horizontal');bar.tabIndex=0;bar.title='ドラッグで高さを変更';const open=s=>!s.details.hasAttribute('data-collapsed'),above=shown.slice(0,i).reverse().find(open),below=shown.slice(i).find(open);bar.toggleAttribute('data-inert',!above||!below);if(!above||!below){bar.tabIndex=-1;bar.title='';}b.details.before(bar);if(above&&below)bindSplitter(bar,above,below);}}
  function bindSplitter(bar,a,b){let start=null;const resize=dy=>{const{hA,hB,wA,wB}=start,total=hA+hB,next=Math.min(total-MIN_SECTION,Math.max(MIN_SECTION,hA+dy)),sizes=[...settings.sizes];sizes[a.index]=(wA+wB)*next/total;sizes[b.index]=wA+wB-sizes[a.index];settings={...settings,sizes};a.details.style.setProperty('--w',String(sizes[a.index]));b.details.style.setProperty('--w',String(sizes[b.index]));};const begin=()=>{start={hA:a.details.getBoundingClientRect().height,hB:b.details.getBoundingClientRect().height,wA:settings.sizes[a.index],wB:settings.sizes[b.index]};};const save=()=>{start=null;const snapshot={...settings};saveQueue=saveQueue.catch(()=>{}).then(()=>prefs.write(snapshot)).catch(()=>{});};
    bar.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();bar.setPointerCapture(e.pointerId);begin();start.y=e.clientY;bar.setAttribute('data-dragging','');};
    bar.onpointermove=e=>{if(start)resize(e.clientY-start.y);};
    bar.onpointerup=bar.onpointercancel=()=>{if(!start)return;bar.removeAttribute('data-dragging');save();};
    bar.onkeydown=e=>{const dy=e.key==='ArrowUp'?-24:e.key==='ArrowDown'?24:0;if(!dy)return;e.preventDefault();begin();resize(dy);save();};}
  {let start=null;const width=w=>Math.round(Math.max(240,Math.min(720,innerWidth-200,w))),set=w=>{settings={...settings,paneWidth:width(w)};host.style.setProperty('--pane-width',`${settings.paneWidth}px`);NotionLinksDecorations.apply(ctx,settings,!pane.hidden,pageData?.numbers);},save=()=>{start=null;const snapshot={...settings};saveQueue=saveQueue.catch(()=>{}).then(()=>prefs.write(snapshot)).catch(()=>{});};
    resizer.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();resizer.setPointerCapture(e.pointerId);start={x:e.clientX,w:pane.getBoundingClientRect().width};resizer.setAttribute('data-dragging','');};
    resizer.onpointermove=e=>{if(start)set(start.w+start.x-e.clientX);};
    resizer.onpointerup=resizer.onpointercancel=()=>{if(!start)return;resizer.removeAttribute('data-dragging');save();};
    resizer.onkeydown=e=>{const dx=e.key==='ArrowLeft'?20:e.key==='ArrowRight'?-20:0;if(!dx)return;e.preventDefault();set(settings.paneWidth+dx);save();};}
  document.documentElement.append(host);
  let settings={...prefs.defaults},ctx=null,currentID='',route='',timer=null,lastRun=0,lastError='';
  let blocks=new Map(),heads=new Map(),forwardItems=[],backSnapshot=null,backMessage='未取得',capped=false;
  let backTask=null,epoch=0,navAuto='',saveQueue=Promise.resolve();
  let pageData=null,pageTask=null,pageRequest='',pageError='';const renderKeys=new WeakMap();
  const toolbarHost=el('span');toolbarHost.id='nlx-toolbar';const tbShadow=toolbarHost.attachShadow({mode:'open'});
  el('style',`:host{display:inline-flex;align-items:center;flex-shrink:0;margin:0 5px}button{border:0;border-radius:5px;background:transparent;color:inherit;font:14px/1.4 system-ui;cursor:pointer;padding:5px 8px}button:hover,button[aria-expanded=true]{background:#8882}button:focus-visible{outline:2px solid #197d34;outline-offset:2px}`,tbShadow);
  function paneToggle(parent){const button=el('button','',parent);button.setAttribute('aria-label','右Paneを開閉');button.title='Outline・リンクのPaneを開閉';button.setAttribute('aria-expanded','false');const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('aria-hidden','true');svg.style.display='block';const rect=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({x:3,y:4,width:18,height:16,rx:2}))rect.setAttribute(k,v);const divider=document.createElementNS(ns,'path');divider.setAttribute('d','M16 4v16');svg.append(rect,divider);button.append(svg);return button;}
  const linksButton=paneToggle(tbShadow);
  const fallback=paneToggle(shadow);fallback.id='fallback';fallback.hidden=true;
  const media=matchMedia('(prefers-color-scheme: dark)');
  function applySettings(){const dark=settings.theme==='dark'||settings.theme==='auto'&&(!!document.querySelector('.notion-dark-theme')||media.matches&&!document.querySelector('.notion-light-theme'));host.toggleAttribute('data-dark',!!dark);host.style.setProperty('--accent',settings.accent);host.style.setProperty('--pane-width',`${settings.paneWidth}px`);outline.details.hidden=!settings.outline;forward.details.hidden=!settings.forward;backward.details.hidden=!settings.backward;if(!content.querySelector('.splitter[data-dragging]'))layout();NotionLinksDecorations.apply(ctx,settings,!pane.hidden,pageData?.numbers);}
  prefs.read().then(value=>{settings=value;applySettings();schedule();}).catch(()=>{});
  globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[prefs.KEY]){settings=prefs.sanitize(changes[prefs.KEY].newValue);applySettings();schedule();}});
  media.addEventListener('change',applySettings);
  function mountToolbar(){const toolbar=dom.toolbar(document);if(toolbar){const share=dom.shareAnchor(toolbar);if(share){if(toolbarHost.nextSibling!==share)share.before(toolbarHost);}else if(toolbarHost.parentElement!==toolbar)toolbar.prepend(toolbarHost);fallback.hidden=true;const top=toolbar.closest('.notion-topbar')?.getBoundingClientRect().bottom;host.style.setProperty('--pane-top',`${Math.max(0,top||48)}px`);}else{fallback.hidden=false;toolbarHost.remove();}}
  function renderList(list,items,kind){const key=JSON.stringify(items);if(renderKeys.get(list)===key)return;renderKeys.set(list,key);const frag=document.createDocumentFragment();for(const item of items){const li=el('li','',frag),a=el('a',item.title,li);if(kind==='outline'){a.href=`#${item.id.replaceAll('-','')}`;a.className='outline-link';a.dataset.blockId=item.id;a.style.paddingInlineStart=`${6+(item.level-1)*14}px`;a.onclick=e=>{e.preventDefault();void jump(item);};}else{a.href=item.href;a.target='_blank';a.rel='noopener noreferrer';a.title='別タブで開く';}}list.replaceChildren(frag);}
  function reset(){epoch++;pageTask?.abort();pageTask=null;pageData=null;pageRequest='';pageError='';backTask?.abort();backTask=null;blocks.clear();heads.clear();forwardItems=[];backSnapshot=null;backMessage='未取得';capped=false;for(const s of[outline,forward,backward]){s.list.replaceChildren();renderKeys.delete(s.list);s.count.textContent='';}navAuto='';}
  function collect(){if(!ctx)return;const mounted=[...ctx.root.querySelectorAll('[data-block-id]')],mountedHeads=new Map(dom.headings(ctx).map(h=>[NotionLinksPageData.normalize(h.id),h]));for(const block of mounted){const id=NotionLinksPageData.normalize(block.getAttribute('data-block-id'));if(!blocks.has(id)&&blocks.size>=CAP){capped=true;continue;}const links=dom.forward({root:block},location.href).filter(item=>[...block.querySelectorAll('a[href]')].some(a=>pageLink(a.href,location.href)?.id===item.id&&a.closest('[data-block-id]')===block));blocks.set(id,links.slice(0,CAP));if(mountedHeads.has(id))heads.set(id,{...heads.get(id),...mountedHeads.get(id)});else heads.delete(id);}const all=new Map();const groups=mounted.length?blocks.values():[dom.forward(ctx,location.href)];for(const links of groups)for(const item of links){if(all.size<CAP)all.set(item.id,item);else capped=true;}forwardItems=[...all.values()];}
  /* Normal sources (not shown in the pane):
   * - Outline / Forward links: page structure from loadPageChunk (headings; mentions, text links,
   *   link-to-page blocks and child pages), no scrolling needed.
   * - Backward links: getBacklinksForBlockInitial (see page-data.js); Notion's Backlinks list is
   *   never opened.
   * The status line appears only for in-progress, partial or failed states. */
  function render(){title.hidden=!!ctx;if(!ctx){title.textContent=`取得できません：${lastError||'ページの描画待ち'}`;outline.status.textContent='';forward.status.textContent='';backward.status.textContent='';return;}const partial=pageData?`${pageData.complete?'':'途中までしか取得できませんでした。'}${pageData.missing?'一部ブロックは取得できませんでした。':''}`:'';const h=[...heads.values()].sort((a,b)=>a.order!==undefined&&b.order!==undefined?a.order-b.order:(a.top||0)-(b.top||0));outline.count.textContent=String(h.length);outline.status.textContent=pageData?`${partial}${pageData.unsupported.length?'未対応ブロック内の見出しは対象外。':''}`:pageTask?'取得中…':'ページ構造を取得できないため、描画済みの見出しのみ。';renderList(outline.list,h,'outline');forward.count.textContent=String(forwardItems.length);forward.status.textContent=pageData?`${partial}${capped?'上限2,000件。':''}`:pageTask?'取得中…':`ページ構造を取得できないため、描画済みの本文のみ。${capped?'上限2,000ブロック。':''}`;renderList(forward.list,forwardItems,'links');backward.count.textContent=backSnapshot?String(backSnapshot.items.length):'—';backward.status.textContent=backTask?'取得中…':backMessage||(backSnapshot?`${backSnapshot.inaccessible?`閲覧権限のないページ${backSnapshot.inaccessible}件は表示していません。`:''}${backSnapshot.partial||backSnapshot.unresolved?'一部のリンク元を取得できませんでした。':''}${backSnapshot.capped?'上限2,000件。':''}`:'未取得');renderList(backward.list,backSnapshot?.items||[],'links');highlight();}
  function update(){lastRun=Date.now();mountToolbar();const next=`${location.pathname}${location.search}`,id=pageLink(location.href,location.href)?.id||'';if(id!==currentID||next!==route){reset();currentID=id;route=next;}const result=dom.context(document,location.href);lastError=result.error||'';ctx=result.error?null:result;applySettings();if(ctx){collect();if(pageRequest!==currentID)void loadPageData();}else{for(const s of[outline,forward,backward]){s.list.replaceChildren();renderKeys.delete(s.list);s.count.textContent='';}}render();if(ctx&&!pane.hidden&&settings.backward&&!backTask&&navAuto!==currentID){navAuto=currentID;void acquireBacklinks();}}
  async function loadPageData(){
    if(!ctx||pageTask)return;
    const controller=new AbortController(),ticket=epoch,id=currentID;
    pageTask=controller;pageRequest=id;pageError='';
    try{const data=await NotionLinksPageData.load(id,{signal:controller.signal});
      if(ticket!==epoch||id!==currentID)return;
      pageData=data;blocks=new Map(data.blockLinks);heads=new Map(data.headings.map(h=>[NotionLinksPageData.normalize(h.id),h]));
      collect();applySettings();
    }catch(error){if(ticket===epoch&&error.name!=='AbortError')pageError=error.message;}
    finally{if(pageTask===controller)pageTask=null;if(ticket===epoch)render();}
  }
  function schedule(){if(timer||document.hidden)return;timer=setTimeout(()=>{timer=null;update();},Math.max(200,700-(Date.now()-lastRun)));}
  function setOpen(value){pane.hidden=!value;linksButton.setAttribute('aria-expanded',String(value));fallback.setAttribute('aria-expanded',String(value));applySettings();if(!value){backTask?.abort();backTask=null;}else{navAuto='';pageRequest='';update();}}
  linksButton.onclick=fallback.onclick=()=>setOpen(pane.hidden);
  function same(task){return !task.cancelled&&task.epoch===epoch&&task.page===currentID&&task.path===`${location.pathname}${location.search}`&&!pane.hidden;}
  async function acquireBacklinks(){
    if(!ctx||!settings.backward||backTask)return;
    const controller=new AbortController(),ticket=epoch,id=currentID;
    backTask=controller;backSnapshot=null;backMessage='';render();
    try{const data=await NotionLinksPageData.loadBacklinks(id,{signal:controller.signal});if(ticket===epoch&&id===currentID)backSnapshot=data;}
    catch(error){if(ticket===epoch&&error.name!=='AbortError')backMessage=`取得できません：${error.message}`;}
    finally{if(backTask===controller)backTask=null;if(ticket===epoch)render();}
  }
  async function jump(item){
    if(!ctx)return;
    const task={epoch,page:currentID,path:`${location.pathname}${location.search}`,cancelled:false};
    const root=ctx.root,scroller=ctx.scroller;
    const find=()=>[...root.querySelectorAll('[data-block-id]')].find(n=>n.getAttribute('data-block-id')===item.id);
    const target=pageData?.topIndex.get(NotionLinksPageData.normalize(item.id));
    let block=find(),low=0,high=scroller?Math.max(0,scroller.scrollHeight-scroller.clientHeight):0;
    for(let attempt=0;!block&&attempt<14&&same(task)&&scroller;attempt++){
      const visible=[...root.querySelectorAll('[data-block-id]')].map(n=>pageData?.topIndex.get(NotionLinksPageData.normalize(n.getAttribute('data-block-id')))).filter(Number.isFinite);
      if(target!==undefined&&visible.length){
        const first=Math.min(...visible),last=Math.max(...visible);
        if(target<first)high=Math.min(high,scroller.scrollTop);
        else if(target>last)low=Math.max(low,scroller.scrollTop);
        else break; // A closed toggle must not be opened without a user action.
      }
      const next=target===undefined&&Number.isFinite(item.top)?Math.max(0,item.top-24):(low+high)/2;
      if(attempt&&Math.abs(next-scroller.scrollTop)<2)break;
      scroller.scrollTop=next;await wait(180);block=find();
    }
    if(block&&same(task))block.scrollIntoView({block:'start',behavior:'smooth'});
    else outline.status.textContent='見出しを表示できません。閉じたトグル内の場合は本文で開いてください。';
  }
  let highlightTimer=null;
  function highlight(){if(!ctx)return;let active='';for(const heading of dom.headings(ctx))if(heading.top<=(ctx.scroller?.scrollTop||0)+100)active=heading.id;for(const a of outline.list.querySelectorAll('a')){const selected=a.dataset.blockId===active;a.toggleAttribute('data-active',selected);if(selected)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}}
  document.addEventListener('scroll',()=>{if(!highlightTimer)highlightTimer=setTimeout(()=>{highlightTimer=null;if(!pane.hidden)highlight();},100);},true);
  const own=n=>!!n&&(NotionLinksDecorations.isOwnNode(n)||!!n.closest?.('#nlx-toolbar'));
  const observer=new MutationObserver(records=>{if(records.every(r=>own(r.target.nodeType===1?r.target:r.target.parentElement)))return;schedule();});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['href','class','aria-busy']});
  window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  setInterval(()=>{if(!document.hidden&&(`${location.pathname}${location.search}`!==route||ctx&&(!ctx.root.isConnected||ctx.frame&&!ctx.frame.hasAttribute('data-nlx-managed'))))schedule();},1000);
  update();
})();
