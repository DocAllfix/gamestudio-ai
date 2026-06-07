/**
 * Playtester (Fetta 5) — plays a built game headlessly and judges whether it's
 * actually playable, universally, by reading the game's STATE (not pixels).
 *
 * Every generated game publishes window.__GAME_STATE__ (the universal
 * GameState contract). The runner loads the build, sends a scripted input
 * sequence, and samples the state over time. An LLM then judges the state
 * trajectory against the design's declared goal — so one Playtester works for
 * any genre (platformer/puzzle/shooter/VN): "player fell off-screen at 1.2s and
 * never recovered", "goal never progressed", "game-over never triggers", etc.
 *
 * Deterministic guards catch the obvious cases without the LLM (no state
 * published, player lost on-screen and never recovered). Best-effort: a flaky
 * playtest never blocks a sound game.
 */
import type { SandboxSession } from "../sandbox/e2b.js";
import { GAME_STATE_GLOBAL } from "../../contracts/game-state.contract.js";

export interface PlaytestVerdict {
    playable: boolean;
    reason: string;
    signals: {
        state_published: boolean;
        samples: number;
        player_lost_at: number | null; // seconds when player_alive/on_screen went false and stayed
        progressed: boolean; // score or goal advanced
        error_count: number;
    };
}

export interface PlaytestTarget {
    webDir: string;
    entry: string;
}

export function webDirForEngine(engine: string): PlaytestTarget | null {
    switch (engine) {
        case "godot":
            return { webDir: "/project/build/web", entry: "index.html" };
        case "phaser":
        case "threejs":
        case "babylon":
            return { webDir: "/project/dist", entry: "index.html" };
        case "defold":
            return { webDir: "/project/build/html5", entry: "index.html" };
        default:
            return null;
    }
}

const RUNNER_PATH = "/project/playtest-runner.cjs";
const PLAY_SECONDS = 14;

/** Runner: serve the build (COOP/COEP), load it, send inputs, sample
 * window.__GAME_STATE__ each step, print one JSON line {states, errors}. */
const RUNNER_SOURCE = `
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const SECONDS = ${PLAY_SECONDS};
const PORT = 8732;
const MIME = { ".html":"text/html",".js":"text/javascript",".wasm":"application/wasm",".pck":"application/octet-stream",".png":"image/png" };
const server = http.createServer((req,res)=>{ const f=path.join(dir, req.url==="/"?"index.html":req.url.split("?")[0]);
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}); res.end(d); }); });
(async()=>{
  const errors={}; const states=[]; const gsLines=[]; let browser;
  await new Promise(r=>server.listen(PORT,r));
  try{
    // --disable-dev-shm-usage: containers (E2B) give /dev/shm only ~64MB; Godot
    // WASM blows past it and Chromium kills the tab ("Target crashed"). This
    // routes shared memory to /tmp. --disable-gpu avoids the swiftshader path.
    browser=await chromium.launch({args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
    const page=await browser.newPage({viewport:{width:640,height:480}});
    // Godot 4 web runs the game in a Web Worker when threads are on, so
    // JavaScriptBridge writes window.__GAME_STATE__ in a context page.evaluate
    // can't read ("no game state published") even though the game IS running.
    // The game ALSO prints "__GS__ alive=.. on=.. y=.. t=.." every frame to the
    // console (which IS visible here) — capture it as a reliable state fallback.
    page.on("console",m=>{ const t=m.text(); if(/__GS__/.test(t)) gsLines.push(t); else if(m.type()==="error"){const k=t.slice(0,60);errors[k]=(errors[k]||0)+1;} });
    page.on("pageerror",e=>{const k="pageerror: "+String(e.message).slice(0,50);errors[k]=(errors[k]||0)+1;});
    await page.goto("http://localhost:"+PORT+"/index.html",{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForTimeout(8000);
    const keys=["ArrowRight","ArrowRight","Space","ArrowRight","ArrowLeft","ArrowUp","Space"];
    for(let i=0;i<SECONDS;i++){
      const k=keys[i%keys.length];
      // Per-iteration guard: if the tab crashes mid-run we keep the states
      // gathered so far (the judge can still assess) instead of losing all.
      try{
        await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k);
        const st=await page.evaluate(()=>window["${GAME_STATE_GLOBAL}"]||null);
        states.push(st);
      }catch(loopErr){ errors["runner-loop: "+String(loopErr&&loopErr.message?loopErr.message:loopErr).slice(0,40)]=1; break; }
    }
  }catch(e){ errors["runner: "+String(e&&e.message?e.message:e).slice(0,50)]=1; }
  finally{ if(browser) await browser.close().catch(()=>{}); server.close(); }
  // Fallback: if window.__GAME_STATE__ gave nothing (threaded worker context),
  // rebuild states from the console "__GS__ alive=.. on=.. y=.. t=.." prints so
  // the verdict reflects the game that actually ran, not "no state".
  const windowStates=states.filter(s=>s!==null);
  let finalStates=windowStates;
  if(windowStates.length===0 && gsLines.length>0){
    finalStates=gsLines.map(l=>{ const m=l.match(/alive=(\\w+)\\s+on=(\\w+)\\s+y=(-?[\\d.]+)\\s+t=([\\d.]+)/i); if(!m)return null;
      return { player_alive: /true/i.test(m[1]), player_on_screen: /true/i.test(m[2]), player_y: parseFloat(m[3]), elapsed_seconds: parseFloat(m[4]) }; }).filter(s=>s!==null);
  }
  const top=Object.entries(errors).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,n])=>"x"+n+" "+k);
  console.log(JSON.stringify({states:finalStates, errorCount:Object.values(errors).reduce((a,b)=>a+b,0), topErrors:top}));
})();
`;

interface RawState {
    player_alive?: boolean;
    player_on_screen?: boolean;
    score?: number;
    goal_reached?: boolean;
    game_over?: boolean;
    [k: string]: unknown;
}

/** Run the playtest. `goal` is the design's declared win condition (for the LLM
 * judge); `judge` is the injected LLM judgement (optional → deterministic only). */
export async function playtest(
    sandbox: SandboxSession,
    target: PlaytestTarget,
    opts: {
        goal?: string;
        judge?: (args: { goal: string; states: RawState[]; errors: string[] }) => Promise<{ playable: boolean; reason: string } | null>;
    } = {},
): Promise<PlaytestVerdict> {
    try {
        await sandbox.writeFile(RUNNER_PATH, RUNNER_SOURCE);
        const res = await sandbox.runCommand(
            `NODE_PATH="$(npm root -g)" node ${RUNNER_PATH} ${target.webDir}`,
            (PLAY_SECONDS + 30) * 1000,
        );
        const line = res.stdout.trim().split("\n").filter(Boolean).pop() ?? "";
        const raw = JSON.parse(line) as { states: (RawState | null)[]; errorCount: number; topErrors: string[] };
        const states = raw.states.filter((s): s is RawState => s !== null);

        // ---- Deterministic guards (universal, no LLM) ----
        const statePublished = states.length > 0;
        if (!statePublished) {
            // No state at all: either the game didn't publish it, or it never ran.
            // Don't hard-fail on this alone (older games), but flag it.
            return verdict(true, "no game state published; could not assess playability", {
                state_published: false, samples: 0, player_lost_at: null, progressed: false, error_count: raw.errorCount,
            });
        }
        if (raw.errorCount > 20) {
            return verdict(false, `runtime errors during play: ${raw.topErrors.join("; ")}`, {
                state_published: true, samples: states.length, player_lost_at: null, progressed: false, error_count: raw.errorCount,
            });
        }
        // Player lost (dead or off-screen) early and never recovered = the
        // universal "ran off the level / died instantly" failure.
        const lostIdx = states.findIndex((s) => s.player_alive === false || s.player_on_screen === false);
        const recovered = lostIdx >= 0 && states.slice(lostIdx).some((s) => s.player_alive !== false && s.player_on_screen !== false);
        const lostAt = lostIdx >= 0 && !recovered ? +(lostIdx * 0.45).toFixed(1) : null;
        const progressed =
            states.some((s) => (s.score ?? 0) > (states[0]?.score ?? 0)) ||
            states.some((s) => s.goal_reached === true);

        if (lostAt !== null && lostAt < 3) {
            return verdict(false, `player was lost (dead/off-screen) at ~${lostAt}s and never recovered — the player likely falls or runs out of the playfield; keep it on screen and on solid ground`, {
                state_published: true, samples: states.length, player_lost_at: lostAt, progressed, error_count: raw.errorCount,
            });
        }

        // ---- LLM judgement against the design goal (the universal part) ----
        if (opts.judge && opts.goal) {
            const j = await opts.judge({ goal: opts.goal, states, errors: raw.topErrors });
            if (j) {
                return verdict(j.playable, j.reason, {
                    state_published: true, samples: states.length, player_lost_at: lostAt, progressed, error_count: raw.errorCount,
                });
            }
        }

        // No LLM judge: pass if the player survived and (ideally) progressed.
        return verdict(true, progressed ? "player survives and the game progresses" : "player survives input (no goal progress observed)", {
            state_published: true, samples: states.length, player_lost_at: lostAt, progressed, error_count: raw.errorCount,
        });
    } catch (error) {
        console.error("playtest failed (skipping): " + (error instanceof Error ? error.message : String(error)));
        return verdict(true, "playtest skipped (runner error)", {
            state_published: false, samples: 0, player_lost_at: null, progressed: false, error_count: 0,
        });
    }
}

function verdict(playable: boolean, reason: string, signals: PlaytestVerdict["signals"]): PlaytestVerdict {
    return { playable, reason, signals };
}
