import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Margin connects directly to your Supabase project. The publishable key is safe
// to use in a browser only when Row Level Security is enabled (see supabase-schema.sql).
const SUPABASE_URL = "https://xzbvobeylhwqeliyqsvd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_r_uVsMJ1S6zPOr5mBTP_wA_7fqmhjjI";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

try {
  if(localStorage.getItem("margin-theme")==="dark")document.documentElement.dataset.theme="dark";
} catch(error) {
  console.warn("Could not read the saved appearance preference.",error);
}
const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, profileCache:new Map(), editingPost:null, editingPostStatus:null, autosaveDraftId:null, autoSaveEnabled:true, autoSaveNotificationsEnabled:false, editorInitialized:false, editorRecoveryKey:null, editorAutosaveTimer:null, editorAutosavePromise:null, editorAutosavePending:false, editorVersion:0, editorAutosavedVersion:0, editorStorageFailureNotified:false, showLineCount:true, avatarFile:null, removeAvatar:false, activePage:"feed", readerPost:null, readerRequest:0, readerComments:[], editingCommentId:null, feedPosts:[], feedCacheUserId:null, likedPostIds:new Set(), likeCounts:new Map(), likeOperations:new Map(), search:"", toastTimer:null };
const pages = ["feed","explore","drafts","write","profile","settings"];
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = (name="M") => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase() || "M";
const richTextTags = new Set(["a","b","blockquote","br","del","div","em","h1","h2","h3","i","li","ol","p","pre","s","strong","u","ul"]);
const blockedRichTags = new Set(["embed","iframe","math","object","script","style","svg","template"]);
const blockRichTags = new Set(["blockquote","div","h1","h2","h3","ol","p","pre","ul"]);
const safeLink = (value) => {
  const link=String(value||"").trim();
  if(!link)return null;
  try {
    const target=/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(link)?link:`https://${link}`;
    const url=new URL(target,window.location.origin);
    return ["http:","https:","mailto:"].includes(url.protocol)?url.href:null;
  } catch { return null; }
};
const sanitizeRichHtml = (html) => {
  const parsed=new DOMParser().parseFromString(String(html||""),"text/html");
  const output=document.createElement("div");
  const cleanNode=(node)=>{
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue||"");
    if(node.nodeType!==Node.ELEMENT_NODE)return null;
    const tag=node.tagName.toLowerCase();
    if(blockedRichTags.has(tag))return null;
    const allowed=richTextTags.has(tag);
    const clean=allowed?document.createElement(tag):document.createDocumentFragment();
    if(tag==="a"&&allowed){
      const href=safeLink(node.getAttribute("href")||"");
      if(href)clean.setAttribute("href",href);
    }
    for(const child of Array.from(node.childNodes)){
      const result=cleanNode(child);
      if(result)clean.appendChild(result);
    }
    if(tag==="p"&&!clean.textContent.trim()&&!clean.querySelector("br"))return null;
    if(["h1","h2","h3","p"].includes(tag)&&Array.from(clean.childNodes).some(child=>child.nodeType===Node.ELEMENT_NODE&&blockRichTags.has(child.tagName.toLowerCase()))){
      const fragment=document.createDocumentFragment();
      while(clean.firstChild)fragment.appendChild(clean.firstChild);
      return fragment;
    }
    return clean;
  };
  for(const node of Array.from(parsed.body.childNodes)){
    const clean=cleanNode(node);
    if(clean)output.appendChild(clean);
  }
  return output.innerHTML;
};
const plainTextToRichHtml = (value) => {
  const output=document.createElement("div");
  const paragraphs=String(value||"").replace(/\r\n?/g,"\n").split(/\n{2,}/);
  for(const paragraph of paragraphs){
    const p=document.createElement("p");
    const lines=paragraph.split("\n");
    lines.forEach((line,index)=>{
      if(index)p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode(line));
    });
    output.appendChild(p);
  }
  return output.innerHTML;
};
const storedBodyHtml = (body) => {
  const source=String(body||"");
  const parsed=new DOMParser().parseFromString(source,"text/html");
  return parsed.body.querySelector("*")?sanitizeRichHtml(source):plainTextToRichHtml(source);
};
const richHtmlToText = (html) => {
  const parsed=new DOMParser().parseFromString(sanitizeRichHtml(html),"text/html");
  const blocks=new Set(["BLOCKQUOTE","DIV","H1","H2","H3","LI","P","PRE"]);
  const read=(node)=>{
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue||"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    if(node.tagName==="BR")return "\n";
    const content=Array.from(node.childNodes).map(read).join("");
    return blocks.has(node.tagName)?`${content}\n\n`:content;
  };
  return Array.from(parsed.body.childNodes).map(read).join("").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
};
const syncEditorToolbar = () => {
  const editor=$("postBody"), selection=window.getSelection();
  const focused=!!selection&&editor.contains(selection.anchorNode);
  document.querySelectorAll("[data-editor-command]").forEach(button=>{
    const command=button.dataset.editorCommand;
    let active=false,enabled=true;
    if(command==="formatBlock"&&focused&&typeof document.queryCommandValue==="function"){
      const block=String(document.queryCommandValue("formatBlock")||"").replace(/[<>]/g,"").toLowerCase();
      active=block===button.dataset.commandValue;
    }else if(focused&&command!=="undo"&&command!=="redo"&&typeof document.queryCommandState==="function")active=document.queryCommandState(command);
    if(command==="undo"||command==="redo")enabled=focused&&typeof document.queryCommandEnabled==="function"&&document.queryCommandEnabled(command);
    button.classList.toggle("active",active);
    button.disabled=!enabled;
  });
};
const handle = (p) => `${p.username}#${String(p.username_tag).padStart(4,"0")}`;
const dateLabel = (date) => new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(date));
const toast = (message) => { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>el.classList.remove("show"),3200); };
const setMessage = (message, error=false) => { $("authMessage").textContent=message; $("authMessage").classList.toggle("error",error); };
const setBusy = (button,busy,label) => { if(!button)return; button.disabled=busy; if(busy)button.dataset.oldText=button.innerHTML; button.innerHTML=busy?"Please wait…":(button.dataset.oldText||label||button.innerHTML); };
const showAuth = (tab="signup") => { $("authView").classList.remove("hidden"); $("appView").classList.add("hidden"); switchAuth(tab); };
const switchAuth = (tab) => {
  document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.authTab===tab));
  ["signupForm","loginForm","resetForm","newPasswordForm"].forEach(id=>$(id).classList.add("hidden"));
  $(({signup:"signupForm",login:"loginForm",reset:"resetForm",newPassword:"newPasswordForm"})[tab]).classList.remove("hidden");
  setMessage("");
};
const avatarMarkup = (profile, cls="avatar") => profile?.avatar_url ? `<span class="${cls}"><img src="${escapeHtml(profile.avatar_url)}" alt=""></span>` : `<span class="${cls}">${escapeHtml(initials(profile?.preferred_name||profile?.username||"M"))}</span>`;
const uploadAvatar = async (file) => {
  if(!file) return null;
  if(!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if(file.size>5*1024*1024) throw new Error("Profile pictures must be 5 MB or smaller.");
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from("profile-pictures").upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;
  const {data}=supabase.storage.from("profile-pictures").getPublicUrl(path);
  return data.publicUrl;
};
const loadProfile = async () => {
  const {data,error}=await supabase.from("profiles").select("*").eq("id",state.user.id).single();
  if(error)throw error; state.profile=data;state.profileCache.set(data.id,data);updateChrome();
};
const updateChrome = () => {
  const p=state.profile; if(!p)return;
  $("sidebarName").textContent=p.preferred_name||p.username;
  $("sidebarHandle").textContent="@"+handle(p);
  $("sidebarAvatar").innerHTML=p.avatar_url?`<img src="${escapeHtml(p.avatar_url)}" alt="">`:escapeHtml(initials(p.preferred_name||p.username));
  $("mobileProfile").innerHTML=p.avatar_url?`<img src="${escapeHtml(p.avatar_url)}" alt="">`:escapeHtml(initials(p.preferred_name||p.username));
};
const enterApp = async (user) => {
  state.user=user;
  try { await loadProfile(); $("authView").classList.add("hidden"); $("appView").classList.remove("hidden"); navigate("feed"); }
  catch(e){toast("Could not load your profile: "+e.message);showAuth("login");}
};
const navigate = async (page, extra=null) => {
  state.activePage=page;
  pages.forEach(p=>$(p+"Page").classList.toggle("hidden",p!==page));
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));
  document.querySelectorAll(".mobile-nav [data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===page));
  if(page==="feed")await renderFeed();
  if(page==="explore")await renderExplore();
  if(page==="drafts")await renderDrafts();
  if(page==="write")prepareEditor(extra);
  if(page==="profile")await renderProfile(extra||state.user.id);
  if(page==="settings")fillSettings();
  window.scrollTo({top:0,behavior:"smooth"});
};
const emptyState = (title,body,action=false) => `<div class="empty-state"><div class="empty-icon">m.</div><h3>${title}</h3><p>${body}</p>${action?'<button class="primary-button compact" data-nav="write">Write the first story</button>':""}</div>`;
const fetchPosts = async (onlyMine=false) => {
  let q=supabase.from("posts").select("*, profiles(id,preferred_name,username,username_tag,avatar_url)").order("created_at",{ascending:false});
  if(onlyMine)q=q.eq("author_id",state.user.id);
  else q=q.eq("status","published");
  const {data,error}=await q; if(error)throw error;
  const posts=data||[];
  posts.forEach(post=>{if(post.profiles)state.profileCache.set(post.profiles.id,post.profiles);});
  return posts;
};
const loadLikeState = async (posts,result=null) => {
 const pendingCounts=new Map([...state.likeOperations.keys()].map(id=>[id,state.likeCounts.get(id)]));
 state.likeCounts=new Map(posts.map(post=>[post.id,post.like_count||0]));
 const {data,error}=result||await supabase.from("likes").select("post_id").eq("user_id",state.user.id);
 if(error){
  toast("Could not load like status: "+error.message);
  for(const [id,count] of pendingCounts){
   if(count!==undefined)state.likeCounts.set(id,count);
   if(state.likeOperations.get(id)?.desired)state.likedPostIds.add(id);else state.likedPostIds.delete(id);
  }
  return;
 }
 state.likedPostIds=new Set((data||[]).map(like=>like.post_id));
 for(const [id,count] of pendingCounts){
  if(count!==undefined)state.likeCounts.set(id,count);
  const operation=state.likeOperations.get(id);
  if(operation?.desired)state.likedPostIds.add(id);else state.likedPostIds.delete(id);
 }
};
const postCard = (post) => {
 const p=post.profiles||state.profile, own=post.author_id===state.user.id;
 const liked=state.likedPostIds.has(post.id);
 const likeCount=state.likeCounts.get(post.id)??post.like_count??0;
 const tags=(post.tags||[]).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join("");
 return `<article class="post-card" data-open-post="${post.id}">
  <div class="post-meta">${avatarMarkup(p,"avatar")}<span class="post-author" data-open-profile="${p.id}">${escapeHtml(p.preferred_name||p.username)}</span><span>·</span><span>${dateLabel(post.created_at)}</span>${own&&post.status==="draft"?'<span class="tag">Draft</span>':""}</div>
  <h2>${escapeHtml(post.title)}</h2><p class="description">${escapeHtml(post.description||"")}</p>
  <div class="post-tags">${tags}</div>
  <div class="post-actions"><button class="post-action ${liked?"liked":""}" data-like="${post.id}" aria-pressed="${liked}" aria-label="${liked?"Unlike":"Like"} writing"><img class="icon" src="Icons/Likes.svg" alt="" aria-hidden="true"><span data-like-count>${likeCount}</span> likes</button><button class="post-action" data-open-post="${post.id}">Read writing</button>${own?`<button class="post-action" data-edit="${post.id}">Edit</button><button class="post-action" data-delete="${post.id}">Delete</button>`:""}</div>
 </article>`;
};
const renderFeed = async () => {
 const el=$("feedList"),cachedPosts=state.feedCacheUserId===state.user.id?state.feedPosts:[];
 const blankPage=emptyState("A blank page.","There aren’t any published stories here yet. When someone shares their words, they’ll find a home on this page.",true);
 el.innerHTML=cachedPosts.length?cachedPosts.map(postCard).join(""):blankPage;
 try{
  const posts=await fetchPosts();state.feedPosts=posts;state.feedCacheUserId=state.user.id;
  el.innerHTML=posts.length?posts.map(postCard).join(""):blankPage;
  await loadLikeState(posts);
  el.innerHTML=posts.length?posts.map(postCard).join(""):blankPage;
 }catch(error){
  if(cachedPosts.length)toast("Could not refresh the feed: "+error.message);
  else el.innerHTML=emptyState("The page didn’t load.",escapeHtml(error.message));
 }
};
const renderDrafts = async () => {
 const el=$("draftList");el.innerHTML='<p class="muted">Finding your drafts…</p>';
 try{const posts=(await fetchPosts(true)).filter(p=>p.status==="draft");await loadLikeState(posts);el.innerHTML=posts.length?posts.map(postCard).join(""):emptyState("Nothing unfinished.","Your drafts will stay private here until you’re ready to publish.",true);}
 catch(e){el.innerHTML=emptyState("Couldn’t load drafts.",escapeHtml(e.message));}
};
const renderExplore = async () => {
 const list=$("exploreList"), cloud=$("tagCloud"); list.innerHTML='<p class="muted">Looking around…</p>';
 try{
  const posts=await fetchPosts(); await loadLikeState(posts); const allTags=[...new Set(posts.flatMap(p=>p.tags||[]))].sort();
  cloud.innerHTML=allTags.length?allTags.map(t=>`<button data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join(""):"<span class='muted'>Tags will appear as people publish.</span>";
  const query=state.search.toLowerCase().trim();
  const filtered=posts.filter(p=>!query||[p.title,p.description,p.profiles?.preferred_name,p.profiles?.username,...(p.tags||[])].join(" ").toLowerCase().includes(query));
  list.innerHTML=filtered.length?filtered.map(postCard).join(""):emptyState("No matching writing yet.","Try another word or tag, or be the first to write about it.",true);
 }catch(e){list.innerHTML=emptyState("Explore is unavailable.",escapeHtml(e.message));}
};
const updateEditorLineCount = () => {
 const counter=$("editorLineCount");
 if(!counter)return;
 counter.classList.toggle("hidden",!state.showLineCount);
 if(!state.showLineCount)return;
 const lines=richHtmlToText($("postBody").innerHTML).split(/\r\n?|\n/).filter(line=>line.trim()).length;
 counter.textContent=`${lines} ${lines===1?"line":"lines"}`;
};
const editorBackupKey = (postId) => `margin-editor:${state.user.id}:${postId||"new"}`;
const readEditorValues = () => ({title:$("postTitle").value,description:$("postDescription").value,body:sanitizeRichHtml($("postBody").innerHTML),tags:$("postTags").value});
const writeEditorRecovery = (values) => {
 try{
  const hasContent=!!(values.title.trim()||values.description.trim()||richHtmlToText(values.body).trim()||values.tags.trim());
  if(!hasContent&&!state.editingPost&&!state.autosaveDraftId){localStorage.removeItem(state.editorRecoveryKey);return true;}
  localStorage.setItem(state.editorRecoveryKey,JSON.stringify({...values,savedAt:Date.now()}));
  state.editorStorageFailureNotified=false;
  return true;
 }catch(error){
  if(!state.editorStorageFailureNotified){toast("Could not save an on-device writing backup: "+error.message);state.editorStorageFailureNotified=true;}
  return false;
 }
};
const clearEditorRecovery = () => {
 try{if(state.editorRecoveryKey)localStorage.removeItem(state.editorRecoveryKey);}
 catch(error){toast("Could not clear the on-device writing backup: "+error.message);}
};
const persistEditorAutosave = async () => {
 if(!state.autoSaveEnabled||!state.editorInitialized||state.editorAutosavedVersion===state.editorVersion)return;
 if(state.editorAutosavePromise){state.editorAutosavePending=true;return state.editorAutosavePromise;}
 state.editorAutosavePromise=(async()=>{
  do{
   state.editorAutosavePending=false;
   const version=state.editorVersion,values=readEditorValues();
   writeEditorRecovery(values);
   const hasContent=values.title.trim()||values.description.trim()||richHtmlToText(values.body).trim()||values.tags.trim();
   const shouldSave=!!(hasContent||state.editingPost||state.autosaveDraftId);
   if(state.autoSaveEnabled&&shouldSave){
    const publishedRevision=state.editingPostStatus==="published"&&!!state.editingPost;
    const payload={title:values.title.trim()||"Untitled writing",description:values.description.trim(),body:values.body,tags:[...new Set(values.tags.split(",").map(tag=>tag.trim().replace(/^#/,"").slice(0,30)).filter(Boolean))].slice(0,8),status:"draft",author_id:state.user.id,updated_at:new Date().toISOString()};
    if(publishedRevision)payload.revision_of=state.editingPost;
    const draftId=publishedRevision?state.autosaveDraftId:state.editingPost;
    try{
     const result=draftId
      ?await supabase.from("posts").update(payload).eq("id",draftId).eq("author_id",state.user.id).select("id").single()
      :await supabase.from("posts").insert(payload).select("id").single();
     if(result.error)throw result.error;
     if(publishedRevision&&!state.autosaveDraftId)state.autosaveDraftId=result.data.id;
     else if(!publishedRevision&&!state.editingPost){
      const previousKey=state.editorRecoveryKey;
      state.editingPost=result.data.id;state.editingPostStatus="draft";state.editorRecoveryKey=editorBackupKey(result.data.id);
      try{const backup=localStorage.getItem(previousKey);if(backup)localStorage.setItem(state.editorRecoveryKey,backup);localStorage.removeItem(previousKey);}
      catch(error){toast("Draft saved, but its on-device backup could not be moved: "+error.message);}
     }
     if(state.autoSaveNotificationsEnabled)toast("Autosaved! Check Drafts");
    }catch(error){toast("Could not sync your autosaved draft: "+error.message);}
   }
   if(version!==state.editorVersion)state.editorAutosavePending=true;
   else{
    state.editorAutosavedVersion=version;
    $("saveStatus").textContent=state.autoSaveEnabled?"AutoSave Active":"AutoSave Off";
   }
  }while(state.editorAutosavePending);
 })().catch(error=>{state.editorAutosavePending=false;$("saveStatus").textContent=state.autoSaveEnabled?"AutoSave Active":"AutoSave Off";toast("Could not autosave your writing: "+error.message);}).finally(()=>{state.editorAutosavePromise=null;});
 return state.editorAutosavePromise;
};
const queueEditorAutosave = () => {
 if(!state.editorInitialized)return;
 if(!state.autoSaveEnabled){$("saveStatus").textContent="AutoSave Off";return;}
 state.editorVersion++;
 writeEditorRecovery(readEditorValues());
 $("saveStatus").textContent="AutoSave Active";
 clearTimeout(state.editorAutosaveTimer);
 state.editorAutosaveTimer=setTimeout(()=>{state.editorAutosaveTimer=null;persistEditorAutosave();},750);
};
const prepareEditor = async (post=null) => {
 clearTimeout(state.editorAutosaveTimer);state.editorAutosaveTimer=null;
 if(state.editorInitialized)await persistEditorAutosave();
 state.editorInitialized=false;state.editorAutosavePending=false;state.editorAutosavedVersion=0;state.editorVersion=0;
 state.editingPost=post;state.editingPostStatus=post?null:"draft";state.autosaveDraftId=null;state.editorRecoveryKey=editorBackupKey(post);
 $("postForm").reset();
 $("postBody").innerHTML="";
 let postData=null;
 if(post){
  const {data,error}=await supabase.from("posts").select("*").eq("id",post).eq("author_id",state.user.id).single();
  if(error){toast(error.message);return;}
  postData=data;
  if(data.revision_of){
   const {data:source,error:sourceError}=await supabase.from("posts").select("id,status").eq("id",data.revision_of).eq("author_id",state.user.id).maybeSingle();
   if(sourceError)toast("Could not check the original writing: "+sourceError.message);
   if(source){state.editingPost=source.id;state.editingPostStatus=source.status;state.autosaveDraftId=data.id;state.editorRecoveryKey=editorBackupKey(source.id);}
   else{state.editingPost=data.id;state.editingPostStatus=data.status;}
  }else if(data.status==="published"){
   const {data:revision,error:revisionError}=await supabase.from("posts").select("*").eq("author_id",state.user.id).eq("revision_of",data.id).eq("status","draft").order("updated_at",{ascending:false}).limit(1).maybeSingle();
   if(revisionError)toast("Could not check autosaved revisions: "+revisionError.message);
   else if(revision){postData=revision;state.autosaveDraftId=revision.id;}
   state.editingPost=data.id;state.editingPostStatus=data.status;
  }else{state.editingPost=data.id;state.editingPostStatus=data.status;}
  $("postTitle").value=postData.title;$("postDescription").value=postData.description||"";$("postBody").innerHTML=storedBodyHtml(postData.body);$("postTags").value=(postData.tags||[]).join(", ");
 }
 let restored=false;
 try{
  const stored=localStorage.getItem(state.editorRecoveryKey);
  if(stored){
   const backup=JSON.parse(stored),savedAt=Number(backup.savedAt)||0;
   if(!postData||savedAt>Date.parse(postData.updated_at||"")){
    $("postTitle").value=backup.title||"";$("postDescription").value=backup.description||"";$("postBody").innerHTML=sanitizeRichHtml(backup.body||"");$("postTags").value=backup.tags||"";restored=true;
   }else localStorage.removeItem(state.editorRecoveryKey);
  }
 }catch(error){toast("Could not restore the on-device writing backup: "+error.message);}
 state.editorInitialized=true;state.editorAutosavedVersion=state.editorVersion;
 updateEditorLineCount();
 $("saveStatus").textContent=state.autoSaveEnabled?"AutoSave Active":"AutoSave Off";
 if(restored)queueEditorAutosave();
};
const renderEditorPreview = () => {
 const profile=state.profile||{},title=$("postTitle").value.trim(),description=$("postDescription").value.trim(),body=sanitizeRichHtml($("postBody").innerHTML);
 const tags=[...new Set($("postTags").value.split(",").map(tag=>tag.trim().replace(/^#/,"")).filter(Boolean))];
 $("previewContent").innerHTML=`<div class="post-meta">${avatarMarkup(profile,"avatar")}<span class="post-author">${escapeHtml(profile.preferred_name||profile.username||"Your writing")}</span><span>·</span><span>Preview</span></div><h1 class="reader-title">${escapeHtml(title||"Untitled writing")}</h1>${description?`<p class="reader-description">${escapeHtml(description)}</p>`:""}${tags.length?`<div class="post-tags">${tags.map(tag=>`<span class="tag">#${escapeHtml(tag)}</span>`).join("")}</div>`:""}<div class="reader-body">${richHtmlToText(body)?storedBodyHtml(body):'<p class="muted">Your writing will appear here as you type.</p>'}</div>`;
 $("previewModal").classList.remove("hidden");
};
const savePost = async (status) => {
 clearTimeout(state.editorAutosaveTimer);state.editorAutosaveTimer=null;
 await persistEditorAutosave();
 const title=$("postTitle").value.trim(), body=sanitizeRichHtml($("postBody").innerHTML);
 if(!title||!body){toast("Add a title and some writing first.");return;}
 if(!richHtmlToText(body)){toast("Add a title and some writing first.");return;}
 const tags=[...new Set($("postTags").value.split(",").map(t=>t.trim().replace(/^#/,"").slice(0,30)).filter(Boolean))].slice(0,8);
 const payload={title,description:$("postDescription").value.trim(),body,tags,status,author_id:state.user.id,updated_at:new Date().toISOString()};
 let result,revisionCleanupError=null;
 const editingPublished=state.editingPostStatus==="published"&&!!state.editingPost;
 if(editingPublished&&status==="draft"){
  payload.revision_of=state.editingPost;
  result=state.autosaveDraftId
   ?await supabase.from("posts").update(payload).eq("id",state.autosaveDraftId).eq("author_id",state.user.id)
   :await supabase.from("posts").insert(payload);
 }else if(editingPublished&&status==="published"){
  result=await supabase.from("posts").update(payload).eq("id",state.editingPost).eq("author_id",state.user.id);
  if(!result.error&&state.autosaveDraftId){
   const {error}=await supabase.from("posts").delete().eq("id",state.autosaveDraftId).eq("author_id",state.user.id);
   revisionCleanupError=error;
  }
 }else if(state.editingPost)result=await supabase.from("posts").update(payload).eq("id",state.editingPost).eq("author_id",state.user.id);
 else result=await supabase.from("posts").insert(payload);
 if(result.error)throw result.error;
 toast(revisionCleanupError?"Your writing is published, but its draft copy remains in Drafts: "+revisionCleanupError.message:status==="published"?"Your writing is published.":"Draft saved.");
 clearEditorRecovery();state.editorInitialized=false;state.editingPost=null;state.editingPostStatus=null;state.autosaveDraftId=null;await navigate(status==="draft"?"drafts":"feed");
};
const updateLikeUi = (postId,liked,count) => {
 const safeCount=Math.max(0,Number(count)||0);
 state.likeCounts.set(postId,safeCount);
 if(liked)state.likedPostIds.add(postId);else state.likedPostIds.delete(postId);
 state.feedPosts.forEach(post=>{if(post.id===postId)post.like_count=safeCount;});
 if(state.readerPost?.id===postId)state.readerPost.like_count=safeCount;
 document.querySelectorAll("[data-like]").forEach(button=>{
  if(button.dataset.like!==postId)return;
  button.classList.toggle("liked",liked);
  button.setAttribute("aria-pressed",String(liked));
  button.setAttribute("aria-label",`${liked?"Unlike":"Like"} writing`);
  button.innerHTML=`<img class="icon" src="Icons/Likes.svg" alt="" aria-hidden="true"><span data-like-count>${safeCount}</span> likes`;
 });
};
const renderCommentList = () => {
 const list=$("commentList");
 if(!list)return;
 list.innerHTML=state.readerComments.map(comment=>{
  const own=comment.user_id===state.user.id;
  if(own&&state.editingCommentId===comment.id)return `<form class="comment-edit-form" data-comment-edit-form="${comment.id}"><textarea maxlength="1000" required aria-label="Edit your thought">${escapeHtml(comment.body)}</textarea><div class="comment-actions"><button type="submit">Save</button><button type="button" data-comment-cancel>Cancel</button></div></form>`;
  return `<div class="comment-item" data-comment-id="${comment.id}"><div class="comment-copy"><strong>${escapeHtml(comment.profiles?.preferred_name||comment.profiles?.username||"Writer")}</strong>${escapeHtml(comment.body)}</div>${own?`<div class="comment-actions"><button type="button" data-comment-edit="${comment.id}">Edit</button><button type="button" data-comment-delete="${comment.id}">Delete</button></div>`:""}</div>`;
 }).join("")||'<p class="muted">No comments yet. Start the conversation.</p>';
 list.querySelectorAll("[data-comment-edit-form]").forEach(form=>form.addEventListener("submit",async event=>{
  event.preventDefault();
  const id=form.dataset.commentEditForm, body=form.querySelector("textarea").value.trim();
  if(!body)return;
  const postId=state.readerPost?.id, request=state.readerRequest;
  state.readerComments=state.readerComments.map(comment=>comment.id===id?{...comment,body}:comment);
  state.editingCommentId=null;renderCommentList();
  const {error}=await supabase.from("comments").update({body}).eq("id",id).eq("user_id",state.user.id);
  if(error){toast("Could not update your thought: "+error.message);if(postId)loadReaderDetails(postId,request);}
  else toast("Thought updated.");
 }));
};
const renderReader = (post) => {
 state.readerPost=post;state.readerComments=[];state.editingCommentId=null;
 const p=post.profiles||state.profile, liked=state.likedPostIds.has(post.id);
 const likeCount=state.likeCounts.get(post.id)??post.like_count??0;
 $("readerContent").innerHTML=`<div class="post-meta">${avatarMarkup(p,"avatar")}<span class="post-author" data-open-profile="${p.id}">${escapeHtml(p.preferred_name||p.username)}</span><span>·</span><span>${dateLabel(post.created_at)}</span></div>
 <h1 class="reader-title">${escapeHtml(post.title)}</h1><p class="reader-description">${escapeHtml(post.description||"")}</p><div class="post-tags">${(post.tags||[]).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>
 <div class="reader-body">${storedBodyHtml(post.body)}</div><div class="reader-actions"><button class="post-action ${liked?"liked":""}" data-like="${post.id}" aria-pressed="${liked}" aria-label="${liked?"Unlike":"Like"} writing"><img class="icon" src="Icons/Likes.svg" alt="" aria-hidden="true"><span data-like-count>${likeCount}</span> likes</button>${post.author_id!==state.user.id?'<button class="post-action reader-copy" data-copy-reading>Copy writing</button>':""}${post.author_id===state.user.id?`<button class="post-action" data-edit="${post.id}">Edit writing</button><button class="post-action" data-delete="${post.id}">Delete writing</button>`:""}</div>
 <section class="comments"><h3>Leave a thought</h3><form class="comment-form" id="commentForm"><input id="commentInput" maxlength="1000" placeholder="Add to the conversation…" required aria-label="Write a thought"><button class="secondary-button">Post</button></form><div id="commentList"><p class="muted">Loading comments…</p></div></section>`;
 $("commentForm").addEventListener("submit",async e=>{e.preventDefault();const body=$("commentInput").value.trim();if(!body)return;const {error}=await supabase.from("comments").insert({post_id:post.id,user_id:state.user.id,body});if(error){toast(error.message);return;}$("commentInput").value="";loadReaderDetails(post.id,state.readerRequest);});
};
const loadReaderDetails = async (id, request) => {
 const [commentsResult,likeResult]=await Promise.all([
  supabase.from("comments").select("*,profiles(preferred_name,username,username_tag)").eq("post_id",id).order("created_at"),
  supabase.from("likes").select("id").eq("post_id",id).eq("user_id",state.user.id).maybeSingle()
 ]);
 if(request!==state.readerRequest||state.readerPost?.id!==id)return;
 if(commentsResult.error){toast(commentsResult.error.message);$("commentList").innerHTML='<p class="muted">Could not load thoughts.</p>';}
 else{state.readerComments=commentsResult.data||[];renderCommentList();}
 if(likeResult.error)toast(likeResult.error.message);
 else if(!state.likeOperations.has(id))updateLikeUi(id,!!likeResult.data,state.likeCounts.get(id)??state.readerPost.like_count??0);
};
const openReader = async (id) => {
 const request=++state.readerRequest;
 let post=state.feedPosts.find(item=>item.id===id);
 $("readerModal").classList.remove("hidden");
 if(post)renderReader(post);
 else $("readerContent").innerHTML='<p class="muted">Opening writing…</p>';
 if(!post){
  const {data,error}=await supabase.from("posts").select("*,profiles(id,preferred_name,username,username_tag,avatar_url)").eq("id",id).single();
  if(request!==state.readerRequest)return;
  if(error){toast(error.message);return;}
  post=data;renderReader(post);
 }
 loadReaderDetails(id,request);
};
const toggleLike = async (postId) => {
 const operation=state.likeOperations.get(postId);
 if(operation){
  operation.desired=!operation.desired;
  const count=state.likeCounts.get(postId)||0;
  updateLikeUi(postId,operation.desired,count+(operation.desired?1:-1));
  return;
 }
 const userId=state.user.id;
 const initialLiked=state.likedPostIds.has(postId);
 const initialCount=state.likeCounts.get(postId)??state.feedPosts.find(post=>post.id===postId)?.like_count??state.readerPost?.like_count??0;
 const nextLiked=!initialLiked;
 const pending={desired:nextLiked,persisted:initialLiked,initialLiked,initialCount};
 state.likeOperations.set(postId,pending);
 updateLikeUi(postId,nextLiked,initialCount+(nextLiked?1:-1));
 try{
  while(pending.persisted!==pending.desired){
   const desired=pending.desired;
   const result=desired
    ?await supabase.from("likes").upsert({post_id:postId,user_id:userId},{onConflict:"post_id,user_id",ignoreDuplicates:true})
    :await supabase.from("likes").delete().eq("post_id",postId).eq("user_id",userId);
   if(result.error)throw result.error;
   pending.persisted=desired;
  }
 }catch(error){
  try{
   const [likeResult,postResult]=await Promise.all([
    supabase.from("likes").select("id").eq("post_id",postId).eq("user_id",userId).maybeSingle(),
    supabase.from("posts").select("like_count").eq("id",postId).maybeSingle()
   ]);
   if(likeResult.error||postResult.error||!postResult.data)throw likeResult.error||postResult.error||new Error("The updated like could not be verified.");
   updateLikeUi(postId,!!likeResult.data,postResult.data.like_count);
  }catch(reconcileError){
   updateLikeUi(postId,pending.initialLiked,pending.initialCount);
   toast(`Could not update like: ${error.message}. Could not verify its saved state: ${reconcileError.message}`);
   return;
  }
  toast("Could not update like: "+error.message);
 }finally{
  if(state.likeOperations.get(postId)===pending)state.likeOperations.delete(postId);
 }
};
const renderProfile = async (id) => {
 const own=id===state.user.id;
 const cached=own?state.profile:state.profileCache.get(id);
 const cachedPosts=state.feedPosts.filter(post=>post.author_id===id);
 if(cached)$("profileContent").innerHTML=`<div class="profile-cover"></div><div class="profile-header">${avatarMarkup(cached,"avatar")}<div class="profile-title"><h2>${escapeHtml(cached.preferred_name||cached.username)}</h2><p>@${escapeHtml(handle(cached))}</p></div>${own?'<button class="secondary-button" data-nav="settings">Edit profile</button>':""}</div><p class="profile-bio">${escapeHtml(cached.bio||"A Margin writer. Still finding the words.")}</p><div class="profile-stats"><span><strong>…</strong> writings</span><span><strong>…</strong> followers</span><span><strong>…</strong> following</span></div><div class="profile-tabs">PUBLISHED WRITING</div><div class="post-list">${cachedPosts.length?cachedPosts.map(postCard).join(""):'<p class="muted">Loading writings…</p>'}</div>`;
 else $("profileContent").innerHTML='<p class="muted">Loading profile…</p>';
 const [profileResult,postsResult,likesResult,followersResult,followingResult,followResult]=await Promise.all([
  supabase.from("profiles").select("*").eq("id",id).single(),
  supabase.from("posts").select("*").eq("author_id",id).eq("status","published").order("created_at",{ascending:false}),
  supabase.from("likes").select("post_id").eq("user_id",state.user.id),
  supabase.from("follows").select("*",{count:"exact",head:true}).eq("following_id",id),
  supabase.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",id),
  supabase.from("follows").select("id").eq("follower_id",state.user.id).eq("following_id",id).maybeSingle()
 ]);
 const {data:p,error}=profileResult;
 if(error){$("profileContent").innerHTML=emptyState("Profile unavailable.",escapeHtml(error.message));return;}
 state.profileCache.set(id,p);
 const posts=postsResult.data||[];
 if(postsResult.error)toast("Could not load writings: "+postsResult.error.message);
 posts.forEach(post=>{post.profiles=p;state.profileCache.set(p.id,p);});
 await loadLikeState(posts,likesResult);
 const followers=followersResult.count,following=followingResult.count,follow=followResult.data;
 const activityError=followersResult.error||followingResult.error||followResult.error;
 if(activityError)toast("Could not load profile activity: "+activityError.message);
 $("profileContent").innerHTML=`<div class="profile-cover"></div><div class="profile-header">${avatarMarkup(p,"avatar")}<div class="profile-title"><h2>${escapeHtml(p.preferred_name||p.username)}</h2><p>@${escapeHtml(handle(p))}</p></div>${own?'<button class="secondary-button" data-nav="settings">Edit profile</button>':`<button class="follow-button ${follow?"following":""}" data-follow="${id}">${follow?"Following":"Follow"}</button>`}</div><p class="profile-bio">${escapeHtml(p.bio||"A Margin writer. Still finding the words.")}</p><div class="profile-stats"><span><strong>${posts?.length||0}</strong> writings</span><span><strong>${followers||0}</strong> followers</span><span><strong>${following||0}</strong> following</span></div><div class="profile-tabs">PUBLISHED WRITING</div><div class="post-list">${posts?.length?posts.map(postCard).join(""):emptyState("A quiet page.","Published writing will appear here when this writer shares it.",own)}</div>`;
};
const writeClipboard = async (text,html="") => {
 const clipboard=navigator.clipboard;
 if(!clipboard)throw new Error("Clipboard access is unavailable in this browser or page context.");
 if(html&&clipboard.write&&typeof ClipboardItem!=="undefined"){
  try{
   const item=new ClipboardItem({
    "text/html":new Blob([html],{type:"text/html"}),
    "text/plain":new Blob([text],{type:"text/plain"})
   });
   await clipboard.write([item]);
   return;
  }catch(error){
   if(!clipboard.writeText)throw error;
   await clipboard.writeText(text);
   return;
  }
 }
 if(!clipboard.writeText)throw new Error("Clipboard writing is not supported by this browser.");
 await clipboard.writeText(text);
};
const copyEditorSelection = async () => {
 const editor=$("postBody"), selection=window.getSelection();
 let text=editor.innerText,html=sanitizeRichHtml(editor.innerHTML);
 if(selection&&!selection.isCollapsed&&editor.contains(selection.anchorNode)&&editor.contains(selection.focusNode)){
  text=selection.toString();
  const fragment=selection.getRangeAt(0).cloneContents(),container=document.createElement("div");
  container.appendChild(fragment);html=sanitizeRichHtml(container.innerHTML);
 }
 await writeClipboard(text,html);
 toast("Copied to clipboard.");
};
const insertEditorHtml = (html) => {
 const editor=$("postBody"), selection=window.getSelection();
 editor.focus();
 const range=selection&&selection.rangeCount?selection.getRangeAt(0):document.createRange();
 if(!selection||!selection.rangeCount||!editor.contains(range.commonAncestorContainer)){
  range.selectNodeContents(editor);range.collapse(false);
  if(selection){selection.removeAllRanges();selection.addRange(range);}
 }
 const safeHtml=sanitizeRichHtml(html);
 if(!safeHtml)return;
 if(typeof document.execCommand==="function"&&document.execCommand("insertHTML",false,safeHtml)){
  editor.dispatchEvent(new Event("input",{bubbles:true}));
  return;
 }
 const template=document.createElement("template");
 template.innerHTML=safeHtml;
 const fragment=template.content, last=fragment.lastChild;
 if(!last)return;
 range.deleteContents();
 range.insertNode(fragment);
 range.setStartAfter(last);range.collapse(true);
 const updatedSelection=window.getSelection();
 if(updatedSelection){updatedSelection.removeAllRanges();updatedSelection.addRange(range);}
 editor.dispatchEvent(new Event("input",{bubbles:true}));
};
const pasteFromClipboard = async () => {
 const clipboard=navigator.clipboard;
 if(!clipboard)throw new Error("Clipboard access is unavailable in this browser or page context.");
 let html="",text="";
 if(clipboard.read&&typeof ClipboardItem!=="undefined"){
  try{
   const items=await clipboard.read();
   for(const item of items){
    if(item.types.includes("text/html"))html=await (await item.getType("text/html")).text();
    if(item.types.includes("text/plain"))text=await (await item.getType("text/plain")).text();
    if(html||text)break;
   }
  }catch(readError){
   if(!clipboard.readText)throw new Error("Could not read the clipboard: "+readError.message);
  }
 }
 if(!html&&!text){
  if(!clipboard.readText)throw new Error("Clipboard reading is not supported by this browser.");
  text=await clipboard.readText();
 }
 const safeHtml=html&&sanitizeRichHtml(html);
 if(!safeHtml&&!text){toast("The clipboard contains no usable text.");return;}
 insertEditorHtml(safeHtml||plainTextToRichHtml(text));
 toast("Pasted at the cursor.");
};
const copyReaderWriting = async () => {
 const body=$("readerContent").querySelector(".reader-body");
 if(!body)throw new Error("The writing is not available to copy.");
 const html=sanitizeRichHtml(body.innerHTML);
 await writeClipboard(richHtmlToText(html),html);
 toast("Writing copied.");
};
const fillSettings = () => {
 const p=state.profile;$("settingsName").value=p.preferred_name||"";$("settingsUsername").value=p.username||"";$("settingsBio").value=p.bio||"";
 $("settingsAvatarPreview").innerHTML=p.avatar_url?`<img src="${escapeHtml(p.avatar_url)}" alt="">`:escapeHtml(initials(p.preferred_name||p.username));
 $("darkModeToggle").checked=document.documentElement.dataset.theme==="dark";$("lineCountToggle").checked=state.showLineCount;$("autoSaveToggle").checked=state.autoSaveEnabled;$("autoSaveNotificationsToggle").checked=state.autoSaveNotificationsEnabled;
};
const updateProfileAvatarPreview = (file, target) => {if(!file)return;const url=URL.createObjectURL(file);$(target).innerHTML=`<img src="${url}" alt="Selected profile picture">`;};
const logout = async () => {const {error}=await supabase.auth.signOut();if(error){toast(error.message);return;}state.user=null;state.profile=null;showAuth("login");};
const init = async () => {
 setTimeout(()=>$("welcome").classList.add("hidden"),3000);
 try{state.showLineCount=localStorage.getItem("margin-show-line-count")!=="false";}catch(error){toast("Could not read the line count preference: "+error.message);}
 try{state.autoSaveEnabled=localStorage.getItem("margin-autosave-enabled")!=="false";}catch(error){toast("Could not read the AutoSave preference: "+error.message);}
 try{state.autoSaveNotificationsEnabled=localStorage.getItem("margin-autosave-notifications-enabled")==="true";}catch(error){toast("Could not read the AutoSave notification preference: "+error.message);}
 updateEditorLineCount();
 $("signupAvatar").addEventListener("change",e=>{state.avatarFile=e.target.files[0]||null;updateProfileAvatarPreview(state.avatarFile,"signupAvatarPreview");});
 $("settingsAvatar").addEventListener("change",e=>{state.avatarFile=e.target.files[0]||null;state.removeAvatar=false;updateProfileAvatarPreview(state.avatarFile,"settingsAvatarPreview");});
 document.querySelectorAll("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>switchAuth(b.dataset.authTab)));
 $("forgotPassword").addEventListener("click",()=>switchAuth("reset"));
 document.querySelectorAll(".back-login").forEach(b=>b.addEventListener("click",()=>switchAuth("login")));
 $("signupForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=e.submitter;setBusy(btn,true);
  try{
   const username=$("signupUsername").value.trim().replace(/^@/,"");
   if(!/^[A-Za-z0-9_]{1,24}$/.test(username))throw new Error("Use 1–24 letters, numbers, or underscores for your username.");
   const {data,error}=await supabase.auth.signUp({email:$("signupEmail").value.trim(),password:$("signupPassword").value,options:{data:{preferred_name:$("signupName").value.trim(),username}}});
   if(error)throw error;
   if(!data.session){setMessage("Account created. If email confirmation is enabled in Supabase, turn it off to use Margin without confirmation.",false);return;}
   state.user=data.user;await loadProfile();
   if(state.avatarFile){const url=await uploadAvatar(state.avatarFile);const {error:upErr}=await supabase.from("profiles").update({avatar_url:url}).eq("id",state.user.id);if(upErr)throw upErr;await loadProfile();}
   await enterApp(data.user);
  }catch(err){setMessage(err.message,true);}finally{setBusy(btn,false);}
 });
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();const btn=e.submitter;setBusy(btn,true);try{const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)throw error;await enterApp(data.user);}catch(err){setMessage(err.message,true);}finally{setBusy(btn,false);}});
 $("resetForm").addEventListener("submit",async e=>{e.preventDefault();try{const {error}=await supabase.auth.resetPasswordForEmail($("resetEmail").value.trim(),{redirectTo:window.location.origin});if(error)throw error;setMessage("Password reset link sent. Check your email.");}catch(err){setMessage(err.message,true);}});
 $("newPasswordForm").addEventListener("submit",async e=>{e.preventDefault();try{const {error}=await supabase.auth.updateUser({password:$("newPassword").value});if(error)throw error;setMessage("Password updated. You can continue using Margin.");await enterApp(state.user);}catch(err){setMessage(err.message,true);}});
 $("postForm").addEventListener("submit",async e=>{e.preventDefault();try{await savePost("published");}catch(err){toast(err.message);}});
 $("saveDraftButton").addEventListener("click",async()=>{try{await savePost("draft");}catch(err){toast(err.message);}});
 $("previewButton").addEventListener("click",renderEditorPreview);
 ["postTitle","postDescription","postTags"].forEach(id=>$(id).addEventListener("input",queueEditorAutosave));
 $("searchInput").addEventListener("input",e=>{state.search=e.target.value;renderExplore();});
 $("editorToolbar").addEventListener("mousedown",e=>{if(e.target.closest("button"))e.preventDefault();});
 $("editorToolbar").addEventListener("click",async e=>{
  const button=e.target.closest("[data-editor-command],[data-editor-copy],[data-editor-paste]");
  if(!button)return;
  if(button.hasAttribute("data-editor-copy")){try{await copyEditorSelection();}catch(err){toast("Could not copy: "+err.message);}return;}
  if(button.hasAttribute("data-editor-paste")){try{await pasteFromClipboard();}catch(err){toast("Could not paste: "+err.message);}return;}
  const command=button.dataset.editorCommand;
  let value=button.dataset.commandValue||null;
  if(command==="createLink"){
   const entered=prompt("Enter a link URL");
   if(entered===null)return;
   value=safeLink(entered.trim());
   if(!value){toast("Enter a valid http, https, or mailto link.");return;}
  }
  if(command==="formatBlock")value=`<${value}>`;
  $("postBody").focus();
  if(typeof document.execCommand!=="function"||!document.execCommand(command,false,value))toast("This formatting option is not supported by your browser.");
  $("postBody").dispatchEvent(new Event("input",{bubbles:true}));
  syncEditorToolbar();
 });
 $("postBody").addEventListener("input",()=>{syncEditorToolbar();updateEditorLineCount();queueEditorAutosave();});
 document.addEventListener("selectionchange",syncEditorToolbar);
 $("postBody").addEventListener("paste",e=>{
  e.preventDefault();
  const html=e.clipboardData?.getData("text/html")||"";
  const text=e.clipboardData?.getData("text/plain")||"";
   const safeHtml=html&&sanitizeRichHtml(html);
   if(safeHtml||text)insertEditorHtml(safeHtml||plainTextToRichHtml(text));
 });
 $("settingsAvatar").addEventListener("change",()=>{});
 $("darkModeToggle").addEventListener("change",e=>{
  const theme=e.target.checked?"dark":"light";
  document.documentElement.dataset.theme=theme;
  try{localStorage.setItem("margin-theme",theme);toast(theme==="dark"?"Dark mode on.":"Dark mode off.");}
  catch(error){toast("Appearance changed but could not be saved: "+error.message);}
 });
 $("lineCountToggle").addEventListener("change",e=>{
  state.showLineCount=e.target.checked;updateEditorLineCount();
  try{localStorage.setItem("margin-show-line-count",String(state.showLineCount));toast(state.showLineCount?"Writing line count on.":"Writing line count off.");}
  catch(error){toast("Line count changed but could not be saved: "+error.message);}
 });
 $("autoSaveToggle").addEventListener("change",e=>{
  state.autoSaveEnabled=e.target.checked;
  clearTimeout(state.editorAutosaveTimer);state.editorAutosaveTimer=null;
  $("saveStatus").textContent=state.autoSaveEnabled?"AutoSave Active":"AutoSave Off";
  try{localStorage.setItem("margin-autosave-enabled",String(state.autoSaveEnabled));toast(state.autoSaveEnabled?"AutoSave turned on.":"AutoSave turned off.");}
  catch(error){toast("AutoSave changed but could not be saved: "+error.message);}
  if(state.autoSaveEnabled)queueEditorAutosave();
 });
 $("autoSaveNotificationsToggle").addEventListener("change",e=>{
  state.autoSaveNotificationsEnabled=e.target.checked;
  try{localStorage.setItem("margin-autosave-notifications-enabled",String(state.autoSaveNotificationsEnabled));toast(state.autoSaveNotificationsEnabled?"AutoSave notifications turned on.":"AutoSave notifications turned off.");}
  catch(error){toast("AutoSave notifications changed but could not be saved: "+error.message);}
 });
 $("removeAvatar").addEventListener("click",()=>{state.avatarFile=null;state.removeAvatar=true;$("settingsAvatar").value="";$("settingsAvatarPreview").textContent=initials(state.profile.preferred_name||state.profile.username);});
 $("settingsForm").addEventListener("submit",async e=>{
  e.preventDefault();try{
   const username=$("settingsUsername").value.trim().replace(/^@/,"");
   if(!/^[A-Za-z0-9_]{1,24}$/.test(username))throw new Error("Use 1–24 letters, numbers, or underscores for your username.");
   let avatar_url=state.profile.avatar_url;
   if(state.avatarFile)avatar_url=await uploadAvatar(state.avatarFile);
   if(state.removeAvatar)avatar_url=null;
   const {data,error}=await supabase.from("profiles").update({preferred_name:$("settingsName").value.trim(),username,bio:$("settingsBio").value.trim(),avatar_url}).eq("id",state.user.id).select().single();
   if(error)throw error;state.profile=data;state.profileCache.set(data.id,data);state.avatarFile=null;state.removeAvatar=false;updateChrome();fillSettings();toast("Your profile has been updated.");
  }catch(err){toast(err.message);}
 });
 $("changePasswordForm").addEventListener("submit",async e=>{e.preventDefault();const {error}=await supabase.auth.updateUser({password:$("changePassword").value});if(error)toast(error.message);else{$("changePassword").value="";toast("Password updated.");}});
 $("deleteAccountButton").addEventListener("click",async()=>{
  if(!confirm("Delete your Margin account and all associated writing and activity? This cannot be undone."))return;
  try{const {data:{session}}=await supabase.auth.getSession();const response=await fetch(`${SUPABASE_URL}/functions/v1/delete-account`,{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_PUBLISHABLE_KEY}});const result=await response.json();if(!response.ok)throw new Error(result.error||"Account deletion failed.");await supabase.auth.signOut();state.user=null;state.profile=null;showAuth("signup");toast("Your account has been deleted.");}
  catch(err){toast(err.message+" Make sure the delete-account Edge Function is deployed.");}
 });
 $("logoutButton").addEventListener("click",logout);
 $("sidebarProfile").addEventListener("click",()=>navigate("profile"));
 $("mobileProfile").addEventListener("click",()=>navigate("profile"));
 document.addEventListener("click",async e=>{
  const nav=e.target.closest("[data-nav]");if(nav){e.preventDefault();navigate(nav.dataset.nav);return;}
  const profile=e.target.closest("[data-open-profile]");if(profile){e.stopPropagation();navigate("profile",profile.dataset.openProfile);return;}
  const copyWriting=e.target.closest("[data-copy-reading]");if(copyWriting){e.stopPropagation();try{await copyReaderWriting();}catch(err){toast("Could not copy writing: "+err.message);}return;}
  const editComment=e.target.closest("[data-comment-edit]");if(editComment){const comment=state.readerComments.find(item=>item.id===editComment.dataset.commentEdit&&item.user_id===state.user.id);if(comment){state.editingCommentId=comment.id;renderCommentList();}return;}
  if(e.target.closest("[data-comment-cancel]")){state.editingCommentId=null;renderCommentList();return;}
  const deleteComment=e.target.closest("[data-comment-delete]");
  if(deleteComment){
   const id=deleteComment.dataset.commentDelete,comment=state.readerComments.find(item=>item.id===id&&item.user_id===state.user.id);
   if(!comment)return;
   if(!confirm("Delete this thought permanently?"))return;
   const postId=state.readerPost?.id,request=state.readerRequest;
   state.readerComments=state.readerComments.filter(item=>item.id!==id);renderCommentList();
   const {error}=await supabase.from("comments").delete().eq("id",id).eq("user_id",state.user.id);
   if(error){toast("Could not delete your thought: "+error.message);if(postId)loadReaderDetails(postId,request);}
   else toast("Thought deleted.");
   return;
  }
  const like=e.target.closest("[data-like]");if(like){e.stopPropagation();toggleLike(like.dataset.like);return;}
  const edit=e.target.closest("[data-edit]");if(edit){e.stopPropagation();$("readerModal").classList.add("hidden");navigate("write",edit.dataset.edit);return;}
  const del=e.target.closest("[data-delete]");if(del){e.stopPropagation();if(!confirm("Delete this writing permanently?"))return;const {error}=await supabase.from("posts").delete().eq("id",del.dataset.delete).eq("author_id",state.user.id);if(error)toast(error.message);else{$("readerModal").classList.add("hidden");toast("Writing deleted.");if(state.activePage==="drafts")renderDrafts();else if(state.activePage==="profile")renderProfile(state.user.id);else if(state.activePage==="explore")renderExplore();else renderFeed();}return;}
  const open=e.target.closest("[data-open-post]");if(open){openReader(open.dataset.openPost);return;}
  const follow=e.target.closest("[data-follow]");if(follow){const id=follow.dataset.follow;const {data:existing}=await supabase.from("follows").select("id").eq("follower_id",state.user.id).eq("following_id",id).maybeSingle();const res=existing?await supabase.from("follows").delete().eq("id",existing.id):await supabase.from("follows").insert({follower_id:state.user.id,following_id:id});if(res.error)toast(res.error.message);else renderProfile(id);return;}
  const tag=e.target.closest("[data-tag]");if(tag){state.search=tag.dataset.tag;$("searchInput").value=state.search;renderExplore();return;}
  if(e.target.closest("[data-close-preview]"))$("previewModal").classList.add("hidden");
  if(e.target.closest("[data-close-reader]"))$("readerModal").classList.add("hidden");
 });
 supabase.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY"){showAuth("newPassword");return;}
  if(session?.user&&!state.user){setTimeout(()=>enterApp(session.user),0);}
  if(!session&&state.user){state.user=null;state.profile=null;showAuth("login");}
 });
 const {data:{session}}=await supabase.auth.getSession();
 if(session?.user)await enterApp(session.user);else showAuth("signup");
};
init();
