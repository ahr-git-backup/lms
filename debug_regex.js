
const urls = [
    "https://youtu.be/P7JyrhGnjhg",
    "https://www.youtube.com/watch?v=P7JyrhGnjhg",
    "https://m.youtube.com/watch?v=P7JyrhGnjhg",
    "P7JyrhGnjhg"
];

const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/)|m\.youtube\.com\/(?:watch\?v=|v\/))([^&?\/]+)/;

urls.forEach(url => {
    const match = url.match(regex);
    const result = match ? match[1] : (url.length === 11 ? url : null);
    console.log(`URL: ${url} => ID: ${result}`);
});
