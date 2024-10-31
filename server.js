const express = require("express");
const config = require("./config");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 80;

// Middleware to parse JSON
app.use(express.json());

const API_KEY_LIST = config.apiKeyList;
let currentIndex = 0;

// Cache to store input and corresponding image paths
const imageCache = {};

app.get("/", async (req, res) => {
  res.send("Hello World!");
});

// Get a meme
app.post("/meme", async (req, res) => {
  try {
    // Normalize input: remove spaces and convert to lowercase
    const { input } = req.body;
    const normalizedInput = input.replace(/\s+/g, "").toLowerCase();

    // Check if the image for this input already exists
    if (imageCache[normalizedInput]) {
      // Send cached image
      const cachedImagePath = imageCache[normalizedInput];
      const cachedImageBuffer = fs.readFileSync(cachedImagePath);
      res.set("Content-Type", "image/png");
      return res.send(cachedImageBuffer);
    }

    // Random API key
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
    const textX = width / 2;
    const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

    // Draw each line of text with outline
    lines.forEach((line, index) => {
      const textY = startY + index * lineHeight;
      ctx.strokeText(line, textX, textY);
      ctx.fillText(line, textX, textY);
    });

    // Convert canvas to buffer
    const buffer = canvas.toBuffer("image/png");

    // Save the image with a timestamp (optional)
    const timestamp = Date.now();
    const filename = path.join(__dirname, `${timestamp}.png`);
    fs.writeFileSync(filename, buffer);

    // Update cache with the normalized input and corresponding image path
    imageCache[normalizedInput] = filename;

    // Set response headers for image
    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", `inline; filename=${timestamp}.png`);

    // Send the image buffer as a response
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching meme data" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
