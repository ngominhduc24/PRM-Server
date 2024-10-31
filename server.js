const express = require("express");
const config = require("./config");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const app = express();
const PORT = 80;

// Middleware to parse JSON
app.use(express.json());

const API_KEY_LIST = config.apiKeyList;
let currentIndex = 0;

app.get("/", async (req, res) => {
  res.send("Hello World!");
});

// Get a meme
app.post("/meme", async (req, res) => {
  try {
    // Random API key
    const { input } = req.body;
    const key = API_KEY_LIST[currentIndex];
    currentIndex = (currentIndex + 1) % API_KEY_LIST.length;

    // Data to send to the external API
    const data = {
      text: input,
      maxDimension: 500,
      inputLanguage: "en",
      outputLanguage: "en",
    };

    // Making a request to the external API
    const response = await axios.post(
      "https://supermeme.ai/api/meme/text-to-meme-2",
      data,
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          token: key,
        },
      }
    );

    const image = response.data.response.results[0];

    // START EDIT IMAGE
    const imageUrl = image.image_name;
    const text = image.captions[0].text;
    const x = image.captions[0].x;
    const y = image.captions[0].y;
    const initialFontSize = image.captions[0].fontSize * 0.8;
    const width = image.width;
    const height = image.height;

    // Load the image and create canvas
    const loadedImage = await loadImage(imageUrl);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Draw the image
    ctx.drawImage(loadedImage, 0, 0, width, height);

    // Set initial text properties
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4; // Outline thickness
    ctx.textAlign = "center";

    // Function to wrap text
    const wrapText = (context, text, maxWidth) => {
      const words = text.split(" ");
      let lines = [];
      let line = "";

      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + " ";
        let metrics = context.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + " ";
        } else {
          line = testLine;
        }
      }
      lines.push(line);
      return lines;
    };

    // Dynamically adjust font size if text is too wide
    let fontSize = initialFontSize;
    ctx.font = `bold ${fontSize}px sans-serif`;
    while (ctx.measureText(text).width > width * 0.9) {
      fontSize *= 0.9;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }

    // Wrap the text to fit within image width
    const lines = wrapText(ctx, text, width * 0.9);
    const lineHeight = fontSize * 1.2;

    // Adjust starting y position to center the text block vertically
    const textX = width / 2;
    const startY = y + lineHeight - ((lines.length - 1) * lineHeight) / 2;

    // Draw each line of text with outline
    lines.forEach((line, index) => {
      const textY = startY + index * lineHeight;
      ctx.strokeText(line, textX, textY);
      ctx.fillText(line, textX, textY);
    });

    // Convert canvas to base64
    const buffer = canvas.toBuffer("image/png");
    const base64Image = buffer.toString("base64");

    // Send the base64 image as a response
    res.json({
      data: base64Image,
      status: 200,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching meme data" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
