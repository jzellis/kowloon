const isLocalDomain = (d) =>
  d &&
  process.env.DOMAIN &&
  d.toLowerCase() === process.env.DOMAIN.toLowerCase();
export default isLocalDomain;
