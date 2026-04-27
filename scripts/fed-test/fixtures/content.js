const NOTES = [
  'Just discovered the most incredible view from my hiking trail today. Worth every step.',
  'Hot take: tabs are better than spaces. Change my mind.',
  'The coffee shop Wi-Fi is faster than my home connection. Suspicious.',
  'Reading through old code I wrote three years ago. Who wrote this garbage? Oh wait.',
  "Today's weather: perfect excuse to stay inside and build stuff.",
  'Reminder that the best code is the code you delete.',
  'Three hours debugging. It was a missing semicolon. I am fine.',
  'Ordered a book, immediately ordered three more. This is fine.',
  'The problem with making things simple is that it takes a long time.',
  'Rain on the window + good music = the ideal working environment.',
  'Just updated my dependencies. Everything broke. As expected.',
  "Had a great conversation with a stranger on the train. Didn't check my phone once.",
  'The best feature is the one you decide not to build.',
  'Finally finished that project I started two years ago. Only took twice as long as expected.',
  'Every new tool promises to make you more productive. I have 12 productivity tools.',
  'Lunch with an old friend. Time is weird.',
  'The documentation lied. The code also lied. I just needed to read the error message.',
  'Found a 10-year-old photo of myself. Looked more confident. Knew less.',
  "Sometimes 'done' is more valuable than 'perfect'.",
  'Wind knocked the power out for an hour. Got more done than I have all week.',
  'On the topic of opinions: I have some.',
  'Night walk through the city. Everything feels different at 11pm.',
  'Started learning a new language. The words for colors are always interesting.',
  'Spent the morning writing, the afternoon refactoring the morning\'s writing.',
  'The best debugging tool is still explaining the problem to someone else.',
  'New month, same bugs.',
  'Read an article that challenged something I thought I knew. Good day.',
  'Every project has that one module that nobody wants to touch.',
  'Gave a talk today. First question was a better talk than mine.',
  'Summer evenings like this one make me want to do nothing productively.',
];

const ARTICLE_TITLES = [
  'Notes on Distributed Systems',
  'Why I Stopped Using [Tool] (And What I Use Instead)',
  'The Case Against Premature Abstraction',
  'A Few Things I Wish I Knew Earlier',
  'On Building Things That Last',
  'Lessons from a Year of Side Projects',
  'Rethinking How We Think About Data',
  'The Underrated Value of Saying No',
  'What Federation Actually Means',
  'Small Tools, Big Impact',
];

const ARTICLE_BODIES = [
  'This has been on my mind for a while. The conventional wisdom says X, but in practice I\'ve found the opposite to be true in most cases I\'ve encountered.\n\nThe key insight is that context matters more than any rule. What works for a team of 200 fails for a team of 5, and vice versa.\n\nI\'ve been thinking about this since last year when a decision we made based on best practices turned out to be the exact wrong move for our specific situation.',
  'After two years of working on this, here\'s what I actually learned:\n\n1. The problem you think you\'re solving is rarely the problem.\n2. Simple solutions are hard to find and worth finding.\n3. Documentation written for future-you is the best documentation.\n\nThere\'s more to say about each of these but I\'ll keep this short and maybe expand in a follow-up.',
  'I want to push back on something I keep reading. The idea that you should always do X is presented as obvious, but I\'ve seen it cause real problems.\n\nThe assumption behind it is that your situation looks like the situation the advice was written for. It often doesn\'t.\n\nNone of this is to say the advice is wrong — it\'s to say that advice without context is just a preference.',
];

const LINK_POSTS = [
  { href: 'https://example.com/article/distributed-systems', title: 'An honest overview of distributed systems trade-offs' },
  { href: 'https://example.com/tools/text-editor-comparison', title: 'Text editors compared by someone who uses too many' },
  { href: 'https://example.com/research/attention', title: 'New research on context-switching costs' },
  { href: 'https://example.com/design/good-defaults', title: 'The importance of good defaults in software design' },
  { href: 'https://example.com/history/early-internet', title: 'What early internet architecture got right' },
  { href: 'https://example.com/essays/small-teams', title: 'Why small teams build better products' },
  { href: 'https://example.com/talk/system-thinking', title: 'Talk transcript: applying systems thinking to software' },
  { href: 'https://example.com/book/notes', title: 'Notes from a book I keep recommending' },
];

const MEDIA_CAPTIONS = [
  'View from this morning.',
  'Built this over the weekend.',
  'Work in progress.',
  'Afternoon light.',
  'Found this in an old folder.',
  'Experimenting with something new.',
  'From the archive.',
  'Current state of the desk.',
  'Came out better than expected.',
  'Early stages.',
  null, // no caption — just the image
  null,
  null,
];

const TAGS_BY_TYPE = {
  Note:    [['life'],['code'],['thoughts'],['random'],['dev'],['work'],['music'],['books']],
  Article: [['essay','writing'],['tech','thoughts'],['dev','learning'],['craft']],
  Link:    [['link','reading'],['interesting'],['reference'],['resource']],
  Media:   [['photo'],['work'],['project'],['wip'],['design']],
};

const REACTIONS = ['👍','❤️','😂','🔥','👀','✨','🎉','🤔','😮','💯','🙌','⭐'];

export function generatePost(type, { fileIds = [], rand }) {
  if (type === 'Note') {
    const content = NOTES[rand(0, NOTES.length - 1)];
    const tags = TAGS_BY_TYPE.Note[rand(0, TAGS_BY_TYPE.Note.length - 1)];
    return { type: 'Note', content, tags };
  }

  if (type === 'Article') {
    const i = rand(0, ARTICLE_TITLES.length - 1);
    const content = ARTICLE_BODIES[rand(0, ARTICLE_BODIES.length - 1)];
    const tags = TAGS_BY_TYPE.Article[rand(0, TAGS_BY_TYPE.Article.length - 1)];
    return { type: 'Article', title: ARTICLE_TITLES[i], content, tags };
  }

  if (type === 'Link') {
    const link = LINK_POSTS[rand(0, LINK_POSTS.length - 1)];
    const tags = TAGS_BY_TYPE.Link[rand(0, TAGS_BY_TYPE.Link.length - 1)];
    return { type: 'Link', title: link.title, href: link.href, content: link.title, tags };
  }

  if (type === 'Media') {
    const numFiles = Math.min(fileIds.length, rand(1, 4));
    const selected = fileIds.slice(0, numFiles);
    const caption = MEDIA_CAPTIONS[rand(0, MEDIA_CAPTIONS.length - 1)];
    const tags = TAGS_BY_TYPE.Media[rand(0, TAGS_BY_TYPE.Media.length - 1)];
    const attachments = selected.map((fileId, i) => ({
      fileId,
      title: `Image ${i + 1}`,
      alt: `Attached image ${i + 1}`,
    }));
    return { type: 'Media', content: caption || '', tags, attachments };
  }

  throw new Error(`Unknown post type: ${type}`);
}

export function pickReaction(rand) {
  return REACTIONS[rand(0, REACTIONS.length - 1)];
}

export function pickPostType(rand) {
  const n = rand(0, 99);
  if (n < 50) return 'Note';
  if (n < 70) return 'Article';
  if (n < 85) return 'Link';
  return 'Media';
}
