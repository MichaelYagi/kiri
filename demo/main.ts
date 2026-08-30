import { Kiri } from "../src/kiri";

const container = document.getElementById("kiri-container") as HTMLElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const zoomSlider = document.getElementById("zoom") as HTMLInputElement;
const rotateButton = document.getElementById("rotate") as HTMLButtonElement;
const flipHButton = document.getElementById("flip-h") as HTMLButtonElement;
const flipVButton = document.getElementById("flip-v") as HTMLButtonElement;
const exportButton = document.getElementById("export") as HTMLButtonElement;
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
