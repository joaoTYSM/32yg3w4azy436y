/* -------------- Lively Listeners -------------- */

const wallpaperSettings = [];
let averageLoudness = 0;
let currentTrack = null;

// Track max loudness for relative intensity calculation
const maxLoudnessHistory = [];
const maxHistoryDuration = 60; // seconds
let currentMaxLoudness = 1; // Start at 1 to avoid division by zero

// Album cover colors
let albumColors = null;
let lastProcessedThumbnail = null;
let oldAlbumColors = null;
let transitionProgress = 1; // 0 = old colors, 1 = new colors
let transitionDuration = 1500; // ms
let transitionStartTime = null;

/* Gets called on customization changes */
function livelyPropertyListener(name, value) {
  wallpaperSettings[name] = value;

  // You can handle specific property changes here
  if (name.includes("nowPlaying")) updateNowPlaying(true);
  if (name.includes("visualizer")) updateAudioVisualizerStyle();
  if (name.includes("background")) {
    console.log(`Background setting changed: ${name} = ${value}`);
    updateBackgroundStyle();
  }
}

/* Gets called on audio data updates */
function livelyAudioListener(audioArray) {
  // audioArray is Uint8Array(128) with values between 0-255

  // Update average loudness for other parts of the wallpaper
  averageLoudness = audioArray.reduce((a, b) => a + b, 0) / audioArray.length;

  // Track max value from current audio frame
  const currentMax = Math.max(...audioArray);
  maxLoudnessHistory.push({ value: currentMax, timestamp: Date.now() });

  // Remove entries older than maxHistoryDuration seconds
  const cutoffTime = Date.now() - maxHistoryDuration * 1000;
  while (
    maxLoudnessHistory.length > 0 &&
    maxLoudnessHistory[0].timestamp < cutoffTime
  ) {
    maxLoudnessHistory.shift();
  }

  // Update current max loudness using average of max values (minimum 1 to avoid division by zero)
  if (maxLoudnessHistory.length > 0) {
    const averageMax =
      maxLoudnessHistory.reduce((sum, h) => sum + h.value, 0) /
      maxLoudnessHistory.length;
    currentMaxLoudness = Math.max(1, averageMax);
  }

  // Update the audio visualizer
  updateAudioVisualizer(audioArray);
}

function livelyCurrentTrack(data) {
  let track = JSON.parse(data);
  // Example track object:
  // {
  //     "AlbumArtist": "Various Artists",
  //     "AlbumTitle": "NCS: The Best of 2015",
  //     "AlbumTrackCount": 0,
  //     "Artist": "Cartoon",
  //     "Genres": [],
  //     "PlaybackType": "Music",
  //     "Subtitle": "",
  //     "Thumbnail": "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz3..",
  //     "Title": "On & On",
  //     "TrackNumber": 0
  // }
  currentTrack = track;
  updateNowPlaying();

  // Extract colors from album cover if thumbnail changed
  if (track && track.Thumbnail && track.Thumbnail !== lastProcessedThumbnail) {
    lastProcessedThumbnail = track.Thumbnail;
    extractAlbumColors(track.Thumbnail);
  }
}

/* -------------- End of Lively Listeners -------------- */

/* -------------- Helper Functions -------------- */

// Convert HSL to RGB
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Convert Hex to RGB
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return [r, g, b];
}

// Desaturate RGB color
function desaturateColor([r, g, b], amount) {
  // Convert to grayscale value
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;

  // Interpolate between original color and grayscale
  const desatR = Math.round(r + (gray - r) * (1 - amount));
  const desatG = Math.round(g + (gray - g) * (1 - amount));
  const desatB = Math.round(b + (gray - b) * (1 - amount));

  return [desatR, desatG, desatB];
}

// Extract colors from album cover thumbnail
function extractAlbumColors(base64Thumbnail) {
  if (!base64Thumbnail) return;

  // Create data URL from base64
  const dataUrl = `data:image/png;base64,${base64Thumbnail}`;

  // Extract prominent colors using color.js
  colorjs
    .prominent(dataUrl, { amount: 5, sample: 10 })
    .then((colors) => {
      // Start transition from old to new colors
      oldAlbumColors = albumColors;
      albumColors = colors;
      transitionProgress = 0;
      transitionStartTime = Date.now();
      animateBackgroundTransition();
    })
    .catch((err) => {
      console.error("Failed to extract colors:", err);
      albumColors = null;
    });
}

// Animate background transition
function animateBackgroundTransition() {
  if (!transitionStartTime || transitionProgress >= 1) {
    transitionProgress = 1;
    updateBackground();
    return;
  }

  const elapsed = Date.now() - transitionStartTime;
  transitionProgress = Math.min(1, elapsed / transitionDuration);

  // Ease in-out
  const eased =
    transitionProgress < 0.5
      ? 2 * transitionProgress * transitionProgress
      : 1 - Math.pow(-2 * transitionProgress + 2, 2) / 2;

  updateBackground(eased);

  if (transitionProgress < 1) {
    requestAnimationFrame(animateBackgroundTransition);
  }
}

// Interpolate between two colors
function interpolateColor(color1, color2, factor) {
  if (!color1 || !color2) return color2 || color1 || [0, 0, 0];
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return [
    Math.round(r1 + (r2 - r1) * factor),
    Math.round(g1 + (g2 - g1) * factor),
    Math.round(b1 + (b2 - b1) * factor),
  ];
}

// Update background with album colors
function updateBackground(transitionFactor = 1) {
  if (!bgCanvas) return;

  const ctx = bgCanvas.getContext("2d");
  const width = bgCanvas.width;
  const height = bgCanvas.height;

  // Clear canvas first
  ctx.clearRect(0, 0, width, height);

  // Check if background is enabled
  if (
    !wallpaperSettings["backgroundToggle"] ||
    !albumColors ||
    albumColors.length === 0
  ) {
    return;
  }

  // Get opacity and saturation settings
  const baseOpacity = wallpaperSettings["backgroundOpacity"] ?? 0.3;
  const saturation = wallpaperSettings["backgroundSaturation"] ?? 0.5;

  // Interpolate colors if in transition
  const displayColors = [];
  for (let i = 0; i < albumColors.length; i++) {
    if (oldAlbumColors && oldAlbumColors.length > 0 && transitionFactor < 1) {
      const oldColor = oldAlbumColors[Math.min(i, oldAlbumColors.length - 1)];
      const newColor = albumColors[i];
      displayColors.push(
        interpolateColor(oldColor, newColor, transitionFactor),
      );
    } else {
      displayColors.push(albumColors[i]);
    }
  }

  // Create radial gradient with album colors
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height);

  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radius,
  );

  // Add color stops from album colors with desaturation
  displayColors.forEach((color, index) => {
    const stop = index / (displayColors.length - 1);
    const [r, g, b] = desaturateColor(color, saturation);
    gradient.addColorStop(stop, `rgba(${r}, ${g}, ${b}, ${baseOpacity})`);
  });

  // Fill background
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle blur effect by drawing semi-transparent circles
  displayColors.forEach((color, index) => {
    const [r, g, b] = desaturateColor(color, saturation);
    const angle = (index / displayColors.length) * Math.PI * 2;
    const distance = Math.min(width, height) * 0.3;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const circleRadius = Math.min(width, height) * 0.4;

    const circleGradient = ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      circleRadius,
    );
    circleGradient.addColorStop(
      0,
      `rgba(${r}, ${g}, ${b}, ${baseOpacity * 0.7})`,
    );
    circleGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = circleGradient;
    ctx.fillRect(0, 0, width, height);
  });

  // Update debug colors display (only when transition is complete)
  if (transitionFactor >= 1) {
    updateDebugColors();
  }
}

function updateBackgroundStyle() {
  // Simply redraw background when settings change
  updateBackground();
}

/* -------------- End of Helper Functions -------------- */

/* -------------- Wallpaper Code -------------- */
const debugConsole = document.querySelector(".debug-console");
const debugColorsDiv = document.querySelector(".debug-colors");
let originalConsoleLog = console.log;
let originalConsoleError = console.error;
console.log = function (message) {
  originalConsoleLog(message);
  debugConsole.textContent += message + "\n";
};
console.error = function (message) {
  originalConsoleError(message);
  debugConsole.textContent += "ERROR: " + message + "\n";
};

// Update debug colors display
function updateDebugColors() {
  if (!debugColorsDiv) return;

  if (wallpaperSettings["debugMode"] && albumColors && albumColors.length > 0) {
    debugColorsDiv.style.display = "block";
    debugColorsDiv.innerHTML = "";

    const saturation = wallpaperSettings["backgroundSaturation"] ?? 0.5;

    const colorContainer = document.createElement("div");
    colorContainer.style.display = "flex";
    colorContainer.style.flexWrap = "wrap";
    colorContainer.style.gap = "10px";
    colorContainer.style.padding = "10px";
    colorContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    colorContainer.style.borderRadius = "5px";

    albumColors.forEach((color, index) => {
      const [r, g, b] = desaturateColor(color, saturation);
      const swatch = document.createElement("div");
      swatch.style.width = "60px";
      swatch.style.height = "60px";
      swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      swatch.style.border = "2px solid white";
      swatch.style.borderRadius = "5px";
      swatch.style.display = "flex";
      swatch.style.alignItems = "center";
      swatch.style.justifyContent = "center";
      swatch.style.color = "white";
      swatch.style.textShadow = "0 0 5px black";
      swatch.style.fontSize = "9px";
      swatch.style.fontWeight = "bold";
      swatch.style.flexDirection = "column";
      swatch.innerHTML = `<div>${index + 1}</div><div style="font-size: 7px;">${r},${g},${b}</div>`;
      colorContainer.appendChild(swatch);
    });

    debugColorsDiv.appendChild(colorContainer);
  } else {
    debugColorsDiv.style.display = "none";
  }
}

setInterval(() => {
  if (wallpaperSettings["debugMode"]) {
    debugConsole.style.display = "block";

    // Clear and setup debug display
    let debugText = `Average Loudness: ${averageLoudness.toFixed(2)}\n`;
    debugText += `Current Max Loudness: ${currentMaxLoudness.toFixed(2)}\n`;
    debugText += `Album Colors: ${albumColors ? albumColors.length : 0}\n`;
    debugText += `Saturation: ${(wallpaperSettings["backgroundSaturation"] ?? 0.5).toFixed(2)}\n`;
    debugText += `Playback Type: ${currentTrack?.PlaybackType || "None"}\n`;

    debugConsole.textContent = debugText;
    updateDebugColors();
  } else {
    debugConsole.style.display = "none";
    if (debugColorsDiv) debugColorsDiv.style.display = "none";
  }
}, 1000);

const bgCanvas = document.querySelector(".background");
const audioCanvas = document.querySelector(".audio-visualizer");
const nowPlayingDiv = document.querySelector(".now-playing");
const nowPlayingText = document.querySelector(".now-playing-text");
const nowPlayingCover = nowPlayingDiv.querySelector(".now-playing-cover");

// Initialize canvas sizes
function resizeCanvases() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  bgCanvas.width = width;
  bgCanvas.height = height;
  audioCanvas.width = width;
  audioCanvas.height = height;

  // Redraw background after resize
  updateBackground();
}

// Initial resize
resizeCanvases();

// Resize on window resize
window.addEventListener("resize", resizeCanvases);

function updateAudioVisualizer(audioArray) {
  if (!audioCanvas || !audioArray) return;

  const ctx = audioCanvas.getContext("2d");
  const width = audioCanvas.width;
  const height = audioCanvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Check if there's any audio activity
  const maxVal = Math.max(...audioArray);
  if (maxVal < 0.01) return;

  const numBars = audioArray.length; // use all 128 bars
  const barWidth = width / numBars;
  const gapWidth = barWidth * 0.2; // 20% gap between bars
  const actualBarWidth = barWidth - gapWidth;

  // Create horizontal gradient for album colors mode (outside the loop)
  let albumGradient = null;
  if (
    wallpaperSettings["visualizerColorMode"] === 0 &&
    albumColors &&
    albumColors.length > 0
  ) {
    albumGradient = ctx.createLinearGradient(0, 0, width, 0);
    albumColors.forEach((color, index) => {
      const stop = index / (albumColors.length - 1);
      const [r, g, b] = color;
      albumGradient.addColorStop(stop, `rgba(${r}, ${g}, ${b}, 0.3)`);
    });
  }

  for (let i = 0; i < numBars; i++) {
    const value = audioArray[i];
    const barHeight =
      value * 100 * (wallpaperSettings["visualizerHeight"] || 1); // Scale height

    // Position from right to left
    const x = width - (i + 1) * barWidth;
    const y = height - barHeight;

    // Declare color variables
    let r, g, b;

    switch (wallpaperSettings["visualizerColorMode"]) {
      case 0:
        // Album cover colors with horizontal gradient
        if (albumGradient) {
          ctx.fillStyle = albumGradient;
          ctx.fillRect(x, y, actualBarWidth, barHeight);
          continue; // Skip the normal fillRect at the end
        } else {
          // Fallback to white if no album colors
          r = 255;
          g = 255;
          b = 255;
        }
        break;
      case 1:
        // Random light color
        r = Math.round(Math.random() * 50 + 205);
        g = Math.round(Math.random() * 50 + 205);
        b = Math.round(Math.random() * 50 + 205);
        break;
      case 2:
        // Color based on position (rainbow)
        const hue = (i / numBars) * 360;
        [r, g, b] = hslToRgb(hue / 360, 0.7, 0.7);
        break;
      case 3:
        // Color based on audio value (blue -> cyan -> green -> yellow -> red)
        // Use relative intensity based on max loudness of last minute
        const intensity = Math.min(1, value / currentMaxLoudness);
        if (intensity < 0.25) {
          // Blue to Cyan
          r = 0;
          g = Math.round(intensity * 4 * 255);
          b = 255;
        } else if (intensity < 0.5) {
          // Cyan to Green
          r = 0;
          g = 255;
          b = Math.round((0.5 - intensity) * 4 * 255);
        } else if (intensity < 0.75) {
          // Green to Yellow
          r = Math.round((intensity - 0.5) * 4 * 255);
          g = 255;
          b = 0;
        } else {
          // Yellow to Red
          r = 255;
          g = Math.round((1 - intensity) * 4 * 255);
          b = 0;
        }
        break;
      case 4:
        // Custom color
        const hexColor =
          wallpaperSettings["visualizerCustomColor"] || "#FFFFFF";
        [r, g, b] = hexToRgb(hexColor);
        break;
      default:
        // Fallback to white if invalid mode
        r = 255;
        g = 255;
        b = 255;
        break;
    }

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    ctx.fillRect(x, y, actualBarWidth, barHeight);
  }
}

function updateAudioVisualizerStyle() {
  if (wallpaperSettings["visualizerToggle"]) {
    audioCanvas.style.display = "block";
  } else {
    audioCanvas.style.display = "none";
  }

  const opacity = wallpaperSettings["visualizerOpacity"];
  if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
    audioCanvas.style.opacity = opacity.toString();
  } else {
    audioCanvas.style.opacity = "1";
  }
}

function updateNowPlaying(completeUpdate = false) {
  const track = currentTrack;
  if (track) {
    nowPlayingText.innerHTML = `
            <span class="now-playing-title">${track.Title}</span> <span class="now-playing-artist">by ${track.Artist}</span> <span class="now-playing-album">from the album ${track.AlbumTitle}</span>
        `;
    if (
      wallpaperSettings["nowPlayingCoverToggle"] &&
      track.Thumbnail &&
      (track.PlaybackType == "Music" || track.PlaybackType == "Audio")
    ) {
      nowPlayingCover.innerHTML = `<img src="data:image/png;base64,${track.Thumbnail}" alt="Album Cover">`;
    } else {
      nowPlayingCover.innerHTML = "";
    }
  } else {
    nowPlayingText.innerHTML = "No song is playing";
  }

  if (averageLoudness > 0) {
    nowPlayingDiv.style.opacity = (
      wallpaperSettings["nowPlayingOpacity"] ?? 1
    ).toString();
    bgCanvas.style.opacity = 1;
  } else {
    nowPlayingDiv.style.opacity = "0";
    bgCanvas.style.opacity = "0";
  }

  if (completeUpdate) {
    nowPlayingDiv.style.display = wallpaperSettings["nowPlayingToggle"]
      ? "block"
      : "none";

    // Preserve other transforms but replace any existing scale(...) transforms
    const transforms = nowPlayingDiv.style.transform
      ? nowPlayingDiv.style.transform.split(/\s+/).filter(Boolean)
      : [];
    const filteredTransforms = transforms.filter(
      (t) => !t.startsWith("scale("),
    );
    const size = Number(wallpaperSettings["nowPlayingSize"]);
    if (Number.isFinite(size) && size > 0) {
      filteredTransforms.push("scale(" + size + ")");
    }

    nowPlayingDiv.style.transform = filteredTransforms.length
      ? filteredTransforms.join(" ")
      : "";

    // Preserve other transforms but replace any existing scale(...) transforms
    const coverTransforms = nowPlayingCover.style.transform
      ? nowPlayingCover.style.transform.split(/\s+/).filter(Boolean)
      : [];
    const coverFilteredTransforms = coverTransforms.filter(
      (t) => !t.startsWith("scale("),
    );
    const coverSize = Number(wallpaperSettings["nowPlayingCoverSize"]);
    if (Number.isFinite(coverSize) && coverSize > 0) {
      coverFilteredTransforms.push("scale(" + coverSize + ")");
    }

    nowPlayingCover.style.transform = coverFilteredTransforms.length
      ? coverFilteredTransforms.join(" ")
      : "";
  }
}
setInterval(() => {
  if (currentTrack) {
    updateNowPlaying();
  }
}, 500);

/* -------------- End of Wallpaper Code -------------- */
