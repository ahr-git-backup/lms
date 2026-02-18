
export const extractVideoId = (urlOrId: string) => {
  if (!urlOrId) return null;
  // Handle various YouTube formats including shorts, live, etc.
  const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([^&?]+)/);
  return match ? match[1] : urlOrId;
};

export const getEmbedUrl = (urlOrId: string) => {
  const id = extractVideoId(urlOrId);
  if (!id) return "";
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
};
