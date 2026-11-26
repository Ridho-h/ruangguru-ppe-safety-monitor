import * as ort from "onnxruntime-web";
import type { Detection } from "../types";
import { decodeYoloOutput } from "./postprocess";
import {
  computeLetterbox,
  rgbaToNchwFloat32,
  YOLO_INPUT_SIZE,
} from "./preprocess";

export class YoloPpeEngine {
  private session: ort.InferenceSession | null = null;
  private inputName = "images";
  private outputName = "output0";
  private backend: "webgpu" | "wasm" = "wasm";
  private disposed = false;
  private loadPromise: Promise<"webgpu" | "wasm"> | null = null;
  private runPromise: Promise<unknown> | null = null;
  private scratchCanvas: HTMLCanvasElement | null = null;
  private scratchCtx: CanvasRenderingContext2D | null = null;
  private inputBuffer = new Float32Array(3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE);

  public getBackend(): "webgpu" | "wasm" {
    return this.backend;
  }

  public isReady(): boolean {
    return !this.disposed && this.session !== null;
  }

  public async load(modelUrl = "/models/ppe-yolov8n.onnx"): Promise<"webgpu" | "wasm"> {
    if (this.session) return this.backend;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      // Serve WASM runtime files from self-hosted public/ort/ (single-threaded for zero COOP/COEP friction)
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

      let created: ort.InferenceSession;
      let chosenBackend: "webgpu" | "wasm" = "wasm";

      const hasWebGpu =
        typeof navigator !== "undefined" && "gpu" in navigator;

      if (hasWebGpu) {
        try {
          created = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ["webgpu"],
            graphOptimizationLevel: "all",
          });
          chosenBackend = "webgpu";
        } catch {
          created = await ort.InferenceSession.create(modelUrl, {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          });
          chosenBackend = "wasm";
        }
      } else {
        created = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
        chosenBackend = "wasm";
      }

      if (this.disposed) {
        await created.release();
        return chosenBackend;
      }

      this.session = created;
      this.backend = chosenBackend;
      this.inputName = this.session.inputNames[0] ?? "images";
      this.outputName = this.session.outputNames[0] ?? "output0";

      if (typeof document !== "undefined") {
        this.scratchCanvas = document.createElement("canvas");
        this.scratchCanvas.width = YOLO_INPUT_SIZE;
        this.scratchCanvas.height = YOLO_INPUT_SIZE;
        this.scratchCtx = this.scratchCanvas.getContext("2d", {
          willReadFrequently: true,
        });
      }

      return this.backend;
    })();

    return this.loadPromise;
  }

  public async detectVideoFrame(
    video: HTMLVideoElement,
    confThreshold = 0.45,
  ): Promise<{ detections: Detection[]; latencyMs: number }> {
    if (this.disposed || !this.session || !this.scratchCtx) {
      return { detections: [], latencyMs: 0 };
    }
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (srcW === 0 || srcH === 0) {
      return { detections: [], latencyMs: 0 };
    }

    const t0 = performance.now();
    const meta = computeLetterbox(srcW, srcH, YOLO_INPUT_SIZE);

    this.scratchCtx.fillStyle = "rgb(114, 114, 114)";
    this.scratchCtx.fillRect(0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE);
    this.scratchCtx.drawImage(
      video,
      0,
      0,
      srcW,
      srcH,
      meta.padX,
      meta.padY,
      meta.newWidth,
      meta.newHeight,
    );

    const imageData = this.scratchCtx.getImageData(
      0,
      0,
      YOLO_INPUT_SIZE,
      YOLO_INPUT_SIZE,
    );
    const chw = rgbaToNchwFloat32(
      imageData.data,
      YOLO_INPUT_SIZE,
      this.inputBuffer,
    );

    const inputTensor = new ort.Tensor("float32", chw, [
      1,
      3,
      YOLO_INPUT_SIZE,
      YOLO_INPUT_SIZE,
    ]);

    let outputs: ort.InferenceSession.OnnxValueMapType | null = null;
    try {
      const pending = this.session.run({ [this.inputName]: inputTensor });
      this.runPromise = pending;
      outputs = await pending;
      const outTensor = outputs[this.outputName] ?? Object.values(outputs)[0];
      const data = (await outTensor.getData()) as Float32Array;
      const detections = decodeYoloOutput(
        data,
        outTensor.dims,
        meta,
        confThreshold,
        0.45,
      );
      const latencyMs = Math.round(performance.now() - t0);
      return { detections, latencyMs };
    } finally {
      this.runPromise = null;
      inputTensor.dispose();
      if (outputs) {
        for (const tensor of Object.values(outputs)) {
          if (typeof tensor.dispose === "function") tensor.dispose();
        }
      }
    }
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
    try {
      if (this.loadPromise) await this.loadPromise.catch(() => {});
      if (this.runPromise) await this.runPromise.catch(() => {});
    } finally {
      if (this.session) {
        const s = this.session;
        this.session = null;
        await s.release().catch(() => {});
      }
    }
  }
}
