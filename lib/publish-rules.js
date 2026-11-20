// Publishing rules shared by the admin dashboard and the agent publishing page (/admin/agent-publish).
// Both send stories to the same endpoints (POST/PUT /api/admin/stories); these checks run there.
const { slugify, plainText } = require('./util');

// Two titles count as the same story when they match ignoring case, accents and punctuation:
// "The Battle of Cannae" = "the battle of cannae!" = "The Battle of Cannae."
const titleKey = (title) => slugify(title);

const sameTitle = (stories, title, exceptId = null) =>
  stories.find((s) => s.id !== exceptId && titleKey(s.title) === titleKey(title)) || null;

const wordCount = (markdown) => plainText(markdown).split(/\s+/).filter(Boolean).length;

const AGENT_RULES = {
  minTitle: 10,
  minWords: 300,       // a full story, not a summary
  minExcerpt: 40,
  maxExcerpt: 300,
  minSources: 1,
};

// Extra checks for stories sent from the agent publishing page.
// Drafts only need a title and some text, so unfinished work can always be saved.
// Publishing needs everything a finished HiddenTimes story has.
// Returns a list of problems in plain English (empty = all good).
function agentProblems(f, { publishing, hasCover, categories }) {
  const problems = [];
  if (f.title.length < AGENT_RULES.minTitle) problems.push(`Title: at least ${AGENT_RULES.minTitle} characters.`);
  if (!f.body.trim()) problems.push('Story content: the story text is empty.');
  if (categories.length && !categories.includes(f.category)) {
    problems.push(`Category: choose one of the existing categories (${categories.join(', ')}).`);
  }
  if (!publishing) return problems;

  if (!f.author) problems.push('Author: write the author\'s name (e.g. Aime Moria).');
  const words = wordCount(f.body);
  if (words < AGENT_RULES.minWords) problems.push(`Story content: ${words} words; a published story needs at least ${AGENT_RULES.minWords}.`);
  if (f.excerpt.length < AGENT_RULES.minExcerpt || f.excerpt.length > AGENT_RULES.maxExcerpt) {
    problems.push(`Short description: ${AGENT_RULES.minExcerpt} to ${AGENT_RULES.maxExcerpt} characters.`);
  }
  if (f.resources.length < AGENT_RULES.minSources) problems.push('Sources: add at least one source with a working https:// link.');
  if (!hasCover) problems.push('Cover image: upload an image or give an image address.');
  if (!f.coverAlt) problems.push('Image description: describe what the cover image shows.');
  if (!f.coverCredit) problems.push('Image credit: name the creator, licence and source of the image (or "Original illustration").');
  return problems;
}

module.exports = { titleKey, sameTitle, wordCount, agentProblems, AGENT_RULES };
