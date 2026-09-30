export const CSS = `
.tr{position:fixed;inset:0;z-index:20;background:#0a0b10;color:#eef0f7;font-family:'Figtree','Helvetica Neue',Arial,system-ui,sans-serif;-webkit-user-select:none;user-select:none;overflow:hidden;-webkit-tap-highlight-color:transparent}
.tr[hidden],.tr [hidden]{display:none!important}
.tr button{font:inherit;color:inherit}
.tr-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
.tr svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.tr-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0;pointer-events:none}
.tr-top>*{pointer-events:auto;display:flex;align-items:center;gap:6px;min-width:0}
.tr-ib{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(20,22,32,.66);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);cursor:pointer;padding:0;flex:none}
.tr-ib:disabled{opacity:.35;cursor:default}
.tr-speed{font:700 13px/1 inherit;font-variant-numeric:tabular-nums}
.tr-title{border:0;background:none;text-align:left;cursor:pointer;padding:2px 4px;min-width:0;text-shadow:0 1px 10px rgba(0,0,0,.7)}
.tr-title b{display:block;font:800 18px/1.05 'Bricolage Grotesque','Avenir Next',system-ui,sans-serif;letter-spacing:-.02em}
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
.tr-tip{font-size:13px;font-weight:600;color:rgba(238,240,247,.9);text-shadow:0 1px 10px rgba(0,0,0,.9);text-align:center;opacity:0;transition:opacity .4s;pointer-events:none!important;padding:0 8px;text-wrap:balance}
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
@media (max-width:420px){.tr-ib{width:34px;height:34px}.tr-top .tr-right{gap:4px}.tr-title b{font-size:16px}.tr-tool{min-width:47px}}
`;
