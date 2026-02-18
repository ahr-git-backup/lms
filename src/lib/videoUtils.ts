
export const extractVideoId = (urlOrId: string) => {
  if (!urlOrId) return null;
  // Handle various YouTube formats including m.youtube.com, shorts, live, etc.
  // The regex looks for:
  // 1. standard domains (youtube.com, www.youtube.com, m.youtube.com, youtu.be)
  // 2. paths like /embed/, /v/, /watch?v=, /shorts/, /live/
  // 3. extracts the 11 char ID
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/)|m\.youtube\.com\/(?:watch\?v=|v\/))([^&?\/]+)/);
  return match ? match[1] : (urlOrId.length === 11 ? urlOrId : null);
};

export const getEmbedUrl = (urlOrId: string) => {
  const id = extractVideoId(urlOrId);
  if (!id) return "";
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
};
