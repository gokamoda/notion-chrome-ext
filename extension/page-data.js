/* Notion-specific read adapter. Request and response verified on app.notion.com,
 * 2026-11-12. loadPageChunk was identified in the installed Notion Boost 3.3.9.
 * This is independently implemented, not a copy of that extension's code.
 */
(() => {
  'use strict';
  const CAP=2000;
  const normalize=id=>typeof id==='string'?id.replaceAll('-','').toLowerCase():'';
  const uuid=id=>normalize(id).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
  function recordsFrom(map){
    const records=new Map();
    for(const entry of Object.values(map||{})){
      const first=entry?.value,record=first?.value?.id?first.value:first;
      if(record&&typeof record.id==='string'&&typeof record.type==='string')records.set(normalize(record.id),record);
    }
    return records;
  }
  function parse(map,pageId,origin){
    const records=recordsFrom(map),root=records.get(normalize(pageId));
    if(!root||root.type!=='page'||!Array.isArray(root.content))throw Error('ページ構造の形式が未対応です。');
    const headings=[],links=new Map(),blockLinks=new Map(),numbers=new Map(),topIndex=new Map(),tableRows=new Map();
    const visited=new Set(),missing=new Set(),unsupported=new Set();let order=0;
    const text=(rich,depth=0)=>Array.isArray(rich)&&depth<4?rich.map(token=>{
      if(!Array.isArray(token))return '';
      const annotations=Array.isArray(token[1])?token[1]:[];
      // Inline equation: ['⁍', [['e', '<LaTeX>']]] (verified in the live response). Show the LaTeX source.
      const equation=annotations.find(a=>Array.isArray(a)&&a[0]==='e'&&typeof a[1]==='string');
      if(equation)return equation[1];
      const page=annotations.find(a=>Array.isArray(a)&&a[0]==='p');
      return page?text(records.get(normalize(page[1]))?.properties?.title,depth+1)||'無題のページ':typeof token[0]==='string'?token[0]:'';
    }).join(''):'';
    const add=(id,label,result,fallback='')=>{
      const key=normalize(id);if(!/^[a-f0-9]{32}$/.test(key))return;
      const item={id:key,href:`${origin}/p/${key}`,title:label||text(records.get(key)?.properties?.title)||fallback||`ページ ${key.slice(0,8)}（名前未取得）`};
      links.set(key,item);result.set(key,item);
    };
    function visit(id,top,depth){
      const key=normalize(id);if(visited.has(key))return;visited.add(key);
      if(depth>50){unsupported.add('深さ上限');return;}
      const block=records.get(key);if(!block){missing.add(key);return;}if(block.alive===false)return;
      const result=new Map();topIndex.set(key,top);
      if(['page','collection_view','collection_view_page'].includes(block.type)){
        if(block.type==='page')add(block.id,text(block.properties?.title),result);
        blockLinks.set(key,[...result.values()]);return;
      }
      // Line numbers: one per block with its own text/void element. Layout containers have none.
      // A callout whose own title is empty keeps its text in child blocks (observed 2026-11-12);
      // the callout itself has no visible line.
      const emptyCallout=block.type==='callout'&&!text(block.properties?.title)&&Array.isArray(block.content)&&block.content.length>0;
      if(!['column_list','column','table'].includes(block.type)&&!emptyCallout)numbers.set(key,++order);
      // Table rows have no data-block-id in the page; they are addressed by position in the table.
      if(block.type==='table'&&Array.isArray(block.content))block.content.forEach((child,index)=>tableRows.set(normalize(child),{table:key,index}));
      const levels={header:1,sub_header:2,sub_sub_header:3,header_4:4},level=levels[block.type];
      if(level)headings.push({id:block.id,level,title:text(block.properties?.title)||'無題の見出し',order:headings.length,topIndex:top});
      // Formats verified in the live response (2026-11-12):
      //   page mention   ['‣', [['p', '<page id>', '<space id>']]]
      //   text link      ['label', [['a', 'https://app.notion.com/p/<page id>']]]
      //   link-to-page   type 'alias', format.alias_pointer {id, table:'block'}
      for(const token of Array.isArray(block.properties?.title)?block.properties.title:[]){
        if(!Array.isArray(token)||!Array.isArray(token[1]))continue;
        for(const annotation of token[1]){
          if(!Array.isArray(annotation))continue;
          if(annotation[0]==='p')add(annotation[1],'',result);
          else if(annotation[0]==='a'&&typeof annotation[1]==='string'){
            const link=globalThis.NotionLinksCore?.pageLink(annotation[1],origin);
            if(link)add(link.id,'',result,typeof token[0]==='string'?token[0]:'');
          }
        }
      }
      const alias=block.type==='alias'?block.format?.alias_pointer:null;
      if(alias&&(alias.table===undefined||alias.table==='block'))add(alias.id,'',result);
      if(['transclusion_reference','synced_block','unsupported'].includes(block.type))unsupported.add(block.type);
      blockLinks.set(key,[...result.values()]);
      if(Array.isArray(block.content))for(const child of block.content)visit(child,top,depth+1);
    }
    root.content.forEach((id,index)=>visit(id,index,0));
    return{headings,links:[...links.values()],blockLinks,numbers,tableRows,topIndex,topBlocks:root.content.map(normalize),missing:missing.size,missingIds:[...missing],spaceId:root.space_id,unsupported:[...unsupported],visited:visited.size};
  }
  async function load(pageId,{origin=location.origin,signal}={}){
    if(!ORIGINS.includes(origin))throw Error('Notion以外への通信は拒否しました。');
    if(!/^[a-f0-9]{32}$/.test(normalize(pageId)))throw Error('ページIDが不正です。');
    const map={},cursors=new Set();let cursor={stack:[]},complete=false,chunks=0;
    for(;chunks<20;chunks++){
      const key=JSON.stringify(cursor);if(cursors.has(key))throw Error('ページの読み込みカーソルが進みません。');cursors.add(key);
      const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted)controller.abort();const timeout=setTimeout(abort,12000);
      let response;
      try{response=await fetch(`${origin}/api/v3/loadPageChunk`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({pageId:uuid(pageId),limit:100,cursor,chunkNumber:chunks,verticalColumns:false})});
        if(!response.ok)throw Error(`Notionのページ読み取りに失敗しました（HTTP ${response.status}）。`);
        const data=await response.json();
        if(!data?.recordMap?.block||typeof data.recordMap.block!=='object'||!Array.isArray(data.cursor?.stack))throw Error('Notionの応答形式が変わった可能性があります。');
        Object.assign(map,data.recordMap.block);cursor=data.cursor;
      }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
      if(Object.keys(map).length>10000)break;
      if(cursor.stack.length===0){complete=true;chunks++;break;}
    }
    /* Children of closed toggles are not in loadPageChunk's response (observed 2026-11-12).
     * Read them with syncRecordValues (same request as in loadBacklinks), a few levels deep. */
    let parsed=parse(map,pageId,origin);
    for(let round=0;round<6&&parsed.missingIds.length&&Object.keys(map).length<10000;round++){
      const before=Object.keys(map).length;
      for(let i=0;i<parsed.missingIds.length;i+=100){
        const reply=await post(origin,'syncRecordValues',{requests:parsed.missingIds.slice(i,i+100).map(id=>({pointer:{table:'block',id:uuid(id),...(parsed.spaceId?{spaceId:parsed.spaceId}:{})},version:-1}))},signal);
        Object.assign(map,reply?.recordMap?.block||{});
      }
      parsed=parse(map,pageId,origin);
      if(Object.keys(map).length===before)break;
    }
    return{...parsed,complete,chunks,recordCount:Object.keys(map).length,time:new Date().toLocaleTimeString('ja-JP')};
  }
  const ORIGINS=['https://app.notion.com','https://www.notion.so','https://notion.so'];
  async function post(origin,endpoint,body,signal){
    const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)controller.abort();const timeout=setTimeout(abort,12000);
    try{const response=await fetch(`${origin}/api/v3/${endpoint}`,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify(body)});
      if(!response.ok)throw Error(`Notionの読み取りに失敗しました（${endpoint}、HTTP ${response.status}）。`);
      return await response.json();
    }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
  const plainTitle=(records,record)=>(Array.isArray(record?.properties?.title)?record.properties.title:[]).map(token=>{
    if(!Array.isArray(token))return '';const a=Array.isArray(token[1])?token[1]:[];
    const eq=a.find(x=>Array.isArray(x)&&x[0]==='e');if(eq)return eq[1];
    const page=a.find(x=>Array.isArray(x)&&x[0]==='p');if(page)return plainTitle(new Map(),records.get(normalize(page[1])))||'';
    return typeof token[0]==='string'?token[0]:'';
  }).join('');
  /* Backlinks without opening Notion's Backlinks list. Verified on app.notion.com, 2026-11-12:
   *   POST /api/v3/getBacklinksForBlockInitial {block:{id}}
   *     -> {backlinks:[{block_id, mentioned_from:{type, block_id?, pointer:{id,spaceId,table}}}],
   *         inaccessibleBacklinkCount, recordMap:{block}, fanoutData:[]}
   *   mentioned_from.type: 'property_mention' (page mention in text; block record included)
   *   or 'alias' (link-to-page block; only the pointer, record not included).
   *   Plain text links (URL) do not appear here, the same as Notion's own Backlinks list.
   * The source page is the nearest ancestor of type 'page'. Missing ancestors are read with
   *   POST /api/v3/syncRecordValues {requests:[{pointer:{table:'block',id,spaceId},version:-1}]}.
   * A non-empty fanoutData means part of the list lives elsewhere (getBacklinksForBlockFanout,
   * not implemented); the result is then marked partial. */
  async function loadBacklinks(pageId,{origin=location.origin,signal}={}){
    if(!ORIGINS.includes(origin))throw Error('Notion以外への通信は拒否しました。');
    const self=normalize(pageId);if(!/^[a-f0-9]{32}$/.test(self))throw Error('ページIDが不正です。');
    const data=await post(origin,'getBacklinksForBlockInitial',{block:{id:uuid(self)}},signal);
    if(!Array.isArray(data?.backlinks))throw Error('Notionの応答形式が変わった可能性があります。');
    const records=recordsFrom(data.recordMap?.block),space=new Map();
    const starts=data.backlinks.slice(0,CAP).map(b=>{const from=b?.mentioned_from||{},id=normalize(from.block_id||from.pointer?.id);if(id)space.set(id,from.pointer?.spaceId||b.space_id);return id;}).filter(id=>/^[a-f0-9]{32}$/.test(id));
    const resolve=start=>{let key=start;for(let depth=0;depth<40;depth++){const r=records.get(key);if(!r)return{missing:key};if(r.alive===false)return{dead:true};if(r.type==='page')return{page:r};if(r.parent_table!=='block'||!r.parent_id)return{none:true};const next=normalize(r.parent_id);if(!space.has(next))space.set(next,space.get(key)||r.space_id);key=next;}return{none:true};};
    for(let round=0;round<8;round++){
      const missing=[...new Set(starts.map(resolve).map(r=>r.missing).filter(Boolean))];if(!missing.length)break;
      for(let i=0;i<missing.length;i+=100){
        const reply=await post(origin,'syncRecordValues',{requests:missing.slice(i,i+100).map(id=>({pointer:{table:'block',id:uuid(id),...(space.get(id)?{spaceId:space.get(id)}:{})},version:-1}))},signal);
        const got=recordsFrom(reply?.recordMap?.block);if(!got.size&&round)break;for(const [k,v] of got)records.set(k,v);
      }
    }
    const items=new Map();let unresolved=0;
    for(const start of starts){const r=resolve(start);if(r.dead)continue;if(!r.page){unresolved++;continue;}const id=normalize(r.page.id);if(id===self||items.has(id))continue;items.set(id,{id,href:`${origin}/p/${id}`,title:plainTitle(records,r.page)||'無題のページ'});}
    return{items:[...items.values()],inaccessible:Number(data.inaccessibleBacklinkCount)||0,unresolved,partial:Array.isArray(data.fanoutData)&&data.fanoutData.length>0,capped:data.backlinks.length>CAP,time:new Date().toLocaleTimeString('ja-JP')};
  }
  globalThis.NotionLinksPageData=Object.freeze({parse,load,loadBacklinks,normalize});
})();
