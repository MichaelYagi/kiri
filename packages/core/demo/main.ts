import "../src/kiri.css";
import { Kiri } from "../src/index";

const container = document.getElementById("kiri-container") as HTMLElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const zoomSlider = document.getElementById("zoom") as HTMLInputElement;
const rotateButton = document.getElementById("rotate") as HTMLButtonElement;
const flipHButton = document.getElementById("flip-h") as HTMLButtonElement;
const flipVButton = document.getElementById("flip-v") as HTMLButtonElement;
const exportButton = document.getElementById("export") as HTMLButtonElement;
const brightnessSlider = document.getElementById("brightness") as HTMLInputElement;
const contrastSlider = document.getElementById("contrast") as HTMLInputElement;
const saturationSlider = document.getElementById("saturation") as HTMLInputElement;
const grayscaleCheckbox = document.getElementById("grayscale") as HTMLInputElement;
const sepiaCheckbox = document.getElementById("sepia") as HTMLInputElement;
const uploadUrlInput = document.getElementById("upload-url") as HTMLInputElement;
const uploadButton = document.getElementById("upload") as HTMLButtonElement;
const uploadStatus = document.getElementById("upload-status") as HTMLElement;
const output = document.getElementById("output") as HTMLElement;

const cropper = new Kiri(container, {
  frame: { shape: "circle", width: 200, height: 200 },
  minZoom: 1,
  maxZoom: 4,
  rotatable: true,
  resizableFrame: true,
  mouseWheelZoom: true,
  useExifOrientation: true,
});

cropper.on("change", (state) => {
  zoomSlider.value = String(state.zoom);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  await cropper.load(file);
});

zoomSlider.addEventListener("input", () => {
  cropper.setZoom(Number(zoomSlider.value));
});

rotateButton.addEventListener("click", () => {
  cropper.rotate(90);
});

flipHButton.addEventListener("click", () => {
  cropper.flipHorizontal();
});

flipVButton.addEventListener("click", () => {
  cropper.flipVertical();
});

exportButton.addEventListener("click", async () => {
  const dataUrl = await cropper.export({ type: "base64", format: "image/png" });
  output.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUrl as string;
  output.appendChild(img);
});

function applyFiltersFromControls(): void {
  cropper.setFilters({
    brightness: Number(brightnessSlider.value),
    contrast: Number(contrastSlider.value),
    saturation: Number(saturationSlider.value),
    grayscale: grayscaleCheckbox.checked,
    sepia: sepiaCheckbox.checked,
  });
}

for (const el of [brightnessSlider, contrastSlider, saturationSlider]) {
  el.addEventListener("input", applyFiltersFromControls);
}
for (const el of [grayscaleCheckbox, sepiaCheckbox]) {
  el.addEventListener("change", applyFiltersFromControls);
}

uploadButton.addEventListener("click", async () => {
  const url = uploadUrlInput.value.trim();
  if (!url) {
    uploadStatus.textContent = "Enter an upload URL first.";
    return;
  }
  uploadStatus.textContent = "Uploading…";
  try {
    const response = (await cropper.upload(url, { format: "image/png" })) as Response;
    uploadStatus.textContent = `Uploaded (status ${response.status})`;
  } catch (err) {
    uploadStatus.textContent = `Upload failed: ${(err as Error).message}`;
  }
});
