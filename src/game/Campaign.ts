import * as THREE from 'three';
import { CHARACTERS, type CharacterId } from '../config/characters';
import { LEVELS } from '../config/levels';
import { HYPES, MOMENTS } from '../config/events';
import { RECAP_CLOSING } from '../config/recap';
import { PATHS, type PathSpec } from '../config/paths';
import { tip, type FactCard, type FactLine } from '../config/types';
import { newRun, writeSave, type RunState, type SaveData } from '../save';
import { showFactCard } from '../ui/FactCard';
import { Hud } from '../ui/Hud';
import { recapTable } from '../ui/Recap';
import type { StartChoice } from '../ui/TitleScreen';
import { shares, total } from './diet';
import { Input } from './Input';
import { checkUnlocks, endsWorld, formBefore, nextStep, recordLevel } from './progress';
import { buildRecap } from './recap';
import { setMuted } from './sfx';
import { Stage, type StageResult } from './Stage';

const START_LIVES = 5;
const ASSIST_LIVES = 9;

export interface CampaignOptions {
  save: SaveData;
  choice: StartChoice;
  onExit: () => void;
  /** Debug: jump straight to this level id on the chosen path. */
  startLevel?: string;
  /** Debug: run flags to start with (e.g. shadowBooks). */
  flags?: string[];
  /** Debug: lasting-hype perks to start with (e.g. teamFork). */
  perks?: string[];
}

/** Plays a path: intro card, level, outro card, save, unlocks, world breaks, and the ending. */
export class Campaign {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly timer = new THREE.Timer();
  private readonly overlay: HTMLDivElement;
  private readonly hud: Hud;
  private readonly input: Input;
  private readonly isTouch = Input.isTouchDevice();
  private readonly path: PathSpec;
  private readonly run: RunState;
  private stage: Stage | null = null;
  private lives: number;
  private running = true;

  constructor(private readonly root: HTMLElement, private readonly opts: CampaignOptions) {
    const { save, choice } = opts;
    this.path = PATHS[choice.path];
    const chars: CharacterId[] = choice.players === 2 ? [choice.lead, choice.lead === this.path.partner ? this.path.hero : this.path.partner] : [choice.lead];
    const saved = save.runs[choice.path];
    this.run = choice.resume && saved ? saved : newRun(choice.path, choice.players, chars);
    if (!choice.resume) this.run.chars = chars;
    if (opts.startLevel) {
      const i = this.path.steps.findIndex((s) => s.level === opts.startLevel);
      if (i >= 0) this.run.step = i;
    }
    for (const f of opts.flags ?? []) if (!this.run.flags.includes(f)) this.run.flags.push(f);
    for (const p of opts.perks ?? []) if (!this.run.perks.includes(p)) this.run.perks.push(p);
    save.runs[choice.path] = this.run;
    this.lives = save.settings.assist ? ASSIST_LIVES : START_LIVES;
    setMuted(!save.settings.sfx);

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isTouch, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isTouch ? 1.5 : 2));
    root.append(this.renderer.domElement);
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    root.append(this.overlay);
    this.input = new Input(this.run.players, this.overlay, this.isTouch);
    this.hud = new Hud(this.overlay, this.isTouch, () => this.input.requestPause());
    if (this.run.players === 2) {
      this.hud.setHint('P1: A/D move · W jump · L-Shift run · S power   |   P2: ←/→ move · ↑ jump · R-Shift run · ↓ power   |   Esc pause');
    }
    document.body.classList.toggle('large-text', save.settings.largeText);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.exposeDebug();
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  async start(): Promise<void> {
    const { save } = this.opts;
    if (this.run.step === 0 && this.path.prologue && !this.opts.startLevel) {
      await this.card(this.path.prologue, CHARACTERS[this.path.hero].color);
    }
    while (this.running) {
      const i = nextStep(this.path, this.run.step, this.run.flags);
      if (i >= this.path.steps.length) {
        await this.ending();
        return this.exit();
      }
      this.run.step = i;
      const spec = LEVELS[this.path.steps[i].level];
      const form = formBefore(this.path, i, this.run.flags, LEVELS);
      const stage = new Stage(
        {
        spec,
        path: this.path,
        form,
        chars: this.run.chars,
        lives: this.lives,
        perks: this.run.perks,
        flags: this.run.flags,
        settings: save.settings,
        root: this.root,
        resets: this.run.resets ?? 0,
      },
        this.input,
        this.hud,
        this.isTouch,
      );
      this.stage = stage;
      stage.resize();

      const intro: FactLine[] = [...spec.intro.lines];
      if (this.run.players === 2 && spec.world === 1) {
        intro.push(tip('Co-op note: Claude did not exist until 2021. In co-op you get to bring your brother early.'));
      }
      await this.card({ ...spec.intro, lines: intro }, CHARACTERS[this.path.hero].color, 'Start');
      stage.begin();
      const result = await stage.done;
      this.stage = null;
      stage.dispose();
      if (!this.running) return;

      if (result.outcome === 'quit') {
        writeSave(save);
        return this.exit();
      }
      if (result.outcome === 'gameover') {
        this.run.deaths += result.deaths;
        writeSave(save);
        await this.card(
          {
            title: 'Game over',
            date: `World ${spec.label}`,
            lines: [tip('Training runs fail all the time. Labs restart from a checkpoint, and so can you: Continue from the title screen.')],
          },
          0xff4d6d,
          'Back to title',
        );
        return this.exit();
      }
      await this.levelCleared(i, result);
    }
  }

  private async levelCleared(i: number, result: StageResult): Promise<void> {
    const { save } = this.opts;
    const spec = LEVELS[this.path.steps[i].level];
    this.lives = result.lives;
    this.run.deaths += result.deaths;
    for (const f of result.flags) if (!this.run.flags.includes(f)) this.run.flags.push(f);
    for (const h of result.hypes) this.run.hypes[h.id] = { call: h.call, correct: h.correct };
    for (const perk of result.perks) if (!this.run.perks.includes(perk)) this.run.perks.push(perk);
    this.run.resets = result.resets;
    const levelResult = { stars: result.stars, match: result.match, alignment: result.alignment };
    this.run.results[spec.id] = levelResult;
    const worldDone = endsWorld(this.path, i, this.run.flags, LEVELS);
    save.progress = recordLevel(save.progress, spec, levelResult, worldDone);
    const unlocked = checkUnlocks(save.progress, Object.values(PATHS), LEVELS);
    save.progress.unlocked.push(...unlocked);
    this.run.step = i + 1;
    writeSave(save);

    const matchWord = spec.recipeKind === 'published' ? 'the real training data' : 'the key ingredients of this step';
    const lines: FactLine[] = [
      tip(`History stars: ${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}. Your token mix matched ${matchWord} ${Math.round(result.match * 100)}%.`),
    ];
    if (result.alignment !== null) lines.push(tip(`Alignment: ${Math.round(result.alignment)}%. ${result.alignment >= 70 ? 'Helpful and harmless.' : 'Watch out for fake rewards.'}`));
    lines.push(...spec.outro.lines);
    for (const id of result.moments) lines.push({ ...MOMENTS[id].fact, text: `Moment · ${MOMENTS[id].name}: ${MOMENTS[id].fact.text}` });
    for (const h of result.hypes) {
      const hype = HYPES[h.id as keyof typeof HYPES];
      lines.push(tip(`Hype or shift? ${hype.name}: you called it ${h.call === 'lasting' ? 'a lasting shift' : 'a passing hype'}, and history ${h.correct ? 'agrees' : 'disagrees'}.`));
    }
    const diet = total(result.counts) > 0 ? { mine: shares(result.counts), real: spec.recipe, kind: spec.recipeKind } : undefined;
    await showFactCard(this.root, { card: { ...spec.outro, lines }, color: CHARACTERS[this.path.hero].color, diet, button: 'Continue' });
    this.input.clear();

    for (const id of unlocked) {
      const c = CHARACTERS[id];
      await this.card(
        { title: `${c.name} unlocked!`, date: `${c.lab} · new playable character`, lines: [tip(c.trait), tip('Pick it on the title screen to play either path as it.')] },
        c.color,
      );
    }
    if (worldDone) {
      const next = nextStep(this.path, i + 1, this.run.flags);
      if (next < this.path.steps.length) {
        const nextSpec = LEVELS[this.path.steps[next].level];
        await this.card(
          { title: `World ${spec.world} complete!`, date: `Next: World ${nextSpec.world}`, lines: [tip(`Up next: ${nextSpec.name}.`)] },
          CHARACTERS[this.path.hero].color,
        );
      }
    }
  }

  /** The end of the path: the finale recap compares your run with real history. */
  private async ending(): Promise<void> {
    const recap = buildRecap(this.run, this.path, LEVELS);
    const first = recap.levels[0];
    const last = recap.levels[recap.levels.length - 1];
    const perks = recap.perks.map((p) => Object.values(HYPES).find((h) => h.perk === p)?.name).filter((n): n is string => !!n);
    const lines: FactLine[] = [
      tip(`${recap.rank.title}! ${recap.rank.line}`),
      tip(`History stars: ${recap.stars.got} of ${recap.stars.max}. From ${first.model} to ${last.model}, ${first.date} to ${last.date}.`),
    ];
    if (recap.calls.total) {
      const missed = recap.calls.total - recap.calls.made;
      lines.push(tip(`Hype or shift? ${recap.calls.right} of ${recap.calls.total} calls matched history${missed ? ` (${missed} never grabbed)` : ''}.`));
    }
    if (perks.length) lines.push(tip(`Lasting shifts you carried to the end: ${perks.join(', ')}.`));
    lines.push(tip(RECAP_CLOSING));
    await showFactCard(this.root, {
      card: { title: `${this.path.name} complete!`, date: `Recap · ${first.date} → ${last.date}`, lines },
      color: CHARACTERS[this.path.hero].color,
      extra: recapTable(recap),
      button: 'Back to title',
    });
    // The run is over: the title screen offers a fresh start instead of Continue.
    delete this.opts.save.runs[this.path.id];
    writeSave(this.opts.save);
  }

  private card(card: FactCard, color: number, button = 'Continue'): Promise<void> {
    return showFactCard(this.root, { card, color, button }).then(() => this.input.clear());
  }

  private frame(time: number): void {
    if (!this.running) return;
    this.timer.update(time);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.stage?.frame(dt, this.timer.getElapsed(), this.renderer);
  }

  private readonly resize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.stage?.resize();
  };

  private exit(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    this.stage?.dispose();
    this.input.dispose();
    this.renderer.dispose();
    this.root.replaceChildren();
    if (window.__smb) delete window.__smb;
    this.opts.onExit();
  }

  /** Test hooks, enabled with ?debug in the URL. */
  private exposeDebug(): void {
    if (!new URLSearchParams(location.search).has('debug')) return;
    const stageFn =
      (name: string) =>
      (...args: unknown[]) => {
        const api = this.stage?.debug() as Record<string, (...a: unknown[]) => unknown> | undefined;
        return api?.[name]?.(...args) ?? null;
      };
    const names = ['state', 'level', 'lives', 'alignment', 'counts', 'bossHp', 'bosses', 'boss', 'flag', 'player', 'teleport', 'invincible', 'give', 'stomp', 'items', 'traps', 'star', 'enemies', 'hearts', 'platforms', 'riding', 'phase', 'autoscroll', 'hype', 'endHype', 'perks', 'moments', 'clones', 'bridges', 'startHype', 'goldenGate', 'praise', 'puzzle', 'gates', 'size', 'form', 'thinking', 'rival', 'forks', 'resets', 'mega', 'frozen', 'gateState', 'crushers'];
    const api: Record<string, (...args: unknown[]) => unknown> = Object.fromEntries(names.map((n) => [n, stageFn(n)]));
    api.card = () => document.querySelector('.modal h2')?.textContent ?? null;
    api.next = () => {
      const btn = document.querySelector('.modal-backdrop .btn.primary, .modal-backdrop .btn') as HTMLButtonElement | null;
      btn?.click();
      return !!btn;
    };
    api.run = () => JSON.parse(JSON.stringify(this.run));
    api.progress = () => JSON.parse(JSON.stringify(this.opts.save.progress));
    api.recap = () => buildRecap(this.run, this.path, LEVELS);
    window.__smb = api;
  }
}

declare global {
  interface Window {
    __smb?: Record<string, (...args: unknown[]) => unknown>;
  }
}
