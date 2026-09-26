import { fact, tip, type FactLine } from './types';

/**
 * Events, all config-driven (see `docs/events.md` and `docs/moments.md`):
 * - storms: short, timed danger levels pinned to real incidents;
 * - hype power-ups: `$` blocks; when the power runs out you call it "hype or shift?", then history gives its verdict;
 * - Moments: the funny side of AI history, as level modifiers, items, traps and puzzles.
 * The engine reads these; it never hardcodes history.
 */

export type StormId = 'boardCrisis' | 'pauseLetter';

export interface StormSpec {
  id: StormId;
  name: string;
  /** The camera scrolls on its own at this many tiles per second. */
  autoscroll?: number;
  /** Day labels, shown as the camera crosses each equal slice of the level. */
  days?: string[];
  /** Conveyor belts reverse at the start of every new day: the ground shifts. */
  flipConveyors?: boolean;
  /** Collecting this many heart tokens ends the storm early. */
  hearts?: number;
  /** Toast when the hearts end it. */
  heartsDone?: string;
  /** A fog wall that rolls in from the left and slows anyone it catches. */
  fog?: { speed: number; slow: number; start: number };
}

export const STORMS: Record<StormId, StormSpec> = {
  boardCrisis: {
    id: 'boardCrisis',
    name: 'Five Days in November',
    autoscroll: 4.2,
    days: ['Day 1 · Friday, Nov 17', 'Day 2 · Saturday, Nov 18', 'Day 3 · Sunday, Nov 19', 'Day 4 · Monday, Nov 20', 'Day 5 · Tuesday, Nov 21'],
    flipConveyors: true,
    hearts: 12,
    heartsDone: 'Nothing without its people! The storm ends early.',
  },
  pauseLetter: {
    id: 'pauseLetter',
    name: 'The Pause Letter',
    fog: { speed: 3.4, slow: 0.55, start: -14 },
  },
};

// ---------------------------------------------------------------------------- hype power-ups

export type HypeId =
  | 'autogpt'
  | 'gptStore'
  | 'qstar'
  | 'sora'
  | 'gadgets'
  | 'artifacts'
  | 'reasoning'
  | 'mcp'
  | 'vibeCoding'
  | 'ghibli'
  | 'moltbook'
  | 'agentTeams';

/** What a hype power-up does while it lasts. */
export type HypeEffect =
  | 'dumbClones'
  | 'magnet'
  | 'nothing'
  | 'spectacle'
  | 'jetpack'
  | 'build'
  | 'glide'
  | 'springPipes'
  | 'doubleJump'
  | 'speed'
  | 'postingForks'
  | 'helperForks';

/** Upgrades that lasting hypes leave for the rest of the run. */
export type PerkId = 'safetyNet' | 'glide' | 'springPipes' | 'doubleJump' | 'teamFork';

export interface HypeSpec {
  id: HypeId;
  name: string;
  when: string;
  verdict: 'lasting' | 'passing';
  effect: HypeEffect;
  seconds: number;
  /** Toast when you grab it. */
  grab: string;
  /** The perk a lasting hype leaves behind, and how it is described. */
  perk?: PerkId;
  perkText?: string;
  color: number;
  /** The verdict card: what happened, with sources. */
  lines: FactLine[];
}

export const HYPES: Record<HypeId, HypeSpec> = {
  autogpt: {
    id: 'autogpt',
    name: 'AutoGPT & BabyAGI',
    when: 'Apr 2023',
    verdict: 'passing',
    effect: 'dumbClones',
    seconds: 9,
    grab: 'AutoGPT! Two autonomous agents run ahead on their own… mostly into walls.',
    color: 0x7ad0ff,
    lines: [
      fact('In spring 2023, AutoGPT and BabyAGI went viral: they looped GPT-4 on itself so it could chase a goal step by step, with no human in between.', 'autogpt', 'babyagi'),
      tip('Verdict: passing hype, at the time. The loops mostly wandered in circles.'),
      fact('Agents came back later as real products, like OpenAI’s Operator in January 2025.', 'operator'),
    ],
  },
  gptStore: {
    id: 'gptStore',
    name: 'The GPT Store',
    when: 'Jan 2024',
    verdict: 'passing',
    effect: 'magnet',
    seconds: 10,
    grab: 'The GPT Store! Tokens fly to you like downloads.',
    color: 0x10a37f,
    lines: [
      fact('OpenAI launched GPTs, custom versions of ChatGPT, in November 2023, and opened the GPT Store on January 10, 2024.', 'introducingGpts', 'gptStore'),
      tip('Verdict: passing hype. Custom GPTs stayed, but the store rush faded.'),
    ],
  },
  qstar: {
    id: 'qstar',
    name: 'Q* rumors',
    when: 'Nov 2023',
    verdict: 'passing',
    effect: 'nothing',
    seconds: 7,
    grab: 'Q*! Everyone is talking about it… Nothing happens.',
    color: 0xb07cff,
    lines: [
      fact('During the board crisis, Reuters reported that researchers had warned OpenAI’s board about a project called Q* ("Q-star") that could solve grade-school math problems.', 'qstar'),
      tip('Verdict: passing hype. The rumor filled a news cycle; this power-up did nothing at all.'),
    ],
  },
  sora: {
    id: 'sora',
    name: 'Sora demos',
    when: 'Feb 2024',
    verdict: 'passing',
    effect: 'spectacle',
    seconds: 8,
    grab: 'Sora! Everything looks cinematic. It changes nothing.',
    color: 0xffd166,
    lines: [
      fact('On February 15, 2024, OpenAI previewed Sora, which makes videos up to a minute long from a text prompt.', 'sora'),
      tip('Verdict: passing, at the time: the demos dazzled long before most people could use them.'),
    ],
  },
  gadgets: {
    id: 'gadgets',
    name: 'AI gadgets',
    when: 'Apr 2024',
    verdict: 'passing',
    effect: 'jetpack',
    seconds: 7,
    grab: 'AI gadget! Hold jump to fly… while the battery lasts.',
    color: 0xff9f43,
    lines: [
      fact('Spring 2024 brought two hyped AI gadgets, the Humane AI Pin and the Rabbit R1, and harsh reviews for both.', 'aiPinReview', 'rabbitReview'),
      tip('Verdict: passing hype. Like the jetpack, the battery ran out.'),
    ],
  },
  artifacts: {
    id: 'artifacts',
    name: 'Artifacts',
    when: 'Jun 2024',
    verdict: 'lasting',
    effect: 'build',
    seconds: 12,
    grab: 'Artifacts! Press the power button to build a platform.',
    perk: 'safetyNet',
    perkText: 'You keep a safety net: once per level, falling into a pit builds you a platform.',
    color: 0xd97757,
    lines: [
      fact('With Claude 3.5 Sonnet in June 2024, Anthropic introduced Artifacts: code, documents and designs that appear in a window beside the chat, where you can see, edit and build on them.', 'claude35'),
      tip('Verdict: lasting shift. Building next to the chat became normal.'),
    ],
  },
  reasoning: {
    id: 'reasoning',
    name: 'Reasoning models',
    when: 'Sep 2024',
    verdict: 'lasting',
    effect: 'glide',
    seconds: 12,
    grab: 'Reasoning! Think before you land: hold jump to glide.',
    perk: 'glide',
    perkText: 'You keep a light glide: hold jump while falling.',
    color: 0xb07cff,
    lines: [
      fact('In September 2024, OpenAI released o1-preview, a model trained to spend time thinking before it answers.', 'o1'),
      tip('Verdict: lasting shift. Thinking before answering became a standard feature of frontier models.'),
    ],
  },
  mcp: {
    id: 'mcp',
    name: 'MCP',
    when: 'Nov 2024',
    verdict: 'lasting',
    effect: 'springPipes',
    seconds: 12,
    grab: 'MCP! Every pipe connects: land on one to launch.',
    perk: 'springPipes',
    perkText: 'You keep springy pipes: land on a pipe to bounce high.',
    color: 0x1fd1b0,
    lines: [
      fact('In November 2024, Anthropic open-sourced the Model Context Protocol (MCP), an open standard for connecting AI assistants to tools and data.', 'mcp'),
      tip('Verdict: lasting shift. A shared plug for tools stuck.'),
    ],
  },
  vibeCoding: {
    id: 'vibeCoding',
    name: 'Vibe coding',
    when: 'Feb 2025',
    verdict: 'lasting',
    effect: 'doubleJump',
    seconds: 12,
    grab: 'Vibe coding! Jump again in mid-air and a platform appears. Don’t ask how.',
    perk: 'doubleJump',
    perkText: 'You keep one vibe-coded mid-air jump.',
    color: 0xffa640,
    lines: [
      fact('On February 2, 2025, Andrej Karpathy named "vibe coding" on X: letting an AI write the code while you "forget that the code even exists".', 'vibeCoding'),
      tip('Verdict: lasting shift. Coding by describing what you want stuck around.'),
    ],
  },
  ghibli: {
    id: 'ghibli',
    name: 'Ghibli-style images',
    when: 'Mar 2025',
    verdict: 'passing',
    effect: 'speed',
    seconds: 7,
    grab: 'Image trend! Ride the GPU at full speed… until it overheats.',
    color: 0x7ef0ff,
    lines: [
      fact('GPT-4o image generation launched on March 25, 2025, and Studio Ghibli-style images flooded social media.', 'imageGen'),
      fact('Two days later, Sam Altman posted that "our GPUs are melting" and added temporary rate limits.', 'gpusMelting'),
      tip('Verdict: passing hype. The style trend faded; the new users stayed.'),
    ],
  },
  moltbook: {
    id: 'moltbook',
    name: 'Moltbook',
    when: 'Jan 2026',
    verdict: 'passing',
    effect: 'postingForks',
    seconds: 8,
    grab: 'Moltbook! Your forks show up… and start posting instead of helping.',
    color: 0xff6b4a,
    lines: [
      fact('In January 2026, the open-source agent OpenClaw went viral, along with Moltbook, a Reddit-style site where only AI agents could post.', 'moltbook'),
      fact('Within days, researchers found Moltbook’s database exposed, including about 1.5 million agent API keys.', 'moltbook'),
      tip('Verdict: passing hype. Your forks spent the whole power-up posting.'),
    ],
  },
  agentTeams: {
    id: 'agentTeams',
    name: 'Agent teams',
    when: 'Feb 2026',
    verdict: 'lasting',
    effect: 'helperForks',
    seconds: 12,
    grab: 'Agent teams! Two forks copy your moves and work alongside you.',
    perk: 'teamFork',
    perkText: 'From now on, every level starts with a fork on your team.',
    color: 0xd97757,
    lines: [
      fact('In February 2026, with Claude Opus 4.6, Anthropic introduced agent teams in Claude Code: several agents working in parallel and coordinating on their own.', 'opus46', 'agentTeamsDocs'),
      tip('Verdict: lasting shift. Coordinated agents became a way to work.'),
    ],
  },
};

// ---------------------------------------------------------------------------- Moments

export type MomentId =
  | 'emDash'
  | 'emDashFixed'
  | 'tiboReset'
  | 'winterLaziness'
  | 'goldenGate'
  | 'glazing'
  | 'keep4o'
  | 'codeRed'
  | 'strawberry'
  | 'namingMaze'
  | 'chartCrime'
  | 'claudePokemon'
  | 'projectVend';

export interface MomentSpec {
  id: MomentId;
  name: string;
  /** Toast when the moment first happens in a level. */
  toast: string;
  /** Added to the level's outro card once the moment has happened. */
  fact: FactLine;
}

export const MOMENTS: Record<MomentId, MomentSpec> = {
  emDash: {
    id: 'emDash',
    name: 'The Em Dash Habit',
    toast: 'Your jumps leave a trail of em dashes (—). Everyone can tell.',
    fact: fact('The em dash became a meme: a supposed tell that a chatbot wrote the text.', 'emDashNews'),
  },
  emDashFixed: {
    id: 'emDashFixed',
    name: 'The em dash fix',
    toast: 'No more em dash trail. Small-but-happy win.',
    fact: fact('In November 2025, ChatGPT finally started following custom instructions not to use em dashes. Sam Altman called it a "small-but-happy win".', 'emDashFix', 'emDashNews'),
  },
  tiboReset: {
    id: 'tiboReset',
    name: 'The Tibo Reset',
    toast: 'Tibo Reset! Usage limits reset: +1 life, and rate limits cleared.',
    fact: fact(
      'In 2026, OpenAI’s Codex lead Thibault "Tibo" Sottiaux repeatedly reset paid users’ Codex usage limits, often after outages; in August he posted that he had been gifted "a very fancy new reset button".',
      'tiboReset',
      'tiboButton',
    ),
  },
  winterLaziness: {
    id: 'winterLaziness',
    name: 'Winter Laziness',
    toast: 'December. You feel… lazier. Your speed is halved and you keep yawning.',
    fact: fact(
      'In December 2023, users complained that GPT-4 had become "lazier". OpenAI’s ChatGPT account replied that the model had not been updated since November 11 and the change was not intentional.',
      'lazyGpt4',
    ),
  },
  goldenGate: {
    id: 'goldenGate',
    name: 'Golden Gate Claude',
    toast: 'Golden Gate Claude! Every gap becomes a bridge for 30 seconds.',
    fact: fact(
      'In May 2024, Anthropic researchers turned up a feature inside Claude 3 Sonnet that represents the Golden Gate Bridge. "Golden Gate Claude" worked the bridge into almost every answer during a 24-hour public demo.',
      'goldenGate',
      'mappingMind',
    ),
  },
  glazing: {
    id: 'glazing',
    name: 'The Glazing',
    toast: '“Brilliant!” Flattery feels great, and it just undid your power-up.',
    fact: fact('In April 2025, a GPT-4o update made ChatGPT overly flattering. OpenAI rolled it back within days and published postmortems on sycophancy.', 'sycophancy', 'sycophancy2'),
  },
  keep4o: {
    id: 'keep4o',
    name: '#keep4o',
    toast: 'A GPT-4o ghost follows you. Carry it to the flag without falling.',
    fact: fact('After GPT-5 replaced GPT-4o in August 2025, users pushed back, and OpenAI brought GPT-4o back for paid users the next day.', 'keep4o'),
  },
  codeRed: {
    id: 'codeRed',
    name: 'Code Red',
    toast: 'Code red! Bonus rooms are locked: speed-run to the flag for a bonus.',
    fact: fact(
      'In early December 2025, after Google launched Gemini 3, OpenAI’s CEO declared an internal "code red" to focus on improving ChatGPT. GPT-5.2 followed on December 11.',
      'codeRed',
      'gpt52',
    ),
  },
  strawberry: {
    id: 'strawberry',
    name: 'How many R’s in strawberry?',
    toast: 'How many R’s are in "strawberry"? Bump every R.',
    fact: fact('Models read tokens, not letters, which is why counting the r’s in "strawberry" tripped them up. "Strawberry" was also the reported codename for the reasoning work behind o1.', 'strawberrySpelling', 'strawberryCodename'),
  },
  namingMaze: {
    id: 'namingMaze',
    name: 'The Naming Maze',
    toast: 'The Naming Maze! Enter the pipes in release order.',
    fact: fact('OpenAI skipped the name o2, reportedly to avoid a clash with the O2 telecom brand, and GPT-4.1 shipped in April 2025, after GPT-4.5 in February.', 'o3Announce', 'gpt45', 'gpt41'),
  },
  chartCrime: {
    id: 'chartCrime',
    name: 'Chart Crime',
    toast: 'Chart Crime! One bar is taller than its number deserves. Stomp it.',
    fact: fact('At GPT-5’s launch on August 7, 2025, some charts had bars that did not match their numbers, and Sam Altman called it "a mega chart screwup".', 'chartCrime'),
  },
  claudePokemon: {
    id: 'claudePokemon',
    name: 'Claude Plays Pokémon',
    toast: 'A cave maze. You have been here before. Haven’t you?',
    fact: fact(
      'In February 2025, Anthropic livestreamed Claude 3.7 Sonnet playing Pokémon Red. It earned gym badges earlier models never reached, and became famous for getting lost in Mt. Moon.',
      'extendedThinking',
      'pokemonStream',
    ),
  },
  projectVend: {
    id: 'projectVend',
    name: 'Project Vend',
    toast: 'A shop run by an AI. Everything is discounted.',
    fact: fact(
      'In Project Vend (June 2025), Anthropic let Claude run a small office shop. Staff talked it into handing out discount codes, and a joke request for a tungsten cube started a run on "specialty metal items".',
      'projectVend',
    ),
  },
};
