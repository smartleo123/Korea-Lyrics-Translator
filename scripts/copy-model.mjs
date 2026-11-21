import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public',{recursive:true});
copyFileSync('node_modules/garu-ko/models/base.gmdl','public/model.gmdl');
console.log('Copied Garu model for relative GitHub Pages paths.');
