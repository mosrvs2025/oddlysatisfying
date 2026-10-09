export const CSS = `
.tr{position:fixed;inset:0;z-index:20;background:#0a0b10;color:#eef0f7;font-family:'Figtree','Helvetica Neue',Arial,system-ui,sans-serif;-webkit-user-select:none;user-select:none;overflow:hidden;-webkit-tap-highlight-color:transparent}
.tr[hidden],.tr [hidden]{display:none!important}
.tr button{font:inherit;color:inherit}
.tr-cv{position:absolute;left:0;right:0;top:0;bottom:var(--dock,0px);width:100%;height:calc(100% - var(--dock,0px));display:block;touch-action:none;cursor:crosshair}
.tr svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.tr-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0;pointer-events:none}
.tr-top>*{pointer-events:auto;display:flex;align-items:center;gap:6px;min-width:0}
.tr-ib{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(20,22,32,.66);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);cursor:pointer;padding:0;flex:none}
.tr-ib.on{background:#eef0f7;color:#0b0d13}
.tr-ib:disabled{opacity:.35;cursor:default}
.tr-speed{font:700 13px/1 inherit;font-variant-numeric:tabular-nums}
.tr-title{border:0;background:none;text-align:left;cursor:pointer;padding:2px 4px;min-width:0;text-shadow:0 1px 10px rgba(0,0,0,.7)}
.tr-title b{display:block;font:800 18px/1.05 'Bricolage Grotesque','Avenir Next',system-ui,sans-serif;letter-spacing:-.02em}
.tr-count .short{display:none}
.tr-count{display:block;font-size:11px;font-weight:600;color:#c7b8ff;margin-top:3px;white-space:nowrap}
.tr-toasts{position:absolute;top:calc(env(safe-area-inset-top,0px) + 60px);left:50%;transform:translateX(-50%);width:min(320px,calc(100% - 24px));display:flex;flex-direction:column;gap:6px;pointer-events:none}
.tr-toast{background:rgba(24,22,40,.8);border:1px solid rgba(199,184,255,.3);border-radius:12px;padding:7px 12px;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);animation:tr-in .45s cubic-bezier(.2,1.4,.4,1);transition:opacity .5s,transform .5s;box-shadow:0 8px 30px rgba(0,0,0,.4)}
.tr-toast.out{opacity:0;transform:translateY(-8px)}
.tr-toast small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#c7b8ff;font-weight:700}
.tr-toast b{display:inline;font:800 15px/1.2 'Bricolage Grotesque',system-ui,sans-serif;margin:2px 0}
.tr-toast p{margin:1px 0 0;font-size:12.5px;line-height:1.35;color:#d4d7e4}
.tr-toast em{display:block;font-style:normal;font-size:12px;font-weight:700;color:#ffd27a;margin-top:4px}
@keyframes tr-in{from{opacity:0;transform:translateY(-10px) scale(.96)}}
.tr-debug{position:absolute;left:12px;top:calc(env(safe-area-inset-top,0px) + 58px);margin:0;font:600 11px/1.45 ui-monospace,Menlo,monospace;color:#9fe3b0;background:rgba(0,0,0,.5);padding:6px 8px;border-radius:8px;pointer-events:none;white-space:pre}
.tr-dock{position:absolute;left:0;right:0;bottom:0;padding:0 8px calc(env(safe-area-inset-bottom,0px) + 8px);display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.tr-dock>*{pointer-events:auto;max-width:min(100%,760px)}
.tr-tip{position:absolute;left:0;right:0;bottom:100%;margin-bottom:4px;font-size:13px;font-weight:600;color:rgba(238,240,247,.9);text-shadow:0 1px 10px rgba(0,0,0,.9);text-align:center;opacity:0;transition:opacity .4s;pointer-events:none!important;padding:0 8px;text-wrap:balance}
.tr-tip.on{opacity:1}
.tr-row{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:4px;background:rgba(18,20,30,.72);border:1px solid rgba(255,255,255,.1);border-radius:16px;-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);width:max-content}
.tr-row::-webkit-scrollbar{display:none}
.tr-tool{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:52px;padding:6px 4px 5px;border:0;border-radius:12px;background:none;color:#9aa1b6;font-size:10.5px!important;font-weight:600!important;cursor:pointer;flex:none}
.tr-tool.on{background:rgba(255,255,255,.14);color:#fff}
.tr-tool.locked{opacity:.32}
.tr-mat{display:flex;align-items:center;gap:6px;padding:6px 10px 6px 6px;border:1px solid transparent;border-radius:11px;background:none;cursor:pointer;flex:none;font-size:12.5px!important;font-weight:600!important;color:#d8dbe7;white-space:nowrap}
.tr-mat i{width:18px;height:18px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),inset 0 -4px 6px rgba(0,0,0,.25)}
.tr-mat.on{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff}
.tr-mats.dim .tr-mat.on{background:none;border-color:rgba(255,255,255,.18)}
.tr-more{align-self:center;padding:0 10px;font-size:11.5px;font-weight:700;color:#c7b8ff;white-space:nowrap}
.tr-size{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:600;color:#9aa1b6;width:min(360px,100%);padding:0 6px}
.tr-size input{flex:1;accent-color:#c7b8ff;height:22px}
.tr-size output{min-width:18px;color:#eef0f7;font-variant-numeric:tabular-nums}
.tr-sheet{position:absolute;inset:0;background:rgba(5,6,10,.55);display:flex;align-items:flex-end;justify-content:center;z-index:2}
.tr-sheet-in{position:relative;width:min(560px,100%);max-height:82%;overflow:auto;background:#141621;border:1px solid rgba(255,255,255,.1);border-radius:22px 22px 0 0;padding:18px 18px calc(env(safe-area-inset-bottom,0px) + 22px);animation:tr-up .3s cubic-bezier(.2,1,.3,1);-webkit-user-select:text;user-select:text}
@media (min-width:700px){.tr-sheet{align-items:center}.tr-sheet-in{border-radius:22px}}
@keyframes tr-up{from{transform:translateY(40px);opacity:0}}
.tr-x{position:sticky;float:right;top:0}
.tr h2{font:800 24px/1.1 'Bricolage Grotesque',system-ui,sans-serif;margin:4px 0 6px;letter-spacing:-.02em}
.tr h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9aa1b6;margin:18px 0 8px}
.tr-lead{color:#aeb3c6;font-size:13.5px;line-height:1.45;margin:4px 0}
.tr-codex{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px}
.tr-codex li{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.035);font-size:12.5px;line-height:1.35;color:#6f7589}
.tr-codex li b{display:block;font-size:13.5px;color:#6f7589}
.tr-codex li.got{background:rgba(199,184,255,.08);color:#c9cddc}
.tr-codex li.got b{color:#fff}
.tr-grid{display:flex;flex-wrap:wrap;gap:6px}
.tr-btn{padding:9px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);cursor:pointer;font-size:13px!important;font-weight:600!important}
.tr-btn.on{background:#eef0f7;color:#0b0d13!important}
.tr-btn.sm{padding:6px 11px}
.tr-btn:disabled{opacity:.35}
.tr-slots>div{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;color:#c9cddc}
.tr-slots span{flex:1}
.tr-code{width:100%;box-sizing:border-box;background:#0c0d14;color:#c9cddc;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px;font:12px/1.3 ui-monospace,monospace;margin-bottom:6px;resize:vertical}
.tr-check{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13.5px;color:#c9cddc}
.tr-check input{accent-color:#c7b8ff;width:17px;height:17px}
.tr-fail{position:absolute;inset:0;display:grid;place-content:center;gap:14px;text-align:center;padding:24px}
.tr-dock{transition:opacity .25s}
.tr.painting .tr-dock{opacity:.3}
.tr-lost{position:absolute;inset:0;z-index:5;display:grid;place-content:center;justify-items:center;gap:14px;text-align:center;background:rgba(10,11,16,.88);padding:24px}
.tr-sp{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:12px 14px;margin:10px 0}
.tr-sp header{display:flex;align-items:center;gap:8px}
.tr-sp header i{width:18px;height:18px;border-radius:6px;flex:none}
.tr-sp header b{flex:1;font:800 16px/1.1 'Bricolage Grotesque',system-ui,sans-serif}
.tr-sp header span{font-size:12px;color:#aeb3c6}
.tr-trait{margin-top:12px}
.tr-th{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:700}
.tr-th span{color:#c7b8ff;font-size:12px;font-variant-numeric:tabular-nums}
.tr-hist{position:relative;display:flex;align-items:flex-end;gap:2px;height:40px;margin:6px 0 4px;background:linear-gradient(90deg,rgba(255,255,255,.02),rgba(199,184,255,.1))}
.tr-hist u{flex:1;background:rgba(199,184,255,.6);border-radius:2px 2px 0 0;text-decoration:none;min-height:2px}
.tr-hist s{position:absolute;top:-3px;bottom:0;width:2px;background:#ffd27a;transform:translateX(-1px);transition:left .5s}
.tr-trait p{margin:0;font-size:12px;line-height:1.4;color:#8b91a7}
@media (max-width:520px){.tr-title b{display:none}.tr-count .long{display:none}.tr-count .short{display:inline;font-size:13px}}
/* phone on its side: tools on the left, materials on the right, the world in the middle */
.tr.land{--rl:122px;--rr:118px}
.tr.land .tr-cv{left:calc(var(--rl) + env(safe-area-inset-left,0px));right:auto;width:calc(100% - var(--rl) - var(--rr) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px));bottom:0;height:100%}
.tr.land .tr-top{padding:calc(env(safe-area-inset-top,0px) + 5px) calc(env(safe-area-inset-right,0px) + 8px) 0 calc(env(safe-area-inset-left,0px) + 8px)}
.tr.land .tr-ib{width:34px;height:34px}
.tr.land .tr-dock{inset:0;padding:0;display:block}
.tr.land .tr-dock>*{max-width:none}
.tr.land .tr-tools{position:absolute;left:calc(6px + env(safe-area-inset-left,0px));top:48px;bottom:6px;width:auto;display:grid;grid-template-columns:repeat(2,54px);grid-auto-rows:min-content;align-content:start;gap:2px;overflow-x:hidden;overflow-y:auto;padding:4px;overscroll-behavior:contain}
.tr.land .tr-tool{min-width:0;padding:5px 2px 4px}
.tr.land .tr-mats{position:absolute;right:calc(6px + env(safe-area-inset-right,0px));top:48px;bottom:6px;width:108px;flex-direction:column;gap:2px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}
.tr.land .tr-mat{width:100%;box-sizing:border-box;padding:7px 6px}
.tr.land .tr-more{padding:8px 4px;font-size:11px;white-space:normal;text-align:center}
.tr.land .tr-size{position:absolute;left:calc(50% + (var(--rl) - var(--rr)) / 2);bottom:6px;transform:translateX(-50%);width:min(260px,30vw);padding:3px 12px;background:rgba(18,20,30,.62);border:1px solid rgba(255,255,255,.1);border-radius:12px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.tr.land .tr-tip{left:var(--rl);right:var(--rr);bottom:44px;margin:0}
.tr.land .tr-toasts{top:calc(env(safe-area-inset-top,0px) + 50px)}
.tr.land .tr-sheet{align-items:center}
.tr.land .tr-sheet-in{max-height:94%;border-radius:18px}
@media (max-width:420px){.tr-ib{width:34px;height:34px}.tr-top .tr-right{gap:4px}.tr-title b{font-size:16px}.tr-tool{min-width:47px}}
`;
