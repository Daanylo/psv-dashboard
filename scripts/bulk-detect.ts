import { createCanvas, loadImage, Image } from 'canvas';
import * as ort from 'onnxruntime-node';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

interface Detection {
  label: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
}

const DB_CONFIG = {
  host: process.env.DB_HOST || '192.168.150.30',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'remote',
  password: process.env.DB_PASSWORD || 'remote',
  database: process.env.DB_NAME || 'psv_dev',
};

let model: ort.InferenceSession | null = null;
let classLabels: string[] = [];

async function loadModel() {
  if (model) return;
  
  const modelPath = path.join(process.cwd(), 'public', 'lib', 'models', 'best.onnx');
  const classesPath = path.join(process.cwd(), 'public', 'lib', 'models', 'classes.txt');
  
  console.log('Loading ONNX model...');
  model = await ort.InferenceSession.create(modelPath);
  
  const classesContent = fs.readFileSync(classesPath, 'utf-8');
  classLabels = classesContent.split('\n').filter(line => line.trim());
  
  console.log(`Model loaded with ${classLabels.length} classes`);
}

function preprocessImage(img: Image): { tensor: ort.Tensor; scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  const canvas = createCanvas(640, 640);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 640, 640);
  
  const imgWidth = img.width;
  const imgHeight = img.height;
  const scale = Math.min(640 / imgWidth, 640 / imgHeight);
  const newWidth = imgWidth * scale;
  const newHeight = imgHeight * scale;
  const offsetX = (640 - newWidth) / 2;
  const offsetY = (640 - newHeight) / 2;
  
  ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
  
  const imageData = ctx.getImageData(0, 0, 640, 640);
  const data = imageData.data;
  
  const float32Data = new Float32Array(3 * 640 * 640);
  for (let i = 0; i < 640 * 640; i++) {
    float32Data[i] = data[i * 4] / 255.0;
    float32Data[640 * 640 + i] = data[i * 4 + 1] / 255.0;
    float32Data[2 * 640 * 640 + i] = data[i * 4 + 2] / 255.0;
  }
  
  const tensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);
  
  return {
    tensor,
    scaleX: scale,
    scaleY: scale,
    offsetX,
    offsetY,
  };
}

function processOutput(data: Float32Array, shape: number[], scaleX: number, scaleY: number, offsetX: number, offsetY: number, confidenceThreshold: number): Detection[] {
  const detections: Detection[] = [];
  
  let numPredictions: number;
  let numClasses: number;
  
  if (shape.length === 3 && shape[0] === 1) {
    numPredictions = shape[2];
    numClasses = shape[1] - 4;
    
    let maxScoreFound = 0;
    let maxScoreIndex = -1;
    
    for (let i = 0; i < numPredictions; i++) {
      const cx = data[i];
      const cy = data[numPredictions + i];
      const w = data[2 * numPredictions + i];
      const h = data[3 * numPredictions + i];
      
      let maxClassScore = 0;
      let maxClassId = 0;
      
      for (let c = 0; c < numClasses; c++) {
        const classScore = data[(4 + c) * numPredictions + i];
        if (classScore > maxClassScore) {
          maxClassScore = classScore;
          maxClassId = c;
        }
      }
      
      if (maxClassScore > maxScoreFound) {
        maxScoreFound = maxClassScore;
        maxScoreIndex = i;
      }
      
      if (maxClassScore >= confidenceThreshold && maxClassId < classLabels.length) {
        const x1 = cx - w / 2;
        const y1 = cy - h / 2;
        
        detections.push({
          label: classLabels[maxClassId],
          confidence: maxClassScore,
          box: {
            x: (x1 - offsetX) / scaleX,
            y: (y1 - offsetY) / scaleY,
            width: w / scaleX,
            height: h / scaleY,
          },
        });
      }
    }
    
    if (maxScoreIndex >= 0) {
      console.log(`  Max score ${maxScoreFound.toFixed(4)} at prediction ${maxScoreIndex}`);
      console.log(`    Box coords: cx=${data[maxScoreIndex].toFixed(2)}, cy=${data[numPredictions + maxScoreIndex].toFixed(2)}, w=${data[2 * numPredictions + maxScoreIndex].toFixed(2)}, h=${data[3 * numPredictions + maxScoreIndex].toFixed(2)}`);
      for (let c = 0; c < numClasses; c++) {
        const score = data[(4 + c) * numPredictions + maxScoreIndex];
        console.log(`    Class ${c} (${classLabels[c]}): ${score.toFixed(6)}`);
      }
    }
  }
  
  return detections;
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

function nms(detections: Detection[], iouThreshold: number = 0.45): Detection[] {
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

async function detectLogos(imageUrl: string, confidenceThreshold: number): Promise<Detection[]> {
  await loadModel();
  if (!model) throw new Error('Model not loaded');
  
  const img = await loadImage(imageUrl);
  const { tensor, scaleX, scaleY, offsetX, offsetY } = preprocessImage(img);
  
  const feeds = { images: tensor };
  const results = await model.run(feeds);
  const output = results[Object.keys(results)[0]];
  const outputData = output.data as Float32Array;
  const outputShape = output.dims as number[];
  
  console.log(`  Output shape: ${outputShape}`);
  console.log(`  First 20 raw values: ${Array.from(outputData.slice(0, 20)).map(v => v.toFixed(4)).join(', ')}`);
  
  const numPredictions = outputShape[2];
  const startIdx = 4 * numPredictions;
  console.log(`  Class score start index: ${startIdx}, numPredictions: ${numPredictions}`);
  console.log(`  Sample class scores at prediction 0-5: ${Array.from(outputData.slice(startIdx, startIdx + 6)).map(v => v.toFixed(4)).join(', ')}`);
  console.log(`  Sample class scores at prediction 100: ${Array.from(outputData.slice(startIdx + 100, startIdx + 106)).map(v => v.toFixed(4)).join(', ')}`);
  
  const detections = processOutput(outputData, outputShape, scaleX, scaleY, offsetX, offsetY, confidenceThreshold);
  console.log(`  Detections before NMS: ${detections.length}`);
  const finalDetections = nms(detections, 0.45);
  console.log(`  Detections after NMS: ${finalDetections.length}`);
  return finalDetections;
}

async function main() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(DB_CONFIG);
  
  console.log('Fetching posts without detections...');
  const [posts] = await connection.execute(`
    SELECT p.* 
    FROM instagram_posts p
    LEFT JOIN logo_detections ld ON p.id = ld.post_id
    WHERE ld.id IS NULL
    LIMIT 1000
  `);
  const postArray = posts as any[];
  
  console.log(`Found ${postArray.length} posts without detections`);
  console.log('Starting bulk detection with 1% confidence threshold (onnxruntime-node)...\n');
  
  let processed = 0;
  let failed = 0;
  
  for (const post of postArray) {
    try {
      console.log(`[${processed + 1}/${postArray.length}] Processing post ${post.id} (${post.shortcode})...`);
      
      const imageUrl = `https://www.instagram.com/p/${post.shortcode}/media/?size=l`;
      const detections = await detectLogos(imageUrl, 0.01);
      
      console.log(`  Found ${detections.length} detections`);
      
      if (detections.length > 0) {
        await connection.execute('DELETE FROM logo_detections WHERE post_id = ?', [post.id]);
        
        const values: any[] = [];
        detections.forEach(det => {
          values.push(
            post.id,
            det.label,
            det.confidence,
            det.box.x,
            det.box.y,
            det.box.width,
            det.box.height,
            'bulk_script',
            0.01
          );
        });
        
        const placeholders = detections.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const sql = `INSERT INTO logo_detections 
          (post_id, logo_label, confidence, box_x, box_y, box_width, box_height, model_version, confidence_threshold) 
          VALUES ${placeholders}`;
        
        await connection.execute(sql, values);
        console.log(`  Saved to database`);
      }
      
      processed++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  Failed: ${error}`);
      failed++;
    }
  }
  
  await connection.end();
  
  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((processed - failed) / processed * 100).toFixed(1)}%`);
}

main().catch(console.error);
