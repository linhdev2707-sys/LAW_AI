import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const filePath = 'd:/Project/LAW_AI/15346.json';
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  console.log('--- JSON Structure ---');
  console.log('Is Array:', Array.isArray(data));
  console.log('Total Elements:', data.length);
  if (data.length > 0) {
    console.log('First Element Keys:', Object.keys(data[0]));
    console.log('First Element Level:', data[0].level);
    console.log('First Element Label:', data[0].label);
    console.log('First Element Text Length:', data[0].text ? data[0].text.length : 0);
    console.log('First Element Text Preview (first 100 chars):', JSON.stringify(data[0].text?.slice(0, 100)));
    
    // Print unique levels
    const levels = new Set(data.map((item: any) => item.level));
    console.log('Unique levels in JSON:', Array.from(levels));

    // Print first 5 items basic metadata
    console.log('First 5 items:');
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`  [${i}]: level=${data[i].level}, label=${data[i].label}, textLength=${data[i].text ? data[i].text.length : 0}`);
    }
  }
  console.log('----------------------');
}

main();
