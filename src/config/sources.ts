import type { Source } from './types';

/**
 * Every source a fact card cites, by id. Primary sources first (papers, lab announcements,
 * court and government pages), reputable reporting otherwise. Unit tests check that every
 * fact line cites ids that exist here.
 */
export const SOURCES: Record<string, Source> = {
  // World 1: pre-training
  transformer: { title: 'Attention Is All You Need', publisher: 'arXiv (Vaswani et al.)', url: 'https://arxiv.org/abs/1706.03762' },
  gpt1: {
    title: 'Improving Language Understanding by Generative Pre-Training',
    publisher: 'OpenAI',
    url: 'https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf',
  },
  gpt1Blog: { title: 'Improving language understanding with unsupervised learning', publisher: 'OpenAI', url: 'https://openai.com/index/language-unsupervised/' },
  gpt2Blog: { title: 'Better language models and their implications', publisher: 'OpenAI', url: 'https://openai.com/index/better-language-models/' },
  gpt2: {
    title: 'Language Models are Unsupervised Multitask Learners',
    publisher: 'OpenAI',
    url: 'https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf',
  },
  gpt2Release: { title: 'GPT-2: 1.5B release', publisher: 'OpenAI', url: 'https://openai.com/index/gpt-2-1-5b-release/' },
  gpt3: { title: 'Language Models are Few-Shot Learners', publisher: 'arXiv (Brown et al.)', url: 'https://arxiv.org/abs/2005.14165' },
  openaiApi: { title: 'OpenAI API', publisher: 'OpenAI', url: 'https://openai.com/index/openai-api/' },
  commonCrawl: { title: 'Common Crawl', publisher: 'Common Crawl Foundation', url: 'https://commoncrawl.org/about' },
  anthropicFounded: {
    title: 'Anthropic raises $124 million to build more reliable, general AI systems',
    publisher: 'Anthropic',
    url: 'https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems',
  },

  // World 2: alignment
  codex: { title: 'Evaluating Large Language Models Trained on Code', publisher: 'arXiv (Chen et al.)', url: 'https://arxiv.org/abs/2107.03374' },
  codexBlog: {
    title: 'OpenAI upgrades its natural language AI coder Codex and kicks off private beta',
    publisher: 'TechCrunch',
    url: 'https://techcrunch.com/2021/08/10/openai-upgrades-its-natural-language-ai-coder-codex-and-kicks-off-private-beta/',
  },
  copilot: {
    title: 'Introducing GitHub Copilot: your AI pair programmer',
    publisher: 'GitHub',
    url: 'https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/',
  },
  instructgptBlog: { title: 'Aligning language models to follow instructions', publisher: 'OpenAI', url: 'https://openai.com/index/instruction-following/' },
  instructgpt: {
    title: 'Training language models to follow instructions with human feedback',
    publisher: 'arXiv (Ouyang et al.)',
    url: 'https://arxiv.org/abs/2203.02155',
  },
  humanPreferences: {
    title: 'Deep reinforcement learning from human preferences',
    publisher: 'arXiv (Christiano et al.)',
    url: 'https://arxiv.org/abs/1706.03741',
  },
  faultyRewards: { title: 'Faulty reward functions in the wild', publisher: 'OpenAI', url: 'https://openai.com/index/faulty-reward-functions/' },
  specGaming: {
    title: 'Specification gaming: the flip side of AI ingenuity',
    publisher: 'Google DeepMind',
    url: 'https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/',
  },
  constitutionalAi: {
    title: 'Constitutional AI: Harmlessness from AI Feedback',
    publisher: 'arXiv (Bai et al.)',
    url: 'https://arxiv.org/abs/2212.08073',
  },
  claudesConstitution: { title: "Claude's Constitution", publisher: 'Anthropic', url: 'https://www.anthropic.com/news/claudes-constitution' },
  introducingClaude: { title: 'Introducing Claude', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/introducing-claude' },
  claude100k: { title: 'Introducing 100K Context Windows', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/100k-context-windows' },
  gpt4Blog: { title: 'GPT-4', publisher: 'OpenAI', url: 'https://openai.com/index/gpt-4-research/' },

  // World 3: viral
  chatgptBlog: { title: 'Introducing ChatGPT', publisher: 'OpenAI', url: 'https://openai.com/index/chatgpt/' },
  chatgptMillion: { title: 'ChatGPT crossed 1 million users (post)', publisher: 'Sam Altman on X', url: 'https://x.com/sama/status/1599668808285028353' },
  gpt4Paper: { title: 'GPT-4 Technical Report', publisher: 'arXiv (OpenAI)', url: 'https://arxiv.org/abs/2303.08774' },
  gpt4v: { title: 'GPT-4V(ision) system card', publisher: 'OpenAI', url: 'https://openai.com/index/gpt-4v-system-card/' },
  danJailbreak: {
    title: "ChatGPT's 'jailbreak' tries to make the A.I. break its own rules, or die",
    publisher: 'CNBC',
    url: 'https://www.cnbc.com/2023/02/06/chatgpt-jailbreak-forces-it-to-break-its-own-rules.html',
  },
  bingLimits: {
    title: 'The new Bing & Edge – Updates to Chat',
    publisher: 'Microsoft Bing Blog',
    url: 'https://blogs.bing.com/search/february-2023/The-new-Bing-Edge-Updates-to-Chat',
  },
  waluigi: {
    title: 'The Waluigi Effect (mega-post)',
    publisher: 'LessWrong (Cleo Nardo)',
    url: 'https://www.lesswrong.com/posts/D7PumeYTDPfBTp3i7/the-waluigi-effect-mega-post',
  },
  boardTransition: { title: 'OpenAI announces leadership transition', publisher: 'OpenAI', url: 'https://openai.com/index/openai-announces-leadership-transition/' },
  boardLetter: {
    title: 'Hundreds of OpenAI employees threaten to follow Altman to Microsoft unless board resigns',
    publisher: 'CNBC',
    url: 'https://www.cnbc.com/2023/11/20/hundreds-of-openai-employees-threaten-to-follow-altman-to-microsoft-unless-board-resigns-reports-say.html',
  },
  boardReturn: { title: 'Agreement in principle for Sam Altman to return (post)', publisher: 'OpenAI on X', url: 'https://x.com/OpenAI/status/1727206187077370115' },
  pauseLetter: {
    title: 'Pause Giant AI Experiments: An Open Letter',
    publisher: 'Future of Life Institute',
    url: 'https://futureoflife.org/open-letter/pause-giant-ai-experiments/',
  },
  pauseNews: {
    title: 'Elon Musk and other tech leaders call for pause in training AI beyond GPT-4',
    publisher: 'CNBC',
    url: 'https://www.cnbc.com/2023/03/29/elon-musk-other-tech-leaders-pause-training-ai-beyond-gpt-4.html',
  },
  claude2: { title: 'Claude 2', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/claude-2' },
  claude21: { title: 'Introducing Claude 2.1', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/claude-2-1' },

  // Hype power-ups
  autogpt: { title: 'What is Auto-GPT and why does it matter?', publisher: 'TechCrunch', url: 'https://techcrunch.com/2023/04/22/what-is-auto-gpt-and-why-does-it-matter/' },
  babyagi: { title: 'BabyAGI', publisher: 'GitHub (Yohei Nakajima)', url: 'https://github.com/yoheinakajima/babyagi' },
  operator: { title: 'Introducing Operator', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-operator/' },
  introducingGpts: { title: 'Introducing GPTs', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-gpts/' },
  gptStore: { title: 'Introducing the GPT Store', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-the-gpt-store/' },
  qstar: {
    title: "Sam Altman's ouster at OpenAI was precipitated by letter to board about AI breakthrough (Reuters)",
    publisher: 'CNBC',
    url: 'https://www.cnbc.com/2023/11/22/sam-altmans-ouster-at-openai-precipitated-by-letter-to-board-about-ai-breakthrough-sources-tell-reuters.html',
  },
  sora: { title: 'Sora: Creating video from text', publisher: 'OpenAI', url: 'https://openai.com/index/sora/' },
  aiPinReview: {
    title: 'The Humane AI Pin is the solution to none of technology’s problems',
    publisher: 'Engadget',
    url: 'https://www.engadget.com/the-humane-ai-pin-is-the-solution-to-none-of-technologys-problems-120002469.html',
  },
  rabbitReview: {
    title: 'Rabbit R1 review: A $199 AI toy that fails at almost everything',
    publisher: 'Engadget',
    url: 'https://www.engadget.com/rabbit-r1-review-a-199-ai-toy-that-fails-at-almost-everything-161043050.html',
  },
  claude35: { title: 'Claude 3.5 Sonnet', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/claude-3-5-sonnet' },
  o1: { title: 'Introducing OpenAI o1-preview', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-openai-o1-preview/' },
  mcp: { title: 'Introducing the Model Context Protocol', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/model-context-protocol' },
  vibeCoding: { title: 'There’s a new kind of coding I call “vibe coding” (post)', publisher: 'Andrej Karpathy on X', url: 'https://x.com/karpathy/status/1886192184808149383' },
  imageGen: { title: 'Introducing 4o Image Generation', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-4o-image-generation/' },
  gpusMelting: { title: 'Our GPUs are melting (post)', publisher: 'Sam Altman on X', url: 'https://x.com/sama/status/1905296867145154688' },
  moltbook: {
    title: 'Coverage of Clawdbot, Moltbot, OpenClaw and Moltbook (Jan 31, 2026)',
    publisher: 'Fortune',
    url: 'https://fortune.com/2026/01/31/ai-agent-moltbot-clawdbot-openclaw-data-privacy-security-nightmare-moltbook-social-network/',
  },
  opus46: { title: 'Introducing Claude Opus 4.6', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/claude-opus-4-6' },
  agentTeamsDocs: { title: 'Agent teams', publisher: 'Claude Code docs', url: 'https://code.claude.com/docs/en/agent-teams' },

  // Moments
  emDashFix: { title: 'Small-but-happy win (post)', publisher: 'Sam Altman on X', url: 'https://x.com/sama/status/1989193813043069219' },
  emDashNews: { title: 'OpenAI says it’s fixed ChatGPT’s em dash problem', publisher: 'TechCrunch', url: 'https://techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/' },
  tiboReset: { title: 'I have reset everyone’s Codex usage limits (post)', publisher: 'Thibault Sottiaux on X', url: 'https://x.com/thsottiaux/status/2071381664853319742' },
  tiboButton: { title: 'I was gifted a very fancy new reset button today (post)', publisher: 'Thibault Sottiaux on X', url: 'https://x.com/thsottiaux/status/2089941380336644295' },
  lazyGpt4: { title: 'We’ve heard all your feedback about GPT4 getting lazier (post)', publisher: 'ChatGPT on X', url: 'https://x.com/ChatGPTapp/status/1732979491071549792' },
  goldenGate: { title: 'Golden Gate Claude', publisher: 'Anthropic', url: 'https://www.anthropic.com/news/golden-gate-claude' },
  mappingMind: { title: 'Mapping the Mind of a Large Language Model', publisher: 'Anthropic', url: 'https://www.anthropic.com/research/mapping-mind-language-model' },
  sycophancy: { title: 'Sycophancy in GPT-4o: what happened and what we’re doing about it', publisher: 'OpenAI', url: 'https://openai.com/index/sycophancy-in-gpt-4o/' },
  sycophancy2: { title: 'Expanding on what we missed with sycophancy', publisher: 'OpenAI', url: 'https://openai.com/index/expanding-on-sycophancy/' },
  keep4o: { title: 'We for sure underestimated how much some of the things that people like in GPT-4o matter to them (post)', publisher: 'Sam Altman on X', url: 'https://x.com/sama/status/1953953990372471148' },
  codeRed: {
    title: "Sam Altman's 'Code Red' memo urges ChatGPT improvements amid growing Google threat, reports say",
    publisher: 'Forbes',
    url: 'https://www.forbes.com/sites/siladityaray/2025/12/02/altman-code-red-memo-urges-chatgpt-improvements-amid-growing-threat-from-google-reports-say/',
  },
  gpt52: { title: 'Introducing GPT-5.2', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-gpt-5-2/' },
  strawberrySpelling: { title: 'Why AI can’t spell “strawberry”', publisher: 'TechCrunch', url: 'https://techcrunch.com/2024/08/27/why-ai-cant-spell-strawberry/' },
  strawberryCodename: { title: 'OpenAI’s “Strawberry” reasoning model, o1 (Sep 12, 2024)', publisher: 'Axios', url: 'https://www.axios.com/2024/09/12/openai-strawberry-model-reasoning-o1' },
  o3Announce: { title: 'OpenAI announces new o3 models', publisher: 'TechCrunch', url: 'https://techcrunch.com/2024/12/20/openai-announces-new-o3-model/' },
  gpt45: { title: 'Introducing GPT-4.5', publisher: 'OpenAI', url: 'https://openai.com/index/introducing-gpt-4-5/' },
  gpt41: { title: 'Introducing GPT-4.1 in the API', publisher: 'OpenAI', url: 'https://openai.com/index/gpt-4-1/' },
  chartCrime: { title: 'Wow a mega chart screwup from us earlier (post)', publisher: 'Sam Altman on X', url: 'https://x.com/sama/status/1953513280594751495' },
  extendedThinking: { title: 'Claude’s extended thinking', publisher: 'Anthropic', url: 'https://www.anthropic.com/research/visible-extended-thinking' },
  pokemonStream: {
    title: 'Anthropic’s Claude AI is playing Pokémon on Twitch — slowly',
    publisher: 'TechCrunch',
    url: 'https://techcrunch.com/2025/02/25/anthropics-claude-ai-is-playing-pokemon-on-twitch-slowly',
  },
  projectVend: { title: 'Project Vend: Can Claude run a small shop?', publisher: 'Anthropic', url: 'https://www.anthropic.com/research/project-vend-1' },
};
