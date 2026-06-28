import * as fs from 'fs';
import WordExtractor from 'word-extractor';

async function main() {
  const filePath = 'd:/Project/LAW_AI/15346.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  if (data.length > 0) {
    const text = data[0].text;
    console.log('Original String length:', text.length);
    
    // Convert to UTF-8 Buffer
    const buf = Buffer.from(text, 'utf8');
    console.log('UTF-8 Buffer length:', buf.length);
    console.log('First 16 bytes of buffer:', buf.subarray(0, 16).toString('hex'));
    
    // Try to extract using WordExtractor
    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buf);
      const extractedText = doc.getBody();
      console.log('Successfully extracted text!');
      console.log('Extracted Text Length:', extractedText.length);
      console.log('Extracted Text Preview (first 200 chars):');
      console.log(extractedText.slice(0, 200));
    } catch (e) {
      console.error('Extraction failed:', e);
    }
  }
}

main();
