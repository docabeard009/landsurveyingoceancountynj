/* ============================================================
   Lakeland Surveying — AI Site Concierge  (FOUND / precision lead-gen)
   Browser widget. Talks to /.netlify/functions/chat for AI answers.
   No API key here. No cookies/localStorage.
   Install: <script src="/assets/chat-widget.js" defer></script>
   ============================================================ */
(function () {
  "use strict";
  if (window.__lakelandChat) return;
  window.__lakelandChat = true;

  var BIZ = {
    name: "Lakeland Surveying",
    tel: "609.201.4717",
    telDisplay: "609.201.4717",
    sms: "+19174636042",
    smsDisplay: "917.463.6042",
    formspree: "https://formspree.io/f/xnjywovb",
    endpoint: "/.netlify/functions/chat"
  };

  var GREETING = "Hi — I'm Lakeland's assistant. I can help you figure out which survey you need, check if we cover your town, or start a quote. What's going on with your property?";
  var CHIPS = ["Do I need an elevation certificate?","What's a boundary survey?","Do you cover my town?","Get a quote"];

  var CSS = `
  .lk-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:inline-flex;align-items:center;gap:10px;cursor:pointer;background:#E2731B;color:#fff;border:none;border-radius:999px;padding:14px 20px 14px 16px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13px;letter-spacing:.04em;font-weight:500;box-shadow:0 18px 40px -18px rgba(196,95,18,.75);transition:transform .18s ease, box-shadow .18s ease}
  .lk-fab:hover{transform:translateY(-2px);box-shadow:0 24px 50px -20px rgba(196,95,18,.85)}
  .lk-fab svg{width:20px;height:20px;flex:0 0 auto}
  .lk-fab .lk-close-x{display:none}
  .lk-fab.is-open .lk-open-i{display:none}.lk-fab.is-open .lk-close-x{display:block}.lk-fab.is-open .lk-fab-label{display:none}
  .lk-panel{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:#FBFAF6;border:1px solid #d9e1e7;border-radius:16px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 30px 70px -30px rgba(7,26,44,.55);font-family:"IBM Plex Sans",system-ui,sans-serif;color:#0B2A45;opacity:0;transform:translateY(10px) scale(.98);transition:opacity .2s ease, transform .2s ease}
  .lk-panel.is-open{display:flex;opacity:1;transform:none}
  .lk-head{background:#071a2c;color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;flex:0 0 auto}
  .lk-head .lk-dot{width:9px;height:9px;border-radius:50%;background:#2f7d5b;box-shadow:0 0 0 4px rgba(47,125,91,.22)}
  .lk-head b{font-family:"Space Grotesk","Segoe UI",sans-serif;font-size:15px;font-weight:600;display:block;line-height:1.2}
  .lk-head span{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9fb3c0;display:block;margin-top:2px}
  .lk-log{flex:1 1 auto;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
  .lk-msg{max-width:88%;padding:11px 14px;border-radius:13px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .lk-bot{align-self:flex-start;background:#fff;border:1px solid #e3e9ee;border-bottom-left-radius:4px}
  .lk-user{align-self:flex-end;background:#2C7DA0;color:#fff;border-bottom-right-radius:4px}
  .lk-msg a.lk-inline{color:#2C7DA0;font-weight:600;border-bottom:1px solid rgba(44,125,160,.35)}
  .lk-typing{align-self:flex-start;background:#fff;border:1px solid #e3e9ee;border-radius:13px;border-bottom-left-radius:4px;padding:13px 15px;display:inline-flex;gap:4px}
  .lk-typing i{width:7px;height:7px;border-radius:50%;background:#9fb3c0;animation:lkb 1s infinite ease-in-out}
  .lk-typing i:nth-child(2){animation-delay:.15s}.lk-typing i:nth-child(3){animation-delay:.3s}
  @keyframes lkb{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
  .lk-chips{display:flex;flex-wrap:wrap;gap:7px;padding:0 16px 8px}
  .lk-chip{border:1px solid #cfdae2;background:#fff;color:#13395a;cursor:pointer;border-radius:999px;padding:7px 12px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.02em;transition:all .15s ease}
  .lk-chip:hover{border-color:#2C7DA0;background:#e8f1f6}
  .lk-cta{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}
  .lk-cta a{flex:1 1 auto;text-align:center;text-decoration:none;font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.03em;padding:9px 10px;border-radius:9px;white-space:nowrap}
  .lk-cta .lk-call{background:#E2731B;color:#fff}
  .lk-cta .lk-text{background:#0B2A45;color:#fff}
  .lk-cta .lk-quote{background:#C7972F;color:#071a2c;font-weight:600}
  .lk-form{background:#fff;border:1px solid #e3e9ee;border-radius:13px;padding:13px;display:grid;gap:8px}
  .lk-form label{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5b7184;margin-bottom:-4px}
  .lk-form input,.lk-form select,.lk-form textarea{width:100%;font-family:inherit;font-size:14px;padding:9px 10px;border:1px solid #cfdae2;border-radius:8px;color:#0B2A45;background:#fff}
  .lk-form textarea{resize:vertical;min-height:52px}
  .lk-form button{background:#E2731B;color:#fff;border:none;border-radius:8px;padding:11px;font-family:"IBM Plex Mono",monospace;font-size:12.5px;letter-spacing:.04em;cursor:pointer;font-weight:500}
  .lk-form button:hover{background:#c45f12}
  .lk-form .lk-err{color:#c0392b;font-size:12px;margin:0}
  .lk-foot{flex:0 0 auto;padding:9px 16px;border-top:1px solid #e6ebef;background:#fff;display:flex;gap:8px;align-items:center}
  .lk-foot input{flex:1;border:1px solid #cfdae2;border-radius:999px;padding:10px 14px;font-family:inherit;font-size:14px;color:#0B2A45}
  .lk-foot input:focus{outline:none;border-color:#2C7DA0}
  .lk-foot button{background:#0B2A45;color:#fff;border:none;border-radius:50%;width:38px;height:38px;flex:0 0 auto;cursor:pointer;display:grid;place-items:center}
  .lk-foot button:disabled{opacity:.45;cursor:default}
  .lk-foot button svg{width:17px;height:17px}
  .lk-log::-webkit-scrollbar{width:7px}.lk-log::-webkit-scrollbar-thumb{background:#cfdae2;border-radius:4px}
  @media (prefers-reduced-motion:reduce){.lk-fab,.lk-panel,.lk-typing i{transition:none;animation:none}}
  `;

  function el(h){var d=document.createElement("div");d.innerHTML=h.trim();return d.firstChild;}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

  var ctaBlock='<div class="lk-cta"><a class="lk-call" href="tel:'+BIZ.tel+'">Call '+BIZ.telDisplay+'</a><a class="lk-text" href="sms:'+BIZ.sms+'">Text us</a></div>';
  var quoteBtn='<div class="lk-cta"><a class="lk-quote" href="#" data-quote="1">Request a quote →</a></div>';

  var style=document.createElement("style");style.textContent=CSS;document.head.appendChild(style);

  var fab=el('<button class="lk-fab" aria-label="Open chat with Lakeland Surveying"><span class="lk-open-i" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span><span class="lk-close-x" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span><span class="lk-fab-label">Questions? Ask us</span></button>');
  var panel=el('<div class="lk-panel" role="dialog" aria-label="Lakeland Surveying chat"><div class="lk-head"><span class="lk-dot" aria-hidden="true"></span><div><b>'+BIZ.name+'</b><span>All of New Jersey · online</span></div></div><div class="lk-log" aria-live="polite"></div><div class="lk-chips"></div><form class="lk-foot" autocomplete="off"><input type="text" placeholder="Type your question…" aria-label="Type your question" /><button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg></button></form></div>');
  document.body.appendChild(fab);document.body.appendChild(panel);

  var log=panel.querySelector(".lk-log"),chipWrap=panel.querySelector(".lk-chips"),form=panel.querySelector(".lk-foot"),input=form.querySelector("input"),sendBtn=form.querySelector("button");
  var history=[],opened=false,busy=false;

  function scrollDown(){log.scrollTop=log.scrollHeight;}
  function addUser(t){log.appendChild(el('<div class="lk-msg lk-user">'+esc(t)+'</div>'));scrollDown();}
  function addBot(text,extra){log.appendChild(el('<div class="lk-msg lk-bot">'+esc(text)+(extra||"")+'</div>'));scrollDown();}
  function showTyping(){var t=el('<div class="lk-typing"><i></i><i></i><i></i></div>');t.id="lk-typing";log.appendChild(t);scrollDown();}
  function hideTyping(){var t=document.getElementById("lk-typing");if(t)t.remove();}

  function renderChips(){chipWrap.innerHTML="";CHIPS.forEach(function(c){var b=el('<button class="lk-chip" type="button">'+esc(c)+'</button>');b.addEventListener("click",function(){if(!busy)send(c);});chipWrap.appendChild(b);});}
  function clearChips(){chipWrap.innerHTML="";}

  function send(text){
    if(busy)return;
    addUser(text);history.push({role:"user",content:text});clearChips();
    busy=true;sendBtn.disabled=true;showTyping();
    fetch(BIZ.endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:history})})
      .then(function(r){return r.json();})
      .then(function(data){
        hideTyping();
        var reply=(data&&data.reply)?data.reply:"";
        if(!reply)throw new Error("empty");
        history.push({role:"assistant",content:reply});
        var lower=reply.toLowerCase();
        var extra=/quote|price|cost|estimate|contact|call|reach/.test(lower)?(quoteBtn+ctaBlock):"";
        addBot(reply,extra);
      })
      .catch(function(){hideTyping();addBot("I couldn't reach our assistant just now — but our team can help you directly.",quoteBtn+ctaBlock);})
      .finally(function(){busy=false;sendBtn.disabled=false;input.focus();});
  }

  function openQuote(){
    var f=el('<div class="lk-msg lk-bot"><b style="font-family:\'Space Grotesk\',sans-serif;font-size:13.5px;display:block;margin-bottom:6px">Request a quote</b><form class="lk-form" novalidate><label>Name</label><input name="name" required placeholder="Your name" /><label>Phone</label><input name="phone" required placeholder="Best number" inputmode="tel" /><label>Property address or town</label><input name="location" required placeholder="Street or town, NJ" /><label>What do you need?</label><select name="service"><option>Elevation certificate</option><option>Boundary survey</option><option>Title / ALTA survey</option><option>Topographic survey</option><option>Construction stakeout</option><option>Condominium survey</option><option>Not sure / other</option></select><textarea name="message" placeholder="Anything else (deadline, permit, etc.)"></textarea><p class="lk-err" style="display:none"></p><button type="submit">Send request</button></form></div>');
    log.appendChild(f);scrollDown();
    var qform=f.querySelector("form"),err=f.querySelector(".lk-err"),btn=f.querySelector("button");
    qform.addEventListener("submit",function(e){
      e.preventDefault();
      var data={};["name","phone","location","service","message"].forEach(function(k){var n=qform.querySelector('[name="'+k+'"]');data[k]=n?n.value.trim():"";});
      if(!data.name||!data.phone||!data.location){err.textContent="Please add your name, phone, and location.";err.style.display="block";return;}
      err.style.display="none";btn.disabled=true;btn.textContent="Sending…";
      data._subject="Website quote request — "+data.service;
      fetch(BIZ.formspree,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify(data)})
        .then(function(r){if(!r.ok)throw new Error("bad");f.remove();addBot("Got it — thank you. Your request is in, and we'll reach out to "+data.phone+" shortly. Need it faster? Call "+BIZ.telDisplay+".");})
        .catch(function(){btn.disabled=false;btn.textContent="Send request";err.textContent="Something went wrong — please call "+BIZ.telDisplay+" instead.";err.style.display="block";});
    });
  }
  log.addEventListener("click",function(e){var a=e.target.closest("[data-quote]");if(a){e.preventDefault();openQuote();}});

  function openPanel(){panel.classList.add("is-open");fab.classList.add("is-open");if(!opened){opened=true;addBot(GREETING);renderChips();}setTimeout(function(){input.focus();},60);}
  function closePanel(){panel.classList.remove("is-open");fab.classList.remove("is-open");}
  fab.addEventListener("click",function(){panel.classList.contains("is-open")?closePanel():openPanel();});
  form.addEventListener("submit",function(e){e.preventDefault();var v=input.value.trim();if(!v||busy)return;input.value="";send(v);});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closePanel();});
})();
