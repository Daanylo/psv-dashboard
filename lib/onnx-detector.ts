import * as ort from 'onnxruntime-web';

export interface Detection {
  label: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

let session: ort.InferenceSession | null = null;
let classes: string[] = [];

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

export async function loadModel() {
  if (!session) {
    try {
      session = await ort.InferenceSession.create('/lib/models/best.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      const response = await fetch('/lib/models/classes.txt');
      if (!response.ok) {
        throw new Error('Failed to load classes file');
      }
      const text = await response.text();
      classes = text.trim().split('\n').map(c => c.trim());
    } catch (error) {
      session = null;
      throw new Error(`Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return session;
}

function preprocessImage(
  image: HTMLImageElement | HTMLCanvasElement,
  modelWidth: number = 640,
  modelHeight: number = 640
): { tensor: ort.Tensor; scale: number; offsetX: number; offsetY: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = modelWidth;
  canvas.height = modelHeight;
  
  const imgWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const imgHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  
  const scale = Math.min(modelWidth / imgWidth, modelHeight / imgHeight);
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  const offsetX = (modelWidth - scaledWidth) / 2;
  const offsetY = (modelHeight - scaledHeight) / 2;
  
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, modelWidth, modelHeight);
  ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
  
  const imageData = ctx.getImageData(0, 0, modelWidth, modelHeight);
  const { data } = imageData;
  
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  
  for (let i = 0; i < data.length; i += 4) {
    red.push(data[i] / 255.0);
    green.push(data[i + 1] / 255.0);
    blue.push(data[i + 2] / 255.0);
  }
  
  const float32Data = Float32Array.from([...red, ...green, ...blue]);
  const tensor = new ort.Tensor('float32', float32Data, [1, 3, modelHeight, modelWidth]);
  
  return { tensor, scale, offsetX, offsetY };
}

function processOutput(
  output: Float32Array,
  outputShape: number[],
  scale: number,
  offsetX: number,
  offsetY: number,
  confidenceThreshold: number = 0.5,
  iouThreshold: number = 0.45
): Detection[] {
  const detections: Detection[] = [];
  
  let numPredictions: number;
  let numClasses: number;
  
  if (outputShape.length === 3 && outputShape[0] === 1) {
    numPredictions = outputShape[2];
    numClasses = outputShape[1] - 4;
    
    for (let i = 0; i < numPredictions; i++) {
      const cx = output[i];
      const cy = output[numPredictions + i];
      const w = output[2 * numPredictions + i];
      const h = output[3 * numPredictions + i];
      
      let maxClassScore = 0;
      let maxClassId = 0;
      
      for (let c = 0; c < numClasses; c++) {
        const classScore = output[(4 + c) * numPredictions + i];
        if (classScore > maxClassScore) {
          maxClassScore = classScore;
          maxClassId = c;
        }
      }
      
      if (maxClassScore >= confidenceThreshold && maxClassId < classes.length) {
        const x1 = cx - w / 2;
        const y1 = cy - h / 2;
        
        detections.push({
          label: classes[maxClassId],
          confidence: maxClassScore,
          box: {
            x: (x1 - offsetX) / scale,
            y: (y1 - offsetY) / scale,
            width: w / scale,
            height: h / scale,
          },
        });
      }
    }
  } else {
    const numDetections = output.length / 6;
    
    for (let i = 0; i < numDetections; i++) {
      const offset = i * 6;
      const x1 = output[offset];
      const y1 = output[offset + 1];
      const x2 = output[offset + 2];
      const y2 = output[offset + 3];
      const confidence = output[offset + 4];
      const classId = Math.round(output[offset + 5]);
      
      if (confidence >= confidenceThreshold && classId < classes.length) {
        detections.push({
          label: classes[classId],
          confidence: confidence,
          box: {
            x: (x1 - offsetX) / scale,
            y: (y1 - offsetY) / scale,
            width: (x2 - x1) / scale,
            height: (y2 - y1) / scale,
          },
        });
      }
    }
  }
  
  return nms(detections, iouThreshold);
}

function nms(detections: Detection[], iouThreshold: number): Detection[] {
  const sorted = detections.sort((a, b) => b.confidence - a.confidence);
  const result: Detection[] = [];
  
  for (const detection of sorted) {
    let keep = true;
    
    for (const selected of result) {
      if (detection.label === selected.label) {
        const iou = calculateIoU(detection.box, selected.box);
        if (iou > iouThreshold) {
          keep = false;
          break;
        }
      }
    }
    
    if (keep) {
      result.push(detection);
    }
  }
  
  return result;
}

function calculateIoU(box1: Detection['box'], box2: Detection['box']): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}

export async function detectLogos(
  image: HTMLImageElement | HTMLCanvasElement,
  confidenceThreshold: number = 0.5
): Promise<Detection[]> {
  await loadModel();
  
  if (!session) {
    throw new Error('Model not loaded');
  }
  
  const { tensor, scale, offsetX, offsetY } = preprocessImage(image);
  
  const feeds: Record<string, ort.Tensor> = {};
  feeds[session.inputNames[0]] = tensor;
  
  const results = await session.run(feeds);
  const outputTensor = results[session.outputNames[0]];
  const output = outputTensor.data as Float32Array;
  const outputShape = outputTensor.dims as number[];
  
  console.log('ONNX Output Shape:', outputShape);
  console.log('First 20 values:', Array.from(output.slice(0, 20)));
  
  return processOutput(output, outputShape, scale, offsetX, offsetY, confidenceThreshold);
}
