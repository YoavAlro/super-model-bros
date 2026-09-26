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
};
