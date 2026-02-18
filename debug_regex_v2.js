
const urls = [
    "https://youtu.be/P7JyrhGnjhg",
    "https://www.youtube.com/watch?v=P7JyrhGnjhg",
    "https://m.youtube.com/watch?v=P7JyrhGnjhg",
    "P7JyrhGnjhg"
];

// More robust regex widely used for YouTube ID extraction
const regex = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;

urls.forEach(url => {
    const match = url.match(regex);
    const result = (match && match[1].length === 11) ? match[1] : (url.length === 11 ? url : null);
    console.log(`URL: ${url} => ID: ${result}`);
});
