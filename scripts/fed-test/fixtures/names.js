const FIRST = [
  'Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jake',
  'Karen','Leo','Mia','Noel','Olivia','Pete','Quinn','Rosa','Sam','Tara',
  'Uma','Vic','Wendy','Xander','Yara','Zoe','Aaron','Beth','Cole','Diana',
  'Eli','Fiona','Gary','Heidi','Ivan','Julia','Kent','Luna','Marco','Nina',
  'Omar','Pam','Ray','Sara','Tom','Ursula','Val','Will','Xena','Yuki',
];

const LAST = [
  'Anderson','Baker','Chen','Davis','Evans','Foster','Garcia','Hall','Ito','Jones',
  'Kim','Lee','Miller','Nguyen','O\'Brien','Patel','Quinn','Rivera','Smith','Taylor',
  'Ueda','Vance','Walker','Xu','Young','Zhang','Adams','Brown','Clark','Dixon',
  'Ellis','Flynn','Green','Hayes','Ingram','James','Knox','Lewis','Moore','Nash',
  'Owens','Price','Reed','Scott','Torres','Urwin','Vera','Ward','Xiao','Yates',
  'Zimmerman','Ash','Burke','Cruz','Dunn','Eaton','Ford','Grant','Hunt','Inglis',
  'Jordan','Kane','Lane','Marsh','Nash','Osman','Park','Reyes','Stone','Tran',
  'Usman','Voss','Webb','Yuen','Zane','Alves','Bose','Carr','Dale','Essa',
  'Finch','Guo','Hart','Iyer','Jain','Kato','Lam','Mori','Nair','Obi',
  'Pham','Rao','Sato','Tong','Ulrich','Vega','Wren','Yap','Zara','Abdi',
];

const BIOS = [
  'Building things and breaking them equally.',
  'Writer, reader, occasional over-thinker.',
  'Photographer by day, debugger by night.',
  'Interested in distributed systems and good coffee.',
  'Making the internet slightly less annoying, one post at a time.',
  'Perpetual student of everything.',
  'Opinions are my own. Mistakes are also my own.',
  'Currently learning something new.',
  'Enthusiast of open software and open sandwiches.',
  'Works in tech. Thinks about non-tech things.',
  'Writes code, writes occasionally, mostly just writes bugs.',
  'Somewhere between caffeine and chaos.',
  'Exploring ideas, one thread at a time.',
  'Amateur astronomer, professional procrastinator.',
  'Believer in small tools that do one thing well.',
  'Fan of long walks and short functions.',
  'Design is how it works.',
  'Mostly harmless.',
  'Nerd with broad interests and narrow deadlines.',
  'Always building something new, rarely finishing it.',
];

export function generateUser(serverIndex, userIndex) {
  const first = FIRST[userIndex % FIRST.length];
  const last = LAST[(userIndex + serverIndex * 7) % LAST.length];
  const username = `${first.toLowerCase()}${last.toLowerCase().replace(/[^a-z]/g, '')}${serverIndex}${String(userIndex).padStart(2, '0')}`;
  const bio = BIOS[(userIndex + serverIndex * 3) % BIOS.length];

  return {
    username,
    email: `${username}@test.local`,
    profile: {
      name: `${first} ${last}`,
      bio,
    },
  };
}

export function generateCircleName(index) {
  const names = [
    'Close Friends','Work Folks','Family','Tech People','Local Crew',
    'Reading Group','Hiking Buddies','Collaborators','Study Group','Inner Circle',
    'Creative Friends','Music People','Film Buffs','Game Night','Side Project',
  ];
  return names[index % names.length];
}

export function generateGroupName(index) {
  const names = [
    'Photography Enthusiasts','Tech Discussions','Book Club','Local Hikers','Film Society',
    'Open Source Corner','Music Listeners','Game Developers','Writers Room','Science Talks',
    'Design Critique','Astronomy Club','Cooking Experiments','Language Exchange','Urban Sketchers',
    'Cycling Group','Documentary Club','Retro Computing','Gardening Corner','Coffee Nerds',
    'Board Game Night','DIY Electronics','Poetry Circle','Vintage Records','Running Club',
  ];
  return names[index % names.length];
}
